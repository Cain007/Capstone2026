import type { Request, Response } from 'express';
import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recordAuditEvent } from '../utils/audit.js';
import { logError } from '../utils/safeLogger.js';

type SupplierRecord = {
  id: string;
  supplierCode: string;
  name: string;
  legalName: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SupplierAuditField =
  | 'supplierCode'
  | 'name'
  | 'legalName'
  | 'status'
  | 'email'
  | 'phone'
  | 'website'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'province'
  | 'postalCode'
  | 'country'
  | 'notes';
type SupplierAuditSnapshot = Record<SupplierAuditField, string | null>;

const supplierSelect = {
  id: true,
  supplierCode: true,
  name: true,
  legalName: true,
  status: true,
  email: true,
  phone: true,
  website: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toSupplierCode(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'SUP';
}

function serializeSupplier(supplier: SupplierRecord) {
  return {
    id: supplier.id,
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    legalName: supplier.legalName,
    status: supplier.status,
    email: supplier.email,
    phone: supplier.phone,
    website: supplier.website,
    addressLine1: supplier.addressLine1,
    addressLine2: supplier.addressLine2,
    city: supplier.city,
    province: supplier.province,
    postalCode: supplier.postalCode,
    country: supplier.country,
    notes: supplier.notes,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

function supplierAuditSnapshot(supplier: SupplierRecord): SupplierAuditSnapshot {
  return {
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    legalName: supplier.legalName,
    status: supplier.status,
    email: supplier.email,
    phone: supplier.phone,
    website: supplier.website,
    addressLine1: supplier.addressLine1,
    addressLine2: supplier.addressLine2,
    city: supplier.city,
    province: supplier.province,
    postalCode: supplier.postalCode,
    country: supplier.country,
    notes: supplier.notes,
  };
}

function changedSupplierFields(
  before: SupplierAuditSnapshot,
  after: SupplierAuditSnapshot,
): SupplierAuditField[] {
  return (Object.keys(before) as SupplierAuditField[]).filter(
    (field) => before[field] !== after[field],
  );
}

function pickSupplierFields(
  snapshot: SupplierAuditSnapshot,
  fields: SupplierAuditField[],
): Partial<SupplierAuditSnapshot> {
  return fields.reduce<Partial<SupplierAuditSnapshot>>((selected, field) => {
    selected[field] = snapshot[field];
    return selected;
  }, {});
}

function getSupplierId(request: Request): string {
  const raw = request.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

export async function listSuppliers(_request: Request, response: Response) {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      select: supplierSelect,
    });

    response.json({ suppliers: suppliers.map(serializeSupplier) });
  } catch (error) {
    logError('Listing suppliers failed', error);
    response.status(500).json({ message: 'Unable to load suppliers' });
  }
}

export async function getSupplier(request: Request, response: Response) {
  const id = getSupplierId(request);

  if (!id) {
    response.status(404).json({ message: 'Supplier not found' });
    return;
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: supplierSelect,
    });

    if (!supplier) {
      response.status(404).json({ message: 'Supplier not found' });
      return;
    }

    response.json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    logError('Loading supplier failed', error);
    response.status(500).json({ message: 'Unable to load supplier' });
  }
}

