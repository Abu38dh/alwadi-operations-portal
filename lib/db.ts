import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Cache the client globally to avoid too many connections in serverless
if (!globalForPrisma.prisma) globalForPrisma.prisma = db


