import { Prisma } from '../../generated/prisma/client';
import { mapPrismaError } from './prisma-error.mapper';

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
}

describe('mapPrismaError', () => {
  it.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2003', 409, 'CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('maps %s to %i %s', (prismaCode, status, code) => {
    expect(mapPrismaError(knownError(prismaCode))).toMatchObject({ status, code });
  });

  it('leaves unknown Prisma codes and other errors to the default handler', () => {
    expect(mapPrismaError(knownError('P1001'))).toBeNull();
    expect(mapPrismaError(new Error('x'))).toBeNull();
  });
});
