import { Prisma } from '@prisma/client';

type SafeLogContext = Record<string, string | number | boolean | null | undefined>;

export function logError(
  operation: string,
  error: unknown,
  context: SafeLogContext = {},
) {
  const errorType = error instanceof Error ? error.name : typeof error;
  const prismaCode =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;

  console.error(operation, {
    ...context,
    errorType,
    ...(prismaCode ? { prismaCode } : {}),
  });
}
