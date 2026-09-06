import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

type TokenPayload = {
  userId: string;
};

type AllowedRole = 'Admin' | 'Staff';

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    response.status(500).json({ message: 'Server authentication is not configured' });
    return;
  }

  try {
    const token = authorization.slice('Bearer '.length);
    const payload = jwt.verify(token, secret) as TokenPayload;
    request.userId = payload.userId;
    next();
  } catch {
    response.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(...allowedRoles: AllowedRole[]) {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!request.userId) {
      response.status(401).json({ message: 'Authentication required' });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: {
          id: true,
          status: true,
          role: { select: { name: true } },
        },
      });

      if (!user) {
        response.status(401).json({ message: 'User no longer exists' });
        return;
      }

      if (user.status === 'INACTIVE') {
        response.status(403).json({
          message: 'This account is inactive. Contact an administrator.',
        });
        return;
      }

      if (user.status === 'SUSPENDED') {
        response.status(403).json({
          message: 'This account is suspended. Contact an administrator.',
        });
        return;
      }

      if (!allowedRoles.includes(user.role.name as AllowedRole)) {
        response.status(403).json({ message: 'Forbidden' });
        return;
      }

      request.authUser = {
        id: user.id,
        role: user.role.name,
        status: user.status,
      };
      next();
    } catch (error) {
      console.error('Authorization lookup failed:', error);
      response.status(500).json({ message: 'Unable to authorize request' });
    }
  };
}
