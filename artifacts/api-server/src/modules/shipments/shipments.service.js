import { randomUUID } from 'crypto';
import prisma from '../../../../../lib/db/src/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';
import { logger } from '../../lib/logger.js';
import {
  isValidTransition,
  canActorTransition,
  getAvailableActions,
  ShipmentStatus,
} from './workflow/states.js';
import { calculateDistanceKm, calculatePrice } from '../../providers/maps/maps.provider.js';
import { getEligibleCarriersForShipment, formatCarrier, formatVehicle, formatDriver } from '../carriers/carriers.service.js';
import { formatShipper } from '../shippers/shippers.service.js';

const SHIPMENT_FULL_INCLUDE = {
  carrier: true,
  driver: true,
  vehicle: true,
  shipper: true,
  shipper_customer: true,
  product: true,
  waybill: true,
};

// ─── Listing ──────────────────────────────────────────────────────────────────

export async function listShipments({ status, page = 1, limit = 20, userId, role }) {
  const where = {};
  if (status) where.status = status.toUpperCase().replace('-', '_');

  if (role === 'carrier') where.carrier_id = userId;
  if (role === 'shipper') where.shipper_id = userId;

  const [data, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.shipment.count({ where }),
  ]);

  return { data: data.map(formatShipment), total, page, limit };
}

export async function getShipmentDetail(shipmentId, userRole) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: SHIPMENT_FULL_INCLUDE,
  });
  if (!shipment) throw new AppError(ErrorCodes.SHIPMENT_NOT_FOUND, 'Shipment not found');

  const available_actions = getAvailableActions(shipment.status, userRole);

  return {
    ...formatShipment(shipment),
    available_actions,
    shipper: shipment.shipper ? formatShipper(shipment.shipper) : null,
    carrier: shipment.carrier ? formatCarrier(shipment.carrier) : null,
    driver: shipment.driver ? formatDriver(shipment.driver) : null,
    vehicle: shipment.vehicle ? formatVehicle(shipment.vehicle) : null,
    shipper_customer: shipment.shipper_customer ? formatCustomer(shipment.shipper_customer) : null,
    product: shipment.product ? formatProduct(shipment.product) : null,
    waybill: shipment.waybill ? formatWaybill(shipment.waybill) : null,
  };
}

// ─── Creation ─────────────────────────────────────────────────────────────────

