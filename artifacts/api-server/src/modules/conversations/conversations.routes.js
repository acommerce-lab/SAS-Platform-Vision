import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { listConversations, createConversation, listMessages, sendMessage } from './conversations.service.js';

const router = Router();

const ConversationInputSchema = z.object({
  shipment_id: z.string().optional().nullable(),
  participant_ids: z.array(z.string()).optional(),
});

const MessageInputSchema = z.object({ content: z.string().min(1) });

router.get('/conversations', requireAuth, async (req, res, next) => {
  try { res.json(await listConversations(req.user.id)); } catch (err) { next(err); }
});

router.post('/conversations', requireAuth, validate({ body: ConversationInputSchema }), async (req, res, next) => {
  try { res.status(201).json(await createConversation(req.body, req.user.id, req.user.role)); } catch (err) { next(err); }
});

router.get('/conversations/:conversationId/messages', requireAuth, async (req, res, next) => {
  try { res.json(await listMessages(req.params.conversationId, req.user.id)); } catch (err) { next(err); }
});

router.post('/conversations/:conversationId/messages', requireAuth, validate({ body: MessageInputSchema }), async (req, res, next) => {
  try { res.status(201).json(await sendMessage(req.params.conversationId, req.body.content, req.user.id, req.user.role)); } catch (err) { next(err); }
});

export default router;
