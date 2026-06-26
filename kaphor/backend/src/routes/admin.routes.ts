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
} from '../controllers/admin.controller';

export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

adminRouter.get('/monitor', getAdminMonitor);
adminRouter.get('/bespoke-requests', listAdminBespokeRequests);
adminRouter.patch('/bespoke-requests/:id', updateBespokeRequestStatus);
adminRouter.get('/swaps', listAdminSwaps);
adminRouter.get('/rentals', listAdminRentals);
adminRouter.get('/users', listAdminUsers);
adminRouter.patch('/users/:id', updateAdminUser);
adminRouter.delete('/users/:id', deleteAdminUser);
adminRouter.get('/garments', listAdminGarments);
