/**
 * Database client — Prisma ORM.
 * Exports a singleton PrismaClient instance.
 */

import { PrismaClient } from '@prisma/client';
import process from 'process';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
