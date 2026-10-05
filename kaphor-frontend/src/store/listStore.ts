import { create } from 'zustand';
import api from '../services/api';
import { peek, remember, hydrate } from '../utils/swrCache';
import type { ConversationSummary } from '../services/messageService';
import type { TransactionOrder } from '../services/orderService';
import type { OrdersSummaryData, RentalItem } from '../services/trackingService';
import { useNotificationStore } from './notificationStore';

/**
 * Cache-first list store for the Messages inbox and the My Orders hub.
 * - Screens read from here synchronously (instant paint), refresh in the background.
 * - Pages are requested with limit=PAGE_SIZE and continued via `nextCursor` when the backend sends one.
 * - Refetches are skipped while the data is younger than FRESH_MS (unless forced).
 * - Persisted through swrCache ('@kaphor_cache_swr_' prefix) which is wiped on sign-out.
 */
const PAGE_SIZE = 20;
export const FRESH_MS = 30_000;

const INBOX_KEY = 'inbox:list';
const ORDERS_KEY = 'orders:all';

interface OrdersBundle {
  sum: OrdersSummaryData | null;
  ords: TransactionOrder[];
  rents: RentalItem[];
  swps: any[];
}

interface ListState {
  inbox: ConversationSummary[] | null;
  inboxCursor: string | null;
  inboxTs: number;
  orders: OrdersBundle | null;
  ordersCursor: string | null;
  ordersTs: number;
  hydrated: boolean;
  setInbox: (updater: (prev: ConversationSummary[]) => ConversationSummary[]) => void;
}

export const useListStore = create<ListState>((set, get) => ({
  inbox: null,
  inboxCursor: null,
  inboxTs: 0,
  orders: null,
  ordersCursor: null,
  ordersTs: 0,
  hydrated: false,
  setInbox: (updater) => {
    const next = updater(get().inbox ?? []);
    set({ inbox: next });
    remember(INBOX_KEY, { items: next.slice(0, 50), cursor: get().inboxCursor });
  },
}));

function extractPage<T>(body: any): { items: T[]; nextCursor: string | null } {
  const items: T[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  const nextCursor = body?.nextCursor ?? body?.meta?.nextCursor ?? body?.data?.nextCursor ?? null;
  return { items, nextCursor: nextCursor ? String(nextCursor) : null };
}

function mergeById<T extends { id: string }>(base: T[], more: T[]): T[] {
  const seen = new Set(base.map((x) => x.id));
  return base.concat(more.filter((x) => !seen.has(x.id)));
}

let hydratePromise: Promise<void> | null = null;

/** Load the persisted copies into the store (once). Safe to call from anywhere. */
export function hydrateLists(): Promise<void> {
  if (useListStore.getState().hydrated) return Promise.resolve();
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const [inbox, orders] = await Promise.all([hydrate<any>(INBOX_KEY), hydrate<any>(ORDERS_KEY)]);
      const s = useListStore.getState();
      useListStore.setState({
        inbox: s.inbox ?? (Array.isArray(inbox?.items) ? inbox.items : null),
        inboxCursor: s.inboxCursor ?? inbox?.cursor ?? null,
        orders: s.orders ?? (orders ? { sum: orders.sum ?? null, ords: orders.ords ?? [], rents: orders.rents ?? [], swps: orders.swps ?? [] } : null),
        ordersCursor: s.ordersCursor ?? orders?.cursor ?? null,
        hydrated: true,
      });
    })().catch(() => {
      useListStore.setState({ hydrated: true });
    });
  }
  return hydratePromise;
}

let inboxInFlight: Promise<void> | null = null;
let inboxMore = false;

export function refreshInbox(force = false): Promise<void> {
  const s = useListStore.getState();
  if (!force && s.inbox && Date.now() - s.inboxTs < FRESH_MS) return Promise.resolve();
  if (inboxInFlight) return inboxInFlight;
  inboxInFlight = (async () => {
    try {
      const { data } = await api.get('/messages/conversations', { params: { limit: PAGE_SIZE } });
      const page = extractPage<ConversationSummary>(data);
      const cur = useListStore.getState();
      // Keep any older pages already loaded below the fresh first page
      const tail = cur.inbox && cur.inbox.length > page.items.length && cur.inboxCursor ? cur.inbox : [];
      const items = tail.length ? mergeById(page.items, tail) : page.items;
      useListStore.setState({
        inbox: items,
        inboxCursor: tail.length ? cur.inboxCursor : page.nextCursor,
        inboxTs: Date.now(),
      });
      remember(INBOX_KEY, { items: items.slice(0, 50), cursor: useListStore.getState().inboxCursor });
      if (!useListStore.getState().inboxCursor) {
        const total = items.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        useNotificationStore.getState().setUnreadMessageCount(total);
      } else {
        useNotificationStore.getState().fetchUnreadMessageCount();
      }
    } finally {
      inboxInFlight = null;
    }
  })();
  return inboxInFlight;
}

