import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';
import { listTickets, createTicket, getTicket, updateTicket, replyToTicket } from './support.service.js';

const router = Router();

const TicketInputSchema = z.object({ subject: z.string().min(5), message: z.string().min(10) });
const TicketUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assigned_to_id: z.string().nullable().optional(),
});
const ReplySchema = z.object({ content: z.string().min(1) });

router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    res.json(await listTickets({ userId: req.user.id, role: req.user.role, status, page: page ? +page : 1, limit: limit ? +limit : 20 }));
  } catch (err) { next(err); }
});

router.post('/tickets', requireAuth, validate({ body: TicketInputSchema }), async (req, res, next) => {
  try { res.status(201).json(await createTicket(req.body, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.get('/tickets/:ticketId', requireAuth, async (req, res, next) => {
  try { res.json(await getTicket(req.params.ticketId, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.patch('/tickets/:ticketId', requireAuth, requireRole('admin'), validate({ body: TicketUpdateSchema }), async (req, res, next) => {
  try { res.json(await updateTicket(req.params.ticketId, req.body)); } catch (err) { next(err); }
});

router.post('/tickets/:ticketId/messages', requireAuth, validate({ body: ReplySchema }), async (req, res, next) => {
  try { res.status(201).json(await replyToTicket(req.params.ticketId, req.body.content, req.user.id, req.user.role)); } catch (err) { next(err); }
});

export default router;
