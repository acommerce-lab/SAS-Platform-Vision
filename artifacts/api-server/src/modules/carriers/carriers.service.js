import prisma from '../../../../../lib/db/src/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';
import { logger } from '../../lib/logger.js';
import { sendMail, accountActivatedEmail } from '../../providers/mail/mail.provider.js';

// ─── Listing ──────────────────────────────────────────────────────────────────

export async function listCarriers({ status, vehicle_type, vehicle_category, page = 1, limit = 20 }) {
  const where = {};
  if (status) where.status = status.toUpperCase().replace('_', '');
  if (vehicle_type || vehicle_category) {
    where.vehicles = {
      some: {
        ...(vehicle_type ? { vehicle_type: vehicle_type.toUpperCase() } : {}),
        ...(vehicle_category ? { vehicle_category: vehicle_category.toUpperCase() } : {}),
      },
    };
  }

  const [data, total] = await Promise.all([
    prisma.carrier.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.carrier.count({ where }),
  ]);

  return { data: data.map(formatCarrier), total, page, limit };
}

export async function getCarrier(carrierId) {
  const carrier = await prisma.carrier.findUnique({
    where: { id: carrierId },
    include: { vehicles: true, drivers: true },
  });
  if (!carrier) throw new AppError(ErrorCodes.CARRIER_NOT_FOUND, 'Carrier not found');
  return { ...formatCarrier(carrier), vehicles: carrier.vehicles.map(formatVehicle), drivers: carrier.drivers.map(formatDriver) };
}

// ─── Status Management ────────────────────────────────────────────────────────

export async function activateCarrier(carrierId) {
  const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } });
  if (!carrier) throw new AppError(ErrorCodes.CARRIER_NOT_FOUND, 'Carrier not found');
  if (carrier.status === 'ACTIVE') throw new AppError(ErrorCodes.CARRIER_ALREADY_ACTIVE, 'Carrier already active');

  const updated = await prisma.carrier.update({
    where: { id: carrierId },
    data: { status: 'ACTIVE' },
  });

  // Send activation email
  const mail = accountActivatedEmail(carrier.name);
  await sendMail({ to: carrier.email, ...mail });

  logger.info({ carrierId }, 'Carrier activated');
  return formatCarrier(updated);
}

export async function disableCarrier(carrierId) {
  const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } });
  if (!carrier) throw new AppError(ErrorCodes.CARRIER_NOT_FOUND, 'Carrier not found');
  if (carrier.status === 'DISABLED') throw new AppError(ErrorCodes.CARRIER_ALREADY_DISABLED, 'Carrier already disabled');

  const updated = await prisma.carrier.update({
    where: { id: carrierId },
    data: { status: 'DISABLED' },
  });

  logger.info({ carrierId }, 'Carrier disabled');
  return formatCarrier(updated);
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export async function listVehicles(carrierId) {
  await requireCarrier(carrierId);
  const vehicles = await prisma.vehicle.findMany({ where: { carrier_id: carrierId }, orderBy: { created_at: 'desc' } });
  return vehicles.map(formatVehicle);
}

export async function addVehicle(carrierId, { vehicle_type, vehicle_category, plate_number }) {
  await requireCarrier(carrierId);
  const vehicle = await prisma.vehicle.create({
    data: {
      carrier_id: carrierId,
      vehicle_type: vehicle_type.toUpperCase().replace(' ', '_'),
      vehicle_category: vehicle_category.toUpperCase().replace(' ', '_'),
      plate_number: plate_number ?? null,
    },
  });
  logger.info({ carrierId, vehicleId: vehicle.id }, 'Vehicle added');
  return formatVehicle(vehicle);
}

export async function removeVehicle(carrierId, vehicleId) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, carrier_id: carrierId } });
  if (!vehicle) throw new AppError(ErrorCodes.VEHICLE_NOT_FOUND, 'Vehicle not found');

  // Check for active shipments
  const activeShipment = await prisma.shipment.findFirst({
    where: {
      vehicle_id: vehicleId,
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
    },
  });
  if (activeShipment) {
    throw new AppError(ErrorCodes.VEHICLE_ASSIGNED_TO_SHIPMENT, 'Vehicle is assigned to an active shipment');
  }

  await prisma.vehicle.delete({ where: { id: vehicleId } });
  return { success: true };
}

// ─── Drivers ──────────────────────────────────────────────────────────────────

export async function listDrivers(carrierId) {
  await requireCarrier(carrierId);
  const drivers = await prisma.driver.findMany({ where: { carrier_id: carrierId }, orderBy: { created_at: 'desc' } });
  return drivers.map(formatDriver);
}

export async function createDriver(carrierId, { name, phone }) {
  await requireCarrier(carrierId);
  const driver = await prisma.driver.create({
    data: { carrier_id: carrierId, name, phone: phone ?? null, status: 'ACTIVE' },
  });
  logger.info({ carrierId, driverId: driver.id }, 'Driver created');
  return formatDriver(driver);
}

export async function updateDriver(carrierId, driverId, data) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, carrier_id: carrierId } });
  if (!driver) throw new AppError(ErrorCodes.DRIVER_NOT_FOUND, 'Driver not found');

  const updated = await prisma.driver.update({
    where: { id: driverId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.status !== undefined ? { status: data.status.toUpperCase() } : {}),
    },
  });
  return formatDriver(updated);
}

export async function removeDriver(carrierId, driverId) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, carrier_id: carrierId } });
  if (!driver) throw new AppError(ErrorCodes.DRIVER_NOT_FOUND, 'Driver not found');

  const activeShipment = await prisma.shipment.findFirst({
    where: {
      driver_id: driverId,
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
    },
  });
  if (activeShipment) {
    throw new AppError(ErrorCodes.DRIVER_ASSIGNED_TO_SHIPMENT, 'Driver is assigned to an active shipment');
  }

  await prisma.driver.delete({ where: { id: driverId } });
  return { success: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireCarrier(carrierId) {
  const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } });
  if (!carrier) throw new AppError(ErrorCodes.CARRIER_NOT_FOUND, 'Carrier not found');
  return carrier;
}

export function formatCarrier(c) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    status: c.status.toLowerCase().replace('_', '_'),
    created_at: c.created_at.toISOString(),
  };
}

export function formatVehicle(v) {
  return {
    id: v.id,
    carrier_id: v.carrier_id,
    vehicle_type: v.vehicle_type.toLowerCase(),
    vehicle_category: v.vehicle_category.toLowerCase(),
    plate_number: v.plate_number,
    created_at: v.created_at.toISOString(),
  };
}

export function formatDriver(d) {
  return {
    id: d.id,
    carrier_id: d.carrier_id,
    name: d.name,
    phone: d.phone,
    status: d.status.toLowerCase(),
    created_at: d.created_at.toISOString(),
  };
}

// ─── Eligible carriers for shipment ──────────────────────────────────────────

export async function getEligibleCarriersForShipment(vehicleType, vehicleCategory) {
  const carriers = await prisma.carrier.findMany({
    where: {
      status: 'ACTIVE',
      vehicles: {
        some: {
          vehicle_type: vehicleType.toUpperCase().replace(' ', '_'),
          vehicle_category: vehicleCategory.toUpperCase().replace(' ', '_'),
        },
      },
    },
    include: {
      vehicles: {
        where: {
          vehicle_type: vehicleType.toUpperCase().replace(' ', '_'),
          vehicle_category: vehicleCategory.toUpperCase().replace(' ', '_'),
        },
      },
    },
  });

  return carriers.map((c) => ({
    ...formatCarrier(c),
    matching_vehicles: c.vehicles.map(formatVehicle),
  }));
}
