import api from './api';

export interface VerificationData {
  id: string;
  isVerified: boolean;
  verificationStatus: 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
  verificationType?: string | null;
  idNumberLast4?: string | null;
  verificationSubmittedAt?: string | null;
}

export const verificationService = {
  async getStatus(): Promise<VerificationData | null> {
    const { data } = await api.get<{ data: VerificationData | null }>('/users/me/verification-status');
    return data.data;
  },

  async submitVerification(payload: {
    verificationType: string;
    idNumber: string;
    documentUrl?: string;
  }): Promise<{ data: VerificationData; message: string }> {
    const { data } = await api.post<{ data: VerificationData; message: string }>('/users/me/verify-identity', payload);
    return data;
  },
};