export async function createSupplier(request: Request, response: Response) {
  const name =
    typeof request.body?.name === 'string' ? request.body.name.trim() : '';

  if (!name) {
    response.status(400).json({ message: 'Name is required' });
    return;
  }

  const supplierCode =
    typeof request.body?.supplierCode === 'string' && request.body.supplierCode.trim()
      ? request.body.supplierCode.trim()
      : toSupplierCode(name);

  const legalName =
    typeof request.body?.legalName === 'string'
      ? request.body.legalName.trim()
      : null;

  const status =
    typeof request.body?.status === 'string' ? request.body.status : undefined;

  const email =
    typeof request.body?.email === 'string'
      ? request.body.email.trim()
      : null;

  const phone =
    typeof request.body?.phone === 'string'
      ? request.body.phone.trim()
      : null;

  const website =
    typeof request.body?.website === 'string'
      ? request.body.website.trim()
      : null;

  const addressLine1 =
    typeof request.body?.addressLine1 === 'string'
      ? request.body.addressLine1.trim()
      : null;

  const addressLine2 =
    typeof request.body?.addressLine2 === 'string'
      ? request.body.addressLine2.trim()
      : null;

  const city =
    typeof request.body?.city === 'string'
      ? request.body.city.trim()
      : null;

  const province =
    typeof request.body?.province === 'string'
      ? request.body.province.trim()
      : null;

  const postalCode =
    typeof request.body?.postalCode === 'string'
      ? request.body.postalCode.trim()
      : null;

  const country =
    typeof request.body?.country === 'string' && request.body.country.trim()
      ? request.body.country.trim()
      : undefined;

  const notes =
    typeof request.body?.notes === 'string'
      ? request.body.notes.trim()
      : null;
  const actorUserId = request.authUser?.id ?? null;

  try {
    const supplier = await prisma.$transaction(async (transaction) => {
      const createdSupplier = await transaction.supplier.create({
        data: {
          supplierCode,
          name,
          legalName: legalName ?? undefined,
          status: status ?? undefined,
          email: email ?? undefined,
          phone: phone ?? undefined,
          website: website ?? undefined,
          addressLine1: addressLine1 ?? undefined,
          addressLine2: addressLine2 ?? undefined,
          city: city ?? undefined,
          province: province ?? undefined,
          postalCode: postalCode ?? undefined,
          country,
          notes: notes ?? undefined,
        },
        select: supplierSelect,
      });

      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.ADMIN_ACTION,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.SUPPLIER,
          entityId: createdSupplier.id,
          entityLabel: createdSupplier.name,
          actorUserId,
          after: supplierAuditSnapshot(createdSupplier),
          metadata: { operation: 'SUPPLIER_CREATED' },
        },
        transaction,
      );

      return createdSupplier;
    });

    response.status(201).json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    logError('Creating supplier failed', error);
    response.status(500).json({ message: 'Unable to create supplier' });
  }
}

