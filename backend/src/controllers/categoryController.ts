import type { Request, Response } from 'express';
import { CategoryStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeCategory(category: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    status: category.status,
    parentId: category.parentId,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function getCategoryId(request: Request): string {
  const raw = request.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

function isValidCategoryStatus(value: unknown): value is CategoryStatus {
  return (
    typeof value === 'string' &&
    Object.values(CategoryStatus).includes(value as CategoryStatus)
  );
}

export async function listCategories(_request: Request, response: Response) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        parentId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    response.json({ categories: categories.map(serializeCategory) });
  } catch (error) {
    console.error('Listing categories failed:', error);
    response.status(500).json({ message: 'Unable to load categories' });
  }
}

export async function getCategory(request: Request, response: Response) {
  const id = getCategoryId(request);

  if (!id) {
    response.status(404).json({ message: 'Category not found' });
    return;
  }

  try {
    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        parentId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!category) {
      response.status(404).json({ message: 'Category not found' });
      return;
    }

    response.json({ category: serializeCategory(category) });
  } catch (error) {
    console.error('Loading category failed:', error);
    response.status(500).json({ message: 'Unable to load category' });
  }
}

export async function createCategory(request: Request, response: Response) {
  const name =
    typeof request.body?.name === 'string' ? request.body.name.trim() : '';

  if (!name) {
    response.status(400).json({ message: 'Name is required' });
    return;
  }

  const description =
    typeof request.body?.description === 'string'
      ? request.body.description.trim()
      : null;

  const status = request.body?.status;

  if (status !== undefined && !isValidCategoryStatus(status)) {
    response.status(400).json({ message: 'Invalid category status' });
    return;
  }

  const parentId =
    typeof request.body?.parentId === 'string' && request.body.parentId.trim()
      ? request.body.parentId.trim()
      : null;

  const sortOrder =
    typeof request.body?.sortOrder === 'number' ? request.body.sortOrder : 0;

  const slug = toSlug(name);

  try {
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description ?? undefined,
        status,
        parentId,
        sortOrder,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        parentId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    response.status(201).json({ category: serializeCategory(category) });
  } catch (error) {
    console.error('Creating category failed:', error);
    response.status(500).json({ message: 'Unable to create category' });
  }
}

export async function updateCategory(request: Request, response: Response) {
  const id = getCategoryId(request);

  if (!id) {
    response.status(404).json({ message: 'Category not found' });
    return;
  }

  const name =
    typeof request.body?.name === 'string' ? request.body.name.trim() : undefined;

  const description =
    typeof request.body?.description === 'string'
      ? request.body.description.trim()
      : undefined;

  const status = request.body?.status;

  if (status !== undefined && !isValidCategoryStatus(status)) {
    response.status(400).json({ message: 'Invalid category status' });
    return;
  }

  const parentId =
    typeof request.body?.parentId === 'string' && request.body.parentId.trim()
      ? request.body.parentId.trim()
      : undefined;

  const sortOrder =
    typeof request.body?.sortOrder === 'number' ? request.body.sortOrder : undefined;

  const slug = name ? toSlug(name) : undefined;

  if (
    !name &&
    description === undefined &&
    status === undefined &&
    parentId === undefined &&
    sortOrder === undefined
  ) {
    response.status(400).json({ message: 'No valid fields provided for update' });
    return;
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        description: description === '' ? null : description,
        status,
        parentId: parentId === '' ? null : parentId,
        sortOrder,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        parentId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    response.json({ category: serializeCategory(category) });
  } catch (error) {
    console.error('Updating category failed:', error);
    response.status(500).json({ message: 'Unable to update category' });
  }
}

export async function deleteCategory(request: Request, response: Response) {
  const id = getCategoryId(request);

  if (!id) {
    response.status(404).json({ message: 'Category not found' });
    return;
  }

  try {
    await prisma.category.delete({ where: { id } });
    response.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        response.status(404).json({ message: 'Category not found' });
        return;
      }

      if (error.code === 'P2003') {
        response.status(409).json({
          message: 'Category cannot be deleted because it is referenced by existing records',
        });
        return;
      }
    }

    console.error('Deleting category failed:', error);
    response.status(500).json({ message: 'Unable to delete category' });
  }
}