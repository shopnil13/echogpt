import type { Prisma } from '../../generated/prisma/client';

/** Client passed to repositories so they can join a caller's transaction. */
export type DbClient = Prisma.TransactionClient;
