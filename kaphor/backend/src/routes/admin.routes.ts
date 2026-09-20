import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getAdminMonitor,
  listAdminBespokeRequests,
  updateBespokeRequestStatus,
  listAdminSwaps,
  listAdminRentals,
  listAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  listAdminGarments,
  getAdminAnalytics,
  getAdminHealth,
  listAdminOrders,
  getAdminOrder,
  listAdminReports,
  updateAdminReport,
  listAdminUpcycles,
  updateAdminUpcycle,
  listAdminVerifications,
  updateAdminVerification,
  listAdminAudit,
  updateAdminSwap,
  listAdminCircularRequests,
  updateAdminCircularRequest,
} from '../controllers/admin.controller';

export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

adminRouter.get('/monitor', getAdminMonitor);
adminRouter.get('/analytics', getAdminAnalytics);
adminRouter.get('/health', getAdminHealth);
adminRouter.get('/audit', listAdminAudit);
adminRouter.get('/orders', listAdminOrders);
adminRouter.get('/orders/:id', getAdminOrder);
adminRouter.get('/reports', listAdminReports);
adminRouter.patch('/reports/:id', updateAdminReport);
adminRouter.get('/upcycles', listAdminUpcycles);
adminRouter.patch('/upcycles/:id', updateAdminUpcycle);
adminRouter.get('/verifications', listAdminVerifications);
adminRouter.patch('/verifications/:id', updateAdminVerification);
adminRouter.get('/circular-requests', listAdminCircularRequests);
adminRouter.patch('/circular-requests/:id', updateAdminCircularRequest);
adminRouter.get('/bespoke-requests', listAdminBespokeRequests);
adminRouter.patch('/bespoke-requests/:id', updateBespokeRequestStatus);
adminRouter.get('/swaps', listAdminSwaps);
adminRouter.patch('/swaps/:id', updateAdminSwap);
adminRouter.get('/rentals', listAdminRentals);
adminRouter.get('/users', listAdminUsers);
adminRouter.patch('/users/:id', updateAdminUser);
adminRouter.delete('/users/:id', deleteAdminUser);
adminRouter.get('/garments', listAdminGarments);
