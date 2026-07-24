import prisma from '../../../../../lib/db/src/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';

export async function listConversations(userId) {
  const convos = await prisma.conversation.findMany({
    where: { participants: { some: { user_id: userId } } },
    include: { messages: { orderBy: { created_at: 'desc' }, take: 1 } },
    orderBy: { created_at: 'desc' },
  });
  return convos.map((c) => ({
    id: c.id,
    shipment_id: c.shipment_id,
    last_message: c.messages[0]?.content ?? null,
    created_at: c.created_at.toISOString(),
  }));
}

export async function createConversation({ shipment_id, participant_ids }, userId, userRole) {
  const convo = await prisma.conversation.create({
    data: {
      shipment_id: shipment_id ?? null,
      participants: {
        create: [
          { user_id: userId, user_role: userRole.toUpperCase() },
          ...(participant_ids ?? []).filter((id) => id !== userId).map((id) => ({
            user_id: id,
            user_role: 'ADMIN', // Default — override if known
          })),
        ],
      },
    },
  });
  return { id: convo.id, shipment_id: convo.shipment_id, last_message: null, created_at: convo.created_at.toISOString() };
}

export async function listMessages(conversationId, userId) {
  // Verify user is participant
  const participant = await prisma.conversationParticipant.findFirst({ where: { conversation_id: conversationId, user_id: userId } });
  if (!participant) throw new AppError(ErrorCodes.CONVERSATION_ACCESS_DENIED, 'Not a participant in this conversation');

  const messages = await prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: 'asc' },
  });
  return messages.map(fmtMsg);
}

export async function sendMessage(conversationId, content, userId, userRole) {
  const participant = await prisma.conversationParticipant.findFirst({ where: { conversation_id: conversationId, user_id: userId } });
  if (!participant) throw new AppError(ErrorCodes.CONVERSATION_ACCESS_DENIED, 'Not a participant in this conversation');

  const msg = await prisma.message.create({
    data: { conversation_id: conversationId, sender_id: userId, sender_role: userRole.toUpperCase(), content },
  });
  return fmtMsg(msg);
}

function fmtMsg(m) {
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    sender_role: m.sender_role.toLowerCase(),
    content: m.content,
    created_at: m.created_at.toISOString(),
  };
}
