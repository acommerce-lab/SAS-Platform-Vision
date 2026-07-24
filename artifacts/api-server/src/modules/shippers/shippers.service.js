import prisma from '../../../../../lib/db/src/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';
import { logger } from '../../lib/logger.js';
import { sendMail, accountActivatedEmail } from '../../providers/mail/mail.provider.js';

// ─── Listing ──────────────────────────────────────────────────────────────────
export async function listShippers({ status, page = 1, limit = 20 }) {
  const where = {};
  if (status) where.status = status.toUpperCase().replace('_', '');

  const [data, total] = await Promise.all([
    prisma.shipper.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' } }),
    prisma.shipper.count({ where }),
  ]);

  return { data: data.map(formatShipper), total, page, limit };
}

export async function getShipper(shipperId) {
  const shipper = await prisma.shipper.findUnique({ where: { id: shipperId } });
  if (!shipper) throw new AppError(ErrorCodes.SHIPPER_NOT_FOUND, 'Shipper not found');
  return formatShipper(shipper);
}

export async function activateShipper(shipperId) {
  const shipper = await prisma.shipper.findUnique({ where: { id: shipperId } });
  if (!shipper) throw new AppError(ErrorCodes.SHIPPER_NOT_FOUND, 'Shipper not found');
  if (shipper.status === 'ACTIVE') throw new AppError(ErrorCodes.SHIPPER_ALREADY_ACTIVE, 'Shipper already active');

  const updated = await prisma.shipper.update({ where: { id: shipperId }, data: { status: 'ACTIVE' } });
  const mail = accountActivatedEmail(shipper.name);
  await sendMail({ to: shipper.email, ...mail });

  logger.info({ shipperId }, 'Shipper activated');
  return formatShipper(updated);
}

export async function disableShipper(shipperId) {
  const shipper = await prisma.shipper.findUnique({ where: { id: shipperId } });
  if (!shipper) throw new AppError(ErrorCodes.SHIPPER_NOT_FOUND, 'Shipper not found');
  if (shipper.status === 'DISABLED') throw new AppError(ErrorCodes.SHIPPER_ALREADY_DISABLED, 'Shipper already disabled');

  const updated = await prisma.shipper.update({ where: { id: shipperId }, data: { status: 'DISABLED' } });
  logger.info({ shipperId }, 'Shipper disabled');
  return formatShipper(updated);
}

// ─── Customers ────────────────────────────────────────────────────────────────
export async function listCustomers(shipperId) {
  await requireShipper(shipperId);
  const customers = await prisma.shipperCustomer.findMany({ where: { shipper_id: shipperId }, orderBy: { created_at: 'desc' } });
  return customers.map(formatCustomer);
}

export async function createCustomer(shipperId, { name, phone }) {
  await requireShipper(shipperId);
  const customer = await prisma.shipperCustomer.create({
    data: { shipper_id: shipperId, name, phone: phone ?? null },
  });
  return formatCustomer(customer);
}

export async function updateCustomer(shipperId, customerId, data) {
  const customer = await prisma.shipperCustomer.findFirst({ where: { id: customerId, shipper_id: shipperId } });
  if (!customer) throw new AppError(ErrorCodes.NOT_FOUND, 'Customer not found');

  const updated = await prisma.shipperCustomer.update({
    where: { id: customerId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    },
  });
  return formatCustomer(updated);
}

export async function deleteCustomer(shipperId, customerId) {
  const customer = await prisma.shipperCustomer.findFirst({ where: { id: customerId, shipper_id: shipperId } });
  if (!customer) throw new AppError(ErrorCodes.NOT_FOUND, 'Customer not found');
  await prisma.shipperCustomer.delete({ where: { id: customerId } });
  return { success: true };
}

// ─── Products ─────────────────────────────────────────────────────────────────
export async function listProducts(shipperId) {
  await requireShipper(shipperId);
  const products = await prisma.product.findMany({ where: { shipper_id: shipperId }, orderBy: { created_at: 'desc' } });
  return products.map(formatProduct);
}

export async function createProduct(shipperId, { name, description }) {
  await requireShipper(shipperId);
  const product = await prisma.product.create({
    data: { shipper_id: shipperId, name, description: description ?? null },
  });
  return formatProduct(product);
}

export async function updateProduct(shipperId, productId, data) {
  const product = await prisma.product.findFirst({ where: { id: productId, shipper_id: shipperId } });
  if (!product) throw new AppError(ErrorCodes.NOT_FOUND, 'Product not found');

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
  return formatProduct(updated);
}

export async function deleteProduct(shipperId, productId) {
  const product = await prisma.product.findFirst({ where: { id: productId, shipper_id: shipperId } });
  if (!product) throw new AppError(ErrorCodes.NOT_FOUND, 'Product not found');
  await prisma.product.delete({ where: { id: productId } });
  return { success: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function requireShipper(shipperId) {
  const shipper = await prisma.shipper.findUnique({ where: { id: shipperId } });
  if (!shipper) throw new AppError(ErrorCodes.SHIPPER_NOT_FOUND, 'Shipper not found');
  return shipper;
}

export function formatShipper(s) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    status: s.status.toLowerCase(),
    created_at: s.created_at.toISOString(),
  };
}

function formatCustomer(c) {
  return {
    id: c.id,
    shipper_id: c.shipper_id,
    name: c.name,
    phone: c.phone,
    created_at: c.created_at.toISOString(),
  };
}

function formatProduct(p) {
  return {
    id: p.id,
    shipper_id: p.shipper_id,
    name: p.name,
    description: p.description,
    created_at: p.created_at.toISOString(),
  };
}
