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

export const addressService = {
  /** List all saved addresses */
  async list(): Promise<Address[]> {
    const { data } = await api.get('/users/me/addresses');
    return data.data;
  },

  /** Create a new address */
  async create(input: CreateAddressInput): Promise<Address> {
    const { data } = await api.post('/users/me/addresses', input);
    return data.data;
  },

  /** Update an existing address */
  async update(id: string, input: UpdateAddressInput): Promise<Address> {
    const { data } = await api.put(`/users/me/addresses/${id}`, input);
    return data.data;
  },

  /** Delete an address */
  async delete(id: string): Promise<void> {
    await api.delete(`/users/me/addresses/${id}`);
  },

  /** Set an address as default */
  async setDefault(id: string): Promise<Address> {
    const { data } = await api.post(`/users/me/addresses/${id}/default`);
    return data.data;
  },

  /** Set shipping address on an order (uses saved address) */
  async setOrderShippingAddress(orderId: string, addressId: string): Promise<void> {
    await api.patch(`/orders/${orderId}/address`, { addressId });
  },
};