export async function createShipment(shipperId, data) {
  const reference_number = `SAS-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

  const shipment = await prisma.shipment.create({
    data: {
      reference_number,
      pickup_location: data.pickup_location,
      dropoff_location: data.dropoff_location,
      cargo_description: data.cargo_description ?? null,
      required_vehicle_type: data.required_vehicle_type.toUpperCase().replace(' ', '_'),
      required_vehicle_category: data.required_vehicle_category.toUpperCase().replace(' ', '_'),
      shipper_id: shipperId,
      shipper_customer_id: data.shipper_customer_id ?? null,
      product_id: data.product_id ?? null,
      status: 'REQUESTED',
    },
  });

  await recordStatusChange(shipment.id, null, 'REQUESTED', shipperId, 'SHIPPER');

  logger.info({ shipmentId: shipment.id, reference_number }, 'Shipment created');
  return formatShipment(shipment);
}

// ─── Workflow Transitions ─────────────────────────────────────────────────────

export async function assignCarrier(shipmentId, { carrier_id, driver_id, vehicle_id }, actorId, actorRole) {
  const shipment = await requireShipment(shipmentId);

  // Allow assignment from REQUESTED or PRICING_REJECTED
  const allowedFromStatuses = [ShipmentStatus.REQUESTED, ShipmentStatus.PRICING_REJECTED];
  if (!allowedFromStatuses.includes(shipment.status)) {
    throw AppError.invalidTransition(shipment.status, ShipmentStatus.CARRIER_ASSIGNED);
  }

  if (!canActorTransition(shipment.status, ShipmentStatus.CARRIER_ASSIGNED, actorRole)) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Only admin can assign carriers');
  }

  // Verify vehicle belongs to carrier
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicle_id, carrier_id } });
  if (!vehicle) throw new AppError(ErrorCodes.VEHICLE_NOT_FOUND, 'Vehicle not found for this carrier');

  const driver = await prisma.driver.findFirst({ where: { id: driver_id, carrier_id } });
  if (!driver) throw new AppError(ErrorCodes.DRIVER_NOT_FOUND, 'Driver not found for this carrier');

  // Verify vehicle type matches
  if (
    vehicle.vehicle_type !== shipment.required_vehicle_type ||
    vehicle.vehicle_category !== shipment.required_vehicle_category
  ) {
    throw new AppError(ErrorCodes.SHIPMENT_CARRIER_NOT_ELIGIBLE, 'Vehicle type/category does not match shipment requirements');
  }

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: { carrier_id, driver_id, vehicle_id, status: 'CARRIER_ASSIGNED' },
  });

  await recordStatusChange(shipmentId, shipment.status, 'CARRIER_ASSIGNED', actorId, actorRole);
  return formatShipment(updated);
}

export async function calculatePricing(shipmentId, actorId, actorRole) {
  const shipment = await requireShipment(shipmentId);
  assertTransition(shipment.status, ShipmentStatus.PRICING_CALCULATED, actorRole);

  const distanceKm = await calculateDistanceKm(shipment.pickup_location, shipment.dropoff_location);
  const quotedPrice = calculatePrice(distanceKm, shipment.required_vehicle_category.toLowerCase());

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: { distance_km: distanceKm, quoted_price: quotedPrice, currency: 'SAR', status: 'PRICING_CALCULATED' },
  });

  await recordStatusChange(shipmentId, shipment.status, 'PRICING_CALCULATED', actorId, actorRole);
  logger.info({ shipmentId, distanceKm, quotedPrice }, 'Pricing calculated');
  return formatShipment(updated);
}

export async function sendPricing(shipmentId, actorId, actorRole) {
  const shipment = await requireShipment(shipmentId);
  assertTransition(shipment.status, ShipmentStatus.PRICING_SENT, actorRole);

  const updated = await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'PRICING_SENT' } });
  await recordStatusChange(shipmentId, shipment.status, 'PRICING_SENT', actorId, actorRole);

  // Notify shipper
  await createNotification(shipment.shipper_id, 'SHIPPER', 'Pricing Ready', `Pricing for shipment ${shipment.reference_number} is ready for your review.`, shipmentId);

  return formatShipment(updated);
}

export async function approvePricing(shipmentId, actorId, actorRole) {
  const shipment = await requireShipment(shipmentId);
  assertTransition(shipment.status, ShipmentStatus.PRICING_APPROVED, actorRole);

  const now = new Date();
  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: 'PRICING_APPROVED', price_approved_at: now },
  });

  await recordStatusChange(shipmentId, shipment.status, 'PRICING_APPROVED', actorId, actorRole);

  // Auto-issue waybill after pricing approval
  await issueWaybill(updated, actorId, actorRole);

  const final = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  return formatShipment(final);
}

export async function rejectPricing(shipmentId, actorId, actorRole) {
  const shipment = await requireShipment(shipmentId);
  assertTransition(shipment.status, ShipmentStatus.PRICING_REJECTED, actorRole);

  const updated = await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'PRICING_REJECTED' } });
  await recordStatusChange(shipmentId, shipment.status, 'PRICING_REJECTED', actorId, actorRole);

  // Notify admin
  await createNotification(actorId, 'ADMIN', 'Pricing Rejected', `Shipper rejected pricing for shipment ${shipment.reference_number}. Reassignment needed.`, shipmentId);

  return formatShipment(updated);
}

export async function startShipment(shipmentId, actorId, actorRole) {
  const shipment = await requireShipment(shipmentId);
  assertTransition(shipment.status, ShipmentStatus.IN_TRANSIT, actorRole);

  const updated = await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'IN_TRANSIT' } });
  await recordStatusChange(shipmentId, shipment.status, 'IN_TRANSIT', actorId, actorRole);
  return formatShipment(updated);
}

export async function deliverShipment(shipmentId, actorId, actorRole) {
  const shipment = await requireShipment(shipmentId);
  assertTransition(shipment.status, ShipmentStatus.DELIVERED, actorRole);

  const updated = await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'DELIVERED' } });
  await recordStatusChange(shipmentId, shipment.status, 'DELIVERED', actorId, actorRole);

  if (shipment.shipper_id) {
    await createNotification(shipment.shipper_id, 'SHIPPER', 'Shipment Delivered', `Shipment ${shipment.reference_number} has been delivered.`, shipmentId);
  }

  return formatShipment(updated);
}

export async function cancelShipment(shipmentId, actorId, actorRole, reason) {
  const shipment = await requireShipment(shipmentId);
  assertTransition(shipment.status, ShipmentStatus.CANCELLED, actorRole);

  const updated = await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'CANCELLED' } });
  await recordStatusChange(shipmentId, shipment.status, 'CANCELLED', actorId, actorRole, reason);
  return formatShipment(updated);
}

export async function getStatusHistory(shipmentId) {
  await requireShipment(shipmentId);
  const changes = await prisma.shipmentStatusChange.findMany({
    where: { shipment_id: shipmentId },
    orderBy: { created_at: 'asc' },
  });
  return changes.map((c) => ({
    id: c.id,
    shipment_id: c.shipment_id,
    previous_status: c.previous_status ? c.previous_status.toLowerCase() : null,
    new_status: c.new_status.toLowerCase(),
    changed_by_id: c.changed_by_id,
    changed_by_role: c.changed_by_role.toLowerCase(),
    notes: c.notes,
    created_at: c.created_at.toISOString(),
  }));
}

export async function getEligibleCarriers(shipmentId) {
  const shipment = await requireShipment(shipmentId);
  return getEligibleCarriersForShipment(shipment.required_vehicle_type, shipment.required_vehicle_category);
}

// ─── Waybill ─────────────────────────────────────────────────────────────────

async function issueWaybill(shipment, actorId, actorRole) {
  const waybill_number = `WB-${Date.now()}-${randomUUID().slice(0, 4).toUpperCase()}`;

  const waybill = await prisma.waybill.create({
    data: {
      shipment_id: shipment.id,
      waybill_number,
      issued_at: new Date(),
    },
  });

  await prisma.shipment.update({ where: { id: shipment.id }, data: { status: 'WAYBILL_ISSUED' } });
  await recordStatusChange(shipment.id, 'PRICING_APPROVED', 'WAYBILL_ISSUED', actorId, actorRole, 'Auto-issued after pricing approval');

  logger.info({ shipmentId: shipment.id, waybill_number }, 'Waybill issued');
  return waybill;
}

export async function getWaybill(shipmentId) {
  const waybill = await prisma.waybill.findUnique({ where: { shipment_id: shipmentId } });
  if (!waybill) throw new AppError(ErrorCodes.WAYBILL_NOT_FOUND, 'Waybill not yet issued');
  return formatWaybill(waybill);
}

export async function downloadWaybillPdf(shipmentId) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { waybill: true },
  });
  if (!shipment?.waybill) throw new AppError(ErrorCodes.WAYBILL_NOT_FOUND, 'Waybill not found');

  const { generateWaybillPdf } = await import('../../providers/pdf/pdf.provider.js');
  return generateWaybillPdf({ shipment, waybill: shipment.waybill });
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [shipmentsByStatus, pendingCarriers, pendingShippers, totalCarriers, totalShippers, recentShipments] = await Promise.all([
    prisma.shipment.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.carrier.count({ where: { status: 'PENDING_ACTIVATION' } }),
    prisma.shipper.count({ where: { status: 'PENDING_ACTIVATION' } }),
    prisma.carrier.count(),
    prisma.shipper.count(),
    prisma.shipment.findMany({ take: 10, orderBy: { created_at: 'desc' } }),
  ]);

  const statusMap = {};
  for (const row of shipmentsByStatus) {
    statusMap[row.status.toLowerCase()] = row._count.id;
  }

  return {
    shipments_by_status: statusMap,
    pending_activations: { carriers: pendingCarriers, shippers: pendingShippers },
    total_carriers: totalCarriers,
    total_shippers: totalShippers,
    recent_shipments: recentShipments.map(formatShipment),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireShipment(shipmentId) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new AppError(ErrorCodes.SHIPMENT_NOT_FOUND, 'Shipment not found');
  return shipment;
}

function assertTransition(from, to, role) {
  if (!isValidTransition(from, to)) {
    throw AppError.invalidTransition(from, to);
  }
  if (!canActorTransition(from, to, role)) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, `Role '${role}' cannot perform this transition`);
  }
}

async function recordStatusChange(shipmentId, previousStatus, newStatus, changedById, changedByRole, notes = null) {
  await prisma.shipmentStatusChange.create({
    data: {
      shipment_id: shipmentId,
      previous_status: previousStatus ?? null,
      new_status: newStatus,
      changed_by_id: changedById,
      changed_by_role: changedByRole.toUpperCase(),
      notes,
    },
  });
}

async function createNotification(userId, userRole, title, message, relatedShipmentId = null) {
  await prisma.notification.create({
    data: { user_id: userId, user_role: userRole, title, message, related_shipment_id: relatedShipmentId },
  });
}

export function formatShipment(s) {
  return {
    id: s.id,
    reference_number: s.reference_number,
    pickup_location: s.pickup_location,
    dropoff_location: s.dropoff_location,
    cargo_description: s.cargo_description,
    required_vehicle_type: s.required_vehicle_type.toLowerCase(),
    required_vehicle_category: s.required_vehicle_category.toLowerCase(),
    shipper_id: s.shipper_id,
    shipper_customer_id: s.shipper_customer_id,
    product_id: s.product_id,
    carrier_id: s.carrier_id,
    driver_id: s.driver_id,
    vehicle_id: s.vehicle_id,
    quoted_price: s.quoted_price ? parseFloat(s.quoted_price.toString()) : null,
    currency: s.currency,
    distance_km: s.distance_km ? parseFloat(s.distance_km.toString()) : null,
    price_approved_at: s.price_approved_at ? s.price_approved_at.toISOString() : null,
    status: s.status.toLowerCase(),
    created_at: s.created_at.toISOString(),
  };
}

function formatCustomer(c) {
  return { id: c.id, shipper_id: c.shipper_id, name: c.name, phone: c.phone, created_at: c.created_at.toISOString() };
}
function formatProduct(p) {
  return { id: p.id, shipper_id: p.shipper_id, name: p.name, description: p.description, created_at: p.created_at.toISOString() };
}
export function formatWaybill(w) {
  return { id: w.id, shipment_id: w.shipment_id, waybill_number: w.waybill_number, pdf_url: w.pdf_url, issued_at: w.issued_at.toISOString(), created_at: w.created_at.toISOString() };
}
