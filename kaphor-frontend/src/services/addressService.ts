import api from './api';

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface CreateAddressInput {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface UpdateAddressInput extends Partial<CreateAddressInput> {}

let activeSelectedAddress: Address | null = null;
const listeners = new Set<(addr: Address | null) => void>();

export const addressService = {
  /** Get currently active/selected address for checkout/rental/swap */
  getActiveDeliveryAddress(): Address | null {
    return activeSelectedAddress;
  },

  /** Set currently active/selected address */
  setActiveDeliveryAddress(addr: Address | null): void {
    activeSelectedAddress = addr;
    listeners.forEach((cb) => {
      try { cb(addr); } catch {}
    });
  },

  /** Listen for address selection changes across screens */
  onSelectedAddressChange(cb: (addr: Address | null) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },

  /** List all saved addresses */
  async list(): Promise<Address[]> {
    const { data } = await api.get('/users/me/addresses');
    return data.data;
  },

  /** Create a new address */
  async create(input: CreateAddressInput): Promise<Address> {
    const { data } = await api.post('/users/me/addresses', input);
    const newAddr = data.data;
    if (newAddr) {
      this.setActiveDeliveryAddress(newAddr);
    }
    return newAddr;
  },

  /** Update an existing address */
  async update(id: string, input: UpdateAddressInput): Promise<Address> {
    const { data } = await api.put(`/users/me/addresses/${id}`, input);
    const updated = data.data;
    if (activeSelectedAddress?.id === id) {
      this.setActiveDeliveryAddress(updated);
    }
    return updated;
  },

  /** Delete an address */
  async delete(id: string): Promise<void> {
    await api.delete(`/users/me/addresses/${id}`);
    if (activeSelectedAddress?.id === id) {
      this.setActiveDeliveryAddress(null);
    }
  },

  /** Set an address as default */
  async setDefault(id: string): Promise<Address> {
    const { data } = await api.post(`/users/me/addresses/${id}/default`);
    const def = data.data;
    if (def) {
      this.setActiveDeliveryAddress(def);
    }
    return def;
  },

  /** Set shipping address on an order (uses saved address) */
  async setOrderShippingAddress(orderId: string, addressId: string): Promise<void> {
    await api.patch(`/orders/${orderId}/address`, { addressId });
  },
};