export async function updateSupplier(request: Request, response: Response) {
  const id = getSupplierId(request);

  if (!id) {
    response.status(404).json({ message: 'Supplier not found' });
    return;
  }

  const supplierCode =
    typeof request.body?.supplierCode === 'string' && request.body.supplierCode.trim()
      ? request.body.supplierCode.trim()
      : undefined;

  const name =
    typeof request.body?.name === 'string' ? request.body.name.trim() : undefined;

  const legalName =
    typeof request.body?.legalName === 'string'
      ? request.body.legalName.trim()
      : undefined;

  const status =
    typeof request.body?.status === 'string' ? request.body.status : undefined;

  const email =
    typeof request.body?.email === 'string'
      ? request.body.email.trim()
      : undefined;

  const phone =
    typeof request.body?.phone === 'string'
      ? request.body.phone.trim()
      : undefined;

  const website =
    typeof request.body?.website === 'string'
      ? request.body.website.trim()
      : undefined;

  const addressLine1 =
    typeof request.body?.addressLine1 === 'string'
      ? request.body.addressLine1.trim()
      : undefined;

  const addressLine2 =
    typeof request.body?.addressLine2 === 'string'
      ? request.body.addressLine2.trim()
      : undefined;

  const city =
    typeof request.body?.city === 'string'
      ? request.body.city.trim()
      : undefined;

  const province =
    typeof request.body?.province === 'string'
      ? request.body.province.trim()
      : undefined;

  const postalCode =
    typeof request.body?.postalCode === 'string'
      ? request.body.postalCode.trim()
      : undefined;

  const country =
    typeof request.body?.country === 'string' && request.body.country.trim()
      ? request.body.country.trim()
      : undefined;

  const notes =
    typeof request.body?.notes === 'string'
      ? request.body.notes.trim()
      : undefined;

  const updateData: Record<string, unknown> = {};

  if (supplierCode !== undefined) updateData.supplierCode = supplierCode;
  if (name !== undefined) updateData.name = name;
  if (legalName !== undefined) updateData.legalName = legalName === '' ? null : legalName;
  if (status !== undefined) updateData.status = status;
  if (email !== undefined) updateData.email = email === '' ? null : email;
  if (phone !== undefined) updateData.phone = phone === '' ? null : phone;
  if (website !== undefined) updateData.website = website === '' ? null : website;
  if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1 === '' ? null : addressLine1;
  if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2 === '' ? null : addressLine2;
  if (city !== undefined) updateData.city = city === '' ? null : city;
  if (province !== undefined) updateData.province = province === '' ? null : province;
  if (postalCode !== undefined) updateData.postalCode = postalCode === '' ? null : postalCode;
  if (country !== undefined) updateData.country = country === '' ? undefined : country;
  if (notes !== undefined) updateData.notes = notes === '' ? null : notes;

  if (Object.keys(updateData).length === 0) {
    response.status(400).json({ message: 'No valid fields provided for update' });
    return;
  }

  const actorUserId = request.authUser?.id ?? null;

  try {
    const supplier = await prisma.$transaction(async (transaction) => {
      const existingSupplier = await transaction.supplier.findUnique({
        where: { id },
        select: supplierSelect,
      });

      if (!existingSupplier) return null;

      const before = supplierAuditSnapshot(existingSupplier);
      const updatedSupplier = await transaction.supplier.update({
        where: { id },
        data: updateData,
        select: supplierSelect,
      });
      const after = supplierAuditSnapshot(updatedSupplier);
      const changedFields = changedSupplierFields(before, after);

      if (changedFields.length > 0) {
        await recordAuditEvent(
          {
            request,
            eventType: AuditEventType.ADMIN_ACTION,
            action: AuditAction.UPDATE,
            entityType: AuditEntityType.SUPPLIER,
            entityId: updatedSupplier.id,
            entityLabel: updatedSupplier.name,
            actorUserId,
            before: pickSupplierFields(before, changedFields),
            after: pickSupplierFields(after, changedFields),
            metadata: {
              operation: 'SUPPLIER_UPDATED',
              changedFields,
            },
          },
          transaction,
        );
      }

      return updatedSupplier;
    });

    if (!supplier) {
      response.status(404).json({ message: 'Supplier not found' });
      return;
    }

    response.json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    logError('Updating supplier failed', error);
    response.status(500).json({ message: 'Unable to update supplier' });
  }
}

export async function deleteSupplier(request: Request, response: Response) {
  const id = getSupplierId(request);

  if (!id) {
    response.status(404).json({ message: 'Supplier not found' });
    return;
  }

  try {
    const deletedSupplier = await prisma.$transaction(async (transaction) => {
      const supplier = await transaction.supplier.findUnique({
        where: { id },
        select: supplierSelect,
      });

      if (!supplier) return null;

      await transaction.supplier.delete({ where: { id } });
      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.ADMIN_ACTION,
          action: AuditAction.DELETE,
          entityType: AuditEntityType.SUPPLIER,
          entityId: supplier.id,
          entityLabel: supplier.name,
          actorUserId: request.authUser?.id ?? null,
          before: supplierAuditSnapshot(supplier),
          metadata: { operation: 'SUPPLIER_DELETED' },
        },
        transaction,
      );

      return supplier;
    });

    if (!deletedSupplier) {
      response.status(404).json({ message: 'Supplier not found' });
      return;
    }

    response.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        response.status(404).json({ message: 'Supplier not found' });
        return;
      }

      if (error.code === 'P2003') {
        response.status(409).json({
          message: 'Supplier cannot be deleted because it is referenced by existing records',
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
          message: 'Supplier cannot be deleted because it is referenced by existing records',
        });
        return;
      }
    }

    logError('Deleting supplier failed', error);
    response.status(500).json({ message: 'Unable to delete supplier' });
  }
}