export async function loadMoreInbox(): Promise<void> {
  const { inboxCursor, inbox } = useListStore.getState();
  if (!inboxCursor || inboxMore) return;
  inboxMore = true;
  try {
    const { data } = await api.get('/messages/conversations', { params: { limit: PAGE_SIZE, cursor: inboxCursor } });
    const page = extractPage<ConversationSummary>(data);
    const cur = useListStore.getState();
    useListStore.setState({
      inbox: mergeById(cur.inbox ?? inbox ?? [], page.items),
      inboxCursor: page.nextCursor,
    });
  } catch {
    // next scroll retries
  } finally {
    inboxMore = false;
  }
}

let ordersInFlight: Promise<void> | null = null;
let ordersMore = false;

export function refreshOrders(force = false): Promise<void> {
  const s = useListStore.getState();
  if (!force && s.orders && Date.now() - s.ordersTs < FRESH_MS) return Promise.resolve();
  if (ordersInFlight) return ordersInFlight;
  ordersInFlight = (async () => {
    try {
      const [sumRes, ordRes, rentRes, swapRes] = await Promise.all([
        api.get('/orders/summary').catch(() => null),
        api.get('/orders/transactions', { params: { limit: PAGE_SIZE } }),
        api.get('/rentals/me', { params: { role: 'all' } }),
        api.get('/swaps').catch(() => null),
      ]);
      const ordPage = extractPage<TransactionOrder>(ordRes.data);
      const prev = useListStore.getState();
      const tail = prev.orders && prev.orders.ords.length > ordPage.items.length && prev.ordersCursor ? prev.orders.ords : [];
      const ords = tail.length ? mergeById(ordPage.items, tail) : ordPage.items;
      const bundle: OrdersBundle = {
        sum: sumRes?.data?.data ?? prev.orders?.sum ?? null,
        ords,
        rents: Array.isArray(rentRes.data?.data) ? rentRes.data.data : [],
        swps: swapRes ? (Array.isArray(swapRes.data?.data) ? swapRes.data.data : Array.isArray(swapRes.data) ? swapRes.data : []) : prev.orders?.swps ?? [],
      };
      const cursor = tail.length ? prev.ordersCursor : ordPage.nextCursor;
      useListStore.setState({ orders: bundle, ordersCursor: cursor, ordersTs: Date.now() });
      // Same key/shape the order detail screen seeds from
      remember(ORDERS_KEY, { ...bundle, ords: bundle.ords.slice(0, 50), cursor });
    } finally {
      ordersInFlight = null;
    }
  })();
  return ordersInFlight;
}

export async function loadMoreOrders(): Promise<void> {
  const { ordersCursor } = useListStore.getState();
  if (!ordersCursor || ordersMore) return;
  ordersMore = true;
  try {
    const { data } = await api.get('/orders/transactions', { params: { limit: PAGE_SIZE, cursor: ordersCursor } });
    const page = extractPage<TransactionOrder>(data);
    const cur = useListStore.getState();
    if (!cur.orders) return;
    useListStore.setState({
      orders: { ...cur.orders, ords: mergeById(cur.orders.ords, page.items) },
      ordersCursor: page.nextCursor,
    });
  } catch {
    // next scroll retries
  } finally {
    ordersMore = false;
  }
}

/** Warm both lists after first paint / login so the tabs open already populated. */
export function prefetchLists(): void {
  hydrateLists()
    .then(() => Promise.all([refreshInbox(), refreshOrders()]))
    .catch(() => {});
}

/** Drop in-memory copies (sign-out). Persisted copies are wiped by clearUserCaches. */
export function resetLists(): void {
  useListStore.setState({ inbox: null, inboxCursor: null, inboxTs: 0, orders: null, ordersCursor: null, ordersTs: 0, hydrated: false });
  hydratePromise = null;
}

// --- Seeds: pass list-item data to detail screens so they paint immediately ---
const conversationSeeds = new Map<string, ConversationSummary>();
export function seedConversation(c: ConversationSummary): void {
  conversationSeeds.set(c.id, c);
}
export function getConversationSeed(id?: string): ConversationSummary | undefined {
  return id ? conversationSeeds.get(id) ?? useListStore.getState().inbox?.find((c) => c.id === id) : undefined;
}

export function getOrderSeed(id?: string): TransactionOrder | undefined {
  if (!id) return undefined;
  return (useListStore.getState().orders?.ords ?? peek<any>(ORDERS_KEY)?.ords)?.find((o: TransactionOrder) => o.id === id);
}
