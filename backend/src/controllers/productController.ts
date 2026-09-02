import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeProduct(product: {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  unitType: string;
  price: unknown;
  cost: unknown;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}) {
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    description: product.description,
    status: product.status,
    unitType: product.unitType,
    price: product.price,
    cost: product.cost,
    categoryId: product.categoryId,
    category: product.category,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function getProductId(request: Request): string {
  const raw = request.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

export async function listProducts(_request: Request, response: Response) {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    response.json({ products: products.map(serializeProduct) });
  } catch (error) {
    console.error('Listing products failed:', error);
    response.status(500).json({ message: 'Unable to load products' });
  }
}

export async function getProduct(request: Request, response: Response) {
  const id = getProductId(request);

  if (!id) {
    response.status(404).json({ message: 'Product not found' });
    return;
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!product) {
      response.status(404).json({ message: 'Product not found' });
      return;
    }

    response.json({ product: serializeProduct(product) });
  } catch (error) {
    console.error('Loading product failed:', error);
    response.status(500).json({ message: 'Unable to load product' });
  }
}

export async function createProduct(request: Request, response: Response) {
  const name =
    typeof request.body?.name === 'string' ? request.body.name.trim() : '';

  if (!name) {
    response.status(400).json({ message: 'Name is required' });
    return;
  }

  const sku =
    typeof request.body?.sku === 'string' ? request.body.sku.trim() : '';

  if (!sku) {
    response.status(400).json({ message: 'SKU is required' });
    return;
  }

  const rawPrice = request.body?.price;
  if (rawPrice === undefined || rawPrice === null || rawPrice === '') {
    response.status(400).json({ message: 'Price is required' });
    return;
  }

  const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(price) || price < 0) {
    response.status(400).json({ message: 'Price must be a valid non-negative number' });
    return;
  }

  const categoryId =
    typeof request.body?.categoryId === 'string' ? request.body.categoryId.trim() : '';

  if (!categoryId) {
    response.status(400).json({ message: 'Category ID is required' });
    return;
  }

  const description =
    typeof request.body?.description === 'string'
      ? request.body.description.trim()
      : null;

  const status =
    typeof request.body?.status === 'string' ? request.body.status : undefined;

  const unitType =
    typeof request.body?.unitType === 'string' ? request.body.unitType : undefined;

  const rawCost = request.body?.cost;
  let cost: number | undefined;
  if (rawCost !== undefined && rawCost !== null && rawCost !== '') {
    cost = typeof rawCost === 'number' ? rawCost : Number(rawCost);
    if (!Number.isFinite(cost) || cost < 0) {
      response.status(400).json({ message: 'Cost must be a valid non-negative number' });
      return;
    }
  }

  const slug = toSlug(name);

  try {
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        sku,
        description: description ?? undefined,
        status: status ?? undefined,
        unitType: unitType ?? undefined,
        price,
        cost,
        categoryId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    response.status(201).json({ product: serializeProduct(product) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[] | undefined) ?? [];
        if (target.includes('sku')) {
          response.status(409).json({ message: 'A product with this SKU already exists' });
          return;
        }
        if (target.includes('slug')) {
          response.status(409).json({ message: 'A product with this slug already exists' });
          return;
        }
      }

      if (error.code === 'P2003') {
        response.status(404).json({ message: 'Category not found' });
        return;
      }
    }

    console.error('Creating product failed:', error);
    response.status(500).json({ message: 'Unable to create product' });
  }
}

export async function updateProduct(request: Request, response: Response) {
  const id = getProductId(request);

  if (!id) {
    response.status(404).json({ message: 'Product not found' });
    return;
  }

  const name =
    typeof request.body?.name === 'string' ? request.body.name.trim() : undefined;

  const sku =
    typeof request.body?.sku === 'string' ? request.body.sku.trim() : undefined;

  const description =
    typeof request.body?.description === 'string'
      ? request.body.description.trim()
      : undefined;

  const status =
    typeof request.body?.status === 'string' ? request.body.status : undefined;

  const unitType =
    typeof request.body?.unitType === 'string' ? request.body.unitType : undefined;

  const rawPrice = request.body?.price;
  let price: number | undefined;
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
    price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      response.status(400).json({ message: 'Price must be a valid non-negative number' });
      return;
    }
  }

  const rawCost = request.body?.cost;
  let cost: number | undefined;
  if (rawCost !== undefined && rawCost !== null && rawCost !== '') {
    cost = typeof rawCost === 'number' ? rawCost : Number(rawCost);
    if (!Number.isFinite(cost) || cost < 0) {
      response.status(400).json({ message: 'Cost must be a valid non-negative number' });
      return;
    }
  }

  const categoryId =
    typeof request.body?.categoryId === 'string' ? request.body.categoryId.trim() : undefined;

  const slug = name ? toSlug(name) : undefined;

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name;
  if (sku !== undefined) updateData.sku = sku;
  if (slug !== undefined) updateData.slug = slug;
  if (description !== undefined) updateData.description = description === '' ? null : description;
  if (status !== undefined) updateData.status = status;
  if (unitType !== undefined) updateData.unitType = unitType;
  if (price !== undefined) updateData.price = price;
  if (cost !== undefined) updateData.cost = cost;
  if (categoryId !== undefined) updateData.categoryId = categoryId;

  if (Object.keys(updateData).length === 0) {
    response.status(400).json({ message: 'No valid fields provided for update' });
    return;
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    response.json({ product: serializeProduct(product) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[] | undefined) ?? [];
        if (target.includes('sku')) {
          response.status(409).json({ message: 'A product with this SKU already exists' });
          return;
        }
        if (target.includes('slug')) {
          response.status(409).json({ message: 'A product with this slug already exists' });
          return;
        }
      }

      if (error.code === 'P2025') {
        response.status(404).json({ message: 'Product not found' });
        return;
      }

      if (error.code === 'P2003') {
        response.status(404).json({ message: 'Category not found' });
        return;
      }
    }

    console.error('Updating product failed:', error);
    response.status(500).json({ message: 'Unable to update product' });
  }
}

export async function deleteProduct(request: Request, response: Response) {
  const id = getProductId(request);

  if (!id) {
    response.status(404).json({ message: 'Product not found' });
    return;
  }

  try {
    await prisma.product.delete({ where: { id } });
    response.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        response.status(404).json({ message: 'Product not found' });
        return;
      }

      if (error.code === 'P2003') {
        response.status(409).json({
          message: 'Product cannot be deleted because it is referenced by existing records',
        });
        return;
      }
    }

    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      const message = error.message ?? '';
      const isRestrictViolation =
        message.includes('23001') ||
        message.includes('violates RESTRICT setting of foreign key constraint');

      if (isRestrictViolation) {
        response.status(409).json({
          message: 'Product cannot be deleted because it is referenced by existing records',
        });
        return;
      }
    }

    console.error('Deleting product failed:', error);
    response.status(500).json({ message: 'Unable to delete product' });
  }
}

