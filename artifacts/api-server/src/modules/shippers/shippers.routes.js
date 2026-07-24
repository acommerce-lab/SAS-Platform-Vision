import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';
import {
  listShippers, getShipper, activateShipper, disableShipper,
  listCustomers, createCustomer, updateCustomer, deleteCustomer,
  listProducts, createProduct, updateProduct, deleteProduct,
} from './shippers.service.js';

const router = Router();

const CustomerInputSchema = z.object({ name: z.string().min(2), phone: z.string().optional().nullable() });
const CustomerUpdateSchema = z.object({ name: z.string().min(2).optional(), phone: z.string().optional().nullable() });
const ProductInputSchema = z.object({ name: z.string().min(2), description: z.string().optional().nullable() });
const ProductUpdateSchema = z.object({ name: z.string().min(2).optional(), description: z.string().optional().nullable() });

// Shippers
router.get('/shippers', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    res.json(await listShippers({ status, page: page ? +page : 1, limit: limit ? +limit : 20 }));
  } catch (err) { next(err); }
});

router.get('/shippers/:shipperId', requireAuth, async (req, res, next) => {
  try { res.json(await getShipper(req.params.shipperId)); } catch (err) { next(err); }
});

router.patch('/shippers/:shipperId/activate', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { res.json(await activateShipper(req.params.shipperId)); } catch (err) { next(err); }
});

router.patch('/shippers/:shipperId/disable', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { res.json(await disableShipper(req.params.shipperId)); } catch (err) { next(err); }
});

// Customers
router.get('/shippers/:shipperId/customers', requireAuth, async (req, res, next) => {
  try { res.json(await listCustomers(req.params.shipperId)); } catch (err) { next(err); }
});
router.post('/shippers/:shipperId/customers', requireAuth, validate({ body: CustomerInputSchema }), async (req, res, next) => {
  try { res.status(201).json(await createCustomer(req.params.shipperId, req.body)); } catch (err) { next(err); }
});
router.patch('/shippers/:shipperId/customers/:customerId', requireAuth, validate({ body: CustomerUpdateSchema }), async (req, res, next) => {
  try { res.json(await updateCustomer(req.params.shipperId, req.params.customerId, req.body)); } catch (err) { next(err); }
});
router.delete('/shippers/:shipperId/customers/:customerId', requireAuth, async (req, res, next) => {
  try { res.json(await deleteCustomer(req.params.shipperId, req.params.customerId)); } catch (err) { next(err); }
});

// Products
router.get('/shippers/:shipperId/products', requireAuth, async (req, res, next) => {
  try { res.json(await listProducts(req.params.shipperId)); } catch (err) { next(err); }
});
router.post('/shippers/:shipperId/products', requireAuth, validate({ body: ProductInputSchema }), async (req, res, next) => {
  try { res.status(201).json(await createProduct(req.params.shipperId, req.body)); } catch (err) { next(err); }
});
router.patch('/shippers/:shipperId/products/:productId', requireAuth, validate({ body: ProductUpdateSchema }), async (req, res, next) => {
  try { res.json(await updateProduct(req.params.shipperId, req.params.productId, req.body)); } catch (err) { next(err); }
});
router.delete('/shippers/:shipperId/products/:productId', requireAuth, async (req, res, next) => {
  try { res.json(await deleteProduct(req.params.shipperId, req.params.productId)); } catch (err) { next(err); }
});

export default router;
