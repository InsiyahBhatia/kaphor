import type { PaginationMeta } from '../utils/pagination';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}
