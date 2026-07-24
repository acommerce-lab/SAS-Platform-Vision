import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';
import {
  listCarriers,
  getCarrier,
  activateCarrier,
  disableCarrier,
  listVehicles,
  addVehicle,
  removeVehicle,
  listDrivers,
  createDriver,
  updateDriver,
  removeDriver,
} from './carriers.service.js';

const router = Router();

const VehicleInputSchema = z.object({
  vehicle_type: z.enum(['flatbed', 'refrigerated', 'cage', 'tow_truck', 'curtain_side', 'container', 'low_bed', 'other']),
  vehicle_category: z.enum(['dyna', 'single_truck', 'trailer', 'semi_trailer', 'road_train', 'other']),
  plate_number: z.string().optional().nullable(),
});

const DriverInputSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
});

const DriverUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  status: z.enum(['active', 'disabled']).optional(),
});

// ─── Carriers ─────────────────────────────────────────────────────────────────
router.get('/carriers', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status, vehicle_type, vehicle_category, page, limit } = req.query;
    const result = await listCarriers({
      status,
      vehicle_type,
      vehicle_category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/carriers/:carrierId', requireAuth, async (req, res, next) => {
  try {
    const result = await getCarrier(req.params.carrierId);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/carriers/:carrierId/activate', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await activateCarrier(req.params.carrierId);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/carriers/:carrierId/disable', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await disableCarrier(req.params.carrierId);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── Vehicles ─────────────────────────────────────────────────────────────────
router.get('/carriers/:carrierId/vehicles', requireAuth, async (req, res, next) => {
  try {
    const result = await listVehicles(req.params.carrierId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/carriers/:carrierId/vehicles', requireAuth, validate({ body: VehicleInputSchema }), async (req, res, next) => {
  try {
    const result = await addVehicle(req.params.carrierId, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.delete('/carriers/:carrierId/vehicles/:vehicleId', requireAuth, async (req, res, next) => {
  try {
    const result = await removeVehicle(req.params.carrierId, req.params.vehicleId);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── Drivers ──────────────────────────────────────────────────────────────────
router.get('/carriers/:carrierId/drivers', requireAuth, async (req, res, next) => {
  try {
    const result = await listDrivers(req.params.carrierId);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/carriers/:carrierId/drivers', requireAuth, validate({ body: DriverInputSchema }), async (req, res, next) => {
  try {
    const result = await createDriver(req.params.carrierId, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.patch('/carriers/:carrierId/drivers/:driverId', requireAuth, validate({ body: DriverUpdateSchema }), async (req, res, next) => {
  try {
    const result = await updateDriver(req.params.carrierId, req.params.driverId, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/carriers/:carrierId/drivers/:driverId', requireAuth, async (req, res, next) => {
  try {
    const result = await removeDriver(req.params.carrierId, req.params.driverId);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
