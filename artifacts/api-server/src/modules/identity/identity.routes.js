import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  handleRegisterCarrier,
  handleRegisterShipper,
  handleLogin,
  handleLogout,
  handleGetCurrentUser,
} from './identity.controller.js';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────
const VehicleInputSchema = z.object({
  vehicle_type: z.enum(['flatbed', 'refrigerated', 'cage', 'tow_truck', 'curtain_side', 'container', 'low_bed', 'other']),
  vehicle_category: z.enum(['dyna', 'single_truck', 'trailer', 'semi_trailer', 'road_train', 'other']),
  plate_number: z.string().optional().nullable(),
});

const RegisterCarrierSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional().nullable(),
  vehicles: z.array(VehicleInputSchema).min(1, 'At least one vehicle required'),
});

const RegisterShipperSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional().nullable(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post('/register/carrier', validate({ body: RegisterCarrierSchema }), handleRegisterCarrier);
router.post('/register/shipper', validate({ body: RegisterShipperSchema }), handleRegisterShipper);
router.post('/login', validate({ body: LoginSchema }), handleLogin);
router.post('/logout', requireAuth, handleLogout);
router.get('/me', requireAuth, handleGetCurrentUser);

export default router;
