import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';
import {
  listShipments, getShipmentDetail, createShipment,
  assignCarrier, calculatePricing, sendPricing, approvePricing, rejectPricing,
  startShipment, deliverShipment, cancelShipment,
  getStatusHistory, getEligibleCarriers, getWaybill, downloadWaybillPdf, getDashboardStats,
} from './shipments.service.js';

const router = Router();

const ShipmentInputSchema = z.object({
  pickup_location: z.string().min(3),
  dropoff_location: z.string().min(3),
  cargo_description: z.string().optional().nullable(),
  required_vehicle_type: z.enum(['flatbed', 'refrigerated', 'cage', 'tow_truck', 'curtain_side', 'container', 'low_bed', 'other']),
  required_vehicle_category: z.enum(['dyna', 'single_truck', 'trailer', 'semi_trailer', 'road_train', 'other']),
  shipper_customer_id: z.string().optional().nullable(),
  product_id: z.string().optional().nullable(),
});

const AssignCarrierSchema = z.object({
  carrier_id: z.string(),
  driver_id: z.string(),
  vehicle_id: z.string(),
});

// Dashboard
router.get('/admin/dashboard', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { res.json(await getDashboardStats()); } catch (err) { next(err); }
});

// Shipments CRUD
router.get('/shipments', requireAuth, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    res.json(await listShipments({ status, page: page ? +page : 1, limit: limit ? +limit : 20, userId: req.user.id, role: req.user.role }));
  } catch (err) { next(err); }
});

router.post('/shipments', requireAuth, requireRole('shipper'), validate({ body: ShipmentInputSchema }), async (req, res, next) => {
  try { res.status(201).json(await createShipment(req.user.id, req.body)); } catch (err) { next(err); }
});

router.get('/shipments/:shipmentId', requireAuth, async (req, res, next) => {
  try { res.json(await getShipmentDetail(req.params.shipmentId, req.user.role)); } catch (err) { next(err); }
});

// Workflow transitions
router.patch('/shipments/:shipmentId/assign-carrier', requireAuth, requireRole('admin'), validate({ body: AssignCarrierSchema }), async (req, res, next) => {
  try { res.json(await assignCarrier(req.params.shipmentId, req.body, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/shipments/:shipmentId/calculate-pricing', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { res.json(await calculatePricing(req.params.shipmentId, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/shipments/:shipmentId/send-pricing', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { res.json(await sendPricing(req.params.shipmentId, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/shipments/:shipmentId/approve-pricing', requireAuth, requireRole('shipper'), async (req, res, next) => {
  try { res.json(await approvePricing(req.params.shipmentId, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/shipments/:shipmentId/reject-pricing', requireAuth, requireRole('shipper'), async (req, res, next) => {
  try { res.json(await rejectPricing(req.params.shipmentId, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/shipments/:shipmentId/start', requireAuth, requireRole('carrier'), async (req, res, next) => {
  try { res.json(await startShipment(req.params.shipmentId, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/shipments/:shipmentId/deliver', requireAuth, requireRole('carrier'), async (req, res, next) => {
  try { res.json(await deliverShipment(req.params.shipmentId, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/shipments/:shipmentId/cancel', requireAuth, async (req, res, next) => {
  try { res.json(await cancelShipment(req.params.shipmentId, req.user.id, req.user.role, req.body?.reason)); } catch (err) { next(err); }
});

router.get('/shipments/:shipmentId/status-history', requireAuth, async (req, res, next) => {
  try { res.json(await getStatusHistory(req.params.shipmentId)); } catch (err) { next(err); }
});

router.get('/shipments/:shipmentId/eligible-carriers', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { res.json(await getEligibleCarriers(req.params.shipmentId)); } catch (err) { next(err); }
});

// Waybills
router.get('/shipments/:shipmentId/waybill', requireAuth, async (req, res, next) => {
  try { res.json(await getWaybill(req.params.shipmentId)); } catch (err) { next(err); }
});

router.get('/shipments/:shipmentId/waybill/download', requireAuth, async (req, res, next) => {
  try {
    const pdf = await downloadWaybillPdf(req.params.shipmentId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="waybill-${req.params.shipmentId}.pdf"`);
    res.send(pdf);
  } catch (err) { next(err); }
});

export default router;
