import { PrismaClient } from "@prisma/client";

// Prisma's query engine starts one worker thread per CPU the machine reports.
// Hostinger counts every thread against the account's process limit (120) and
// its servers report many CPUs, so an uncapped engine alone can use most of it
// and the site answers 503. Two are plenty here; a value set in hPanel wins.
// It only has to be set before the first query, when the engine loads.
process.env.TOKIO_WORKER_THREADS ??= "2";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
