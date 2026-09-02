import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SIGNUP_ROLE_NAME = process.env.DEFAULT_SIGNUP_ROLE_NAME || 'Staff';

function publicUser(user: { id: string; email: string }) {
  return { id: user.id, email: user.email };
}

function createToken(userId: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

function readCredentials(request: Request) {
  const email =
    typeof request.body?.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : '';
  const password =
    typeof request.body?.password === 'string' ? request.body.password : '';
  const confirmPassword =
    typeof request.body?.confirmPassword === 'string'
      ? request.body.confirmPassword
      : '';

  return { email, password, confirmPassword };
}

async function getDefaultSignupRoleId() {
  const role = await prisma.role.upsert({
    where: { name: DEFAULT_SIGNUP_ROLE_NAME },
    update: {},
    create: {
      name: DEFAULT_SIGNUP_ROLE_NAME,
      description: 'Default role assigned to newly registered users.',
    },
    select: { id: true },
  });

  return role.id;
}

export async function signup(request: Request, response: Response) {
  const { email, password, confirmPassword } = readCredentials(request);

  if (!EMAIL_PATTERN.test(email)) {
    response.status(400).json({ message: 'Enter a valid email address' });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    response
      .status(400)
      .json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  if (password !== confirmPassword) {
    response.status(400).json({ message: 'Passwords do not match' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const roleId = await getDefaultSignupRoleId();
    const user = await prisma.user.create({
      data: { email, passwordHash, roleId },
      select: { id: true, email: true },
    });

    response.status(201).json({
      token: createToken(user.id),
      user: publicUser(user),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      response.status(409).json({ message: 'An account with this email already exists' });
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    ) {
      response.status(503).json({
        message: 'Database tables are not ready. Run the Prisma migration.',
      });
      return;
    }

    console.error('Signup failed:', error);
    response.status(500).json({ message: 'Unable to create account' });
  }
}

export async function login(request: Request, response: Response) {
  const { email, password } = readCredentials(request);

  if (!email || !password) {
    response.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches =
      user && (await bcrypt.compare(password, user.passwordHash));

    if (!user || !passwordMatches) {
      response.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    response.json({
      token: createToken(user.id),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login failed:', error);
    response.status(500).json({ message: 'Unable to sign in' });
  }
}

export async function getCurrentUser(request: Request, response: Response) {
  if (!request.userId) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      response.status(401).json({ message: 'User no longer exists' });
      return;
    }

    response.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Loading current user failed:', error);
    response.status(500).json({ message: 'Unable to load user' });
  }
}
