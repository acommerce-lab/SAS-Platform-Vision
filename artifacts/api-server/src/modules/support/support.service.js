import prisma from '../../../../../lib/db/src/index.js';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/error-codes.js';

export async function listTickets({ userId, role, status, page = 1, limit = 20 }) {
  const where = {};
  if (role !== 'admin') where.created_by_id = userId;
  if (status) where.status = status.toUpperCase().replace('-', '_');

  const tickets = await prisma.supportTicket.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { created_at: 'desc' },
  });
  return tickets.map(fmt);
}

export async function createTicket({ subject, message }, userId, userRole) {
  const ticket = await prisma.supportTicket.create({
    data: {
      created_by_id: userId,
      created_by_role: userRole.toUpperCase(),
      subject,
      status: 'OPEN',
      messages: {
        create: [{ sender_id: userId, sender_role: userRole.toUpperCase(), content: message }],
      },
    },
    include: { messages: true },
  });
  return { ...fmt(ticket), messages: ticket.messages.map(fmtMsg) };
}

export async function getTicket(ticketId, userId, role) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
  if (!ticket) throw new AppError(ErrorCodes.TICKET_NOT_FOUND, 'Ticket not found');
  if (role !== 'admin' && ticket.created_by_id !== userId) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Access denied');
  }
  return { ...fmt(ticket), messages: ticket.messages.map(fmtMsg) };
}

export async function updateTicket(ticketId, { status, assigned_to_id }) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError(ErrorCodes.TICKET_NOT_FOUND, 'Ticket not found');

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      ...(status ? { status: status.toUpperCase().replace('-', '_') } : {}),
      ...(assigned_to_id !== undefined ? { assigned_to_id } : {}),
    },
  });
  return fmt(updated);
}

export async function replyToTicket(ticketId, content, userId, userRole) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError(ErrorCodes.TICKET_NOT_FOUND, 'Ticket not found');

  const msg = await prisma.supportMessage.create({
    data: { ticket_id: ticketId, sender_id: userId, sender_role: userRole.toUpperCase(), content },
  });

  // Auto-update ticket status to in_progress if it's open and an admin replies
  if (ticket.status === 'OPEN' && userRole.toUpperCase() === 'ADMIN') {
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'IN_PROGRESS' } });
  }

  return fmtMsg(msg);
}

function fmt(t) {
  return {
    id: t.id,
    created_by_id: t.created_by_id,
    created_by_role: t.created_by_role.toLowerCase(),
    subject: t.subject,
    status: t.status.toLowerCase(),
    assigned_to_id: t.assigned_to_id,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
  };
}

function fmtMsg(m) {
  return {
    id: m.id,
    ticket_id: m.ticket_id,
    sender_id: m.sender_id,
    sender_role: m.sender_role.toLowerCase(),
    content: m.content,
    created_at: m.created_at.toISOString(),
  };
}
