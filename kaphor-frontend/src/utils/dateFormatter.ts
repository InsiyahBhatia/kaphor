const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseSafeDate(val: any): Date | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/** E.g. "OCTOBER 2026" */
export function formatMonthYear(val: any, fallback = '—'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  return `${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`.toUpperCase();
}


/** E.g. "18 Sep" */
export function formatShortDate(val: any, fallback = '—'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** E.g. "18 Sep 2026" */
export function formatFullDate(val: any, fallback = '—'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** E.g. "Wed, 18 Sep" */
export function formatWeekdayDate(val: any, fallback = '—'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** E.g. "Wed, 18 Sep 2026" */
export function formatWeekdayFullDate(val: any, fallback = '—'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** E.g. "18 Sep, 14:30" */
export function formatDateTime(val: any, fallback = '—'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}, ${hours}:${minutes}`;
}

/** Safe integer day count between two dates, guaranteed >= 1 */
export function getDaysBetween(start: any, end: any): number {
  const d1 = parseSafeDate(start);
  const d2 = parseSafeDate(end);
  if (!d1 || !d2) return 1;
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
  return Math.max(1, isNaN(diff) ? 1 : diff);
}

/** Safe remaining day count until end date, guaranteed >= 0 */
export function getDaysRemaining(end: any): number {
  const d = parseSafeDate(end);
  if (!d) return 0;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 3600 * 24));
  return Math.max(0, isNaN(diff) ? 0 : diff);
}

/** Formats integer/number with commas, e.g. 1,450 without relying on Intl toLocaleString */
export function formatCurrency(amount: any): string {
  const num = Math.round(Number(amount) || 0);
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

