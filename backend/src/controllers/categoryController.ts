import type { Request, Response } from 'express';
import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  CategoryStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recordAuditEvent } from '../utils/audit.js';

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryAuditField =
  | 'name'
  | 'slug'
  | 'description'
  | 'status'
  | 'parentId'
  | 'sortOrder';
type CategoryAuditSnapshot = Record<CategoryAuditField, string | number | null>;

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  parentId: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeCategory(category: CategoryRecord) {
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

function categoryAuditSnapshot(category: CategoryRecord): CategoryAuditSnapshot {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description,
    status: category.status,
    parentId: category.parentId,
    sortOrder: category.sortOrder,
  };
}

function changedCategoryFields(
  before: CategoryAuditSnapshot,
  after: CategoryAuditSnapshot,
): CategoryAuditField[] {
  return (Object.keys(before) as CategoryAuditField[]).filter(
    (field) => before[field] !== after[field],
  );
}

function pickCategoryFields(
  snapshot: CategoryAuditSnapshot,
  fields: CategoryAuditField[],
): Partial<CategoryAuditSnapshot> {
  return fields.reduce<Partial<CategoryAuditSnapshot>>((selected, field) => {
    selected[field] = snapshot[field];
    return selected;
  }, {});
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
      select: categorySelect,
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
      select: categorySelect,
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
  const actorUserId = request.authUser?.id ?? null;

  try {
    const category = await prisma.$transaction(async (transaction) => {
      const createdCategory = await transaction.category.create({
        data: {
          name,
          slug,
          description: description ?? undefined,
          status,
          parentId,
          sortOrder,
        },
        select: categorySelect,
      });

      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.ADMIN_ACTION,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.CATEGORY,
          entityId: createdCategory.id,
          entityLabel: createdCategory.name,
          actorUserId,
          after: categoryAuditSnapshot(createdCategory),
          metadata: { operation: 'CATEGORY_CREATED' },
        },
        transaction,
      );

      return createdCategory;
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
  const actorUserId = request.authUser?.id ?? null;

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
    const category = await prisma.$transaction(async (transaction) => {
      const existingCategory = await transaction.category.findUnique({
        where: { id },
        select: categorySelect,
      });

      if (!existingCategory) return null;

      const before = categoryAuditSnapshot(existingCategory);
      const updatedCategory = await transaction.category.update({
        where: { id },
        data: {
          name,
          slug,
          description: description === '' ? null : description,
          status,
          parentId: parentId === '' ? null : parentId,
          sortOrder,
        },
        select: categorySelect,
      });
      const after = categoryAuditSnapshot(updatedCategory);
      const changedFields = changedCategoryFields(before, after);

      if (changedFields.length > 0) {
        await recordAuditEvent(
          {
            request,
            eventType: AuditEventType.ADMIN_ACTION,
            action: AuditAction.UPDATE,
            entityType: AuditEntityType.CATEGORY,
            entityId: updatedCategory.id,
            entityLabel: updatedCategory.name,
            actorUserId,
            before: pickCategoryFields(before, changedFields),
            after: pickCategoryFields(after, changedFields),
            metadata: {
              operation: 'CATEGORY_UPDATED',
              changedFields,
            },
          },
          transaction,
        );
      }

      return updatedCategory;
    });

    if (!category) {
      response.status(404).json({ message: 'Category not found' });
      return;
    }

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
    const deletedCategory = await prisma.$transaction(async (transaction) => {
      const category = await transaction.category.findUnique({
        where: { id },
        select: categorySelect,
      });

      if (!category) return null;

      await transaction.category.delete({ where: { id } });
      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.ADMIN_ACTION,
          action: AuditAction.DELETE,
          entityType: AuditEntityType.CATEGORY,
          entityId: category.id,
          entityLabel: category.name,
          actorUserId: request.authUser?.id ?? null,
          before: categoryAuditSnapshot(category),
          metadata: { operation: 'CATEGORY_DELETED' },
        },
        transaction,
      );

      return category;
    });

    if (!deletedCategory) {
      response.status(404).json({ message: 'Category not found' });
      return;
    }

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

      if (error.code === 'P2014') {
        response.status(409).json({
          message: 'Category cannot be deleted because it is referenced by existing records',
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
          message: 'Category cannot be deleted because it is referenced by existing records',
        });
        return;
      }
    }

    console.error('Deleting category failed:', error);
    response.status(500).json({ message: 'Unable to delete category' });
  }
}
