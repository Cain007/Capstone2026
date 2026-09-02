import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

function toSupplierCode(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'SUP';
}

function serializeSupplier(supplier: {
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
}) {
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

function getSupplierId(request: Request): string {
  const raw = request.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

export async function listSuppliers(_request: Request, response: Response) {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      select: {
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
      },
    });

    response.json({ suppliers: suppliers.map(serializeSupplier) });
  } catch (error) {
    console.error('Listing suppliers failed:', error);
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
      select: {
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
      },
    });

    if (!supplier) {
      response.status(404).json({ message: 'Supplier not found' });
      return;
    }

    response.json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    console.error('Loading supplier failed:', error);
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

  try {
    const supplier = await prisma.supplier.create({
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
      select: {
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
      },
    });

    response.status(201).json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    console.error('Creating supplier failed:', error);
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

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: updateData,
      select: {
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
      },
    });

    response.json({ supplier: serializeSupplier(supplier) });
  } catch (error) {
    console.error('Updating supplier failed:', error);
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
    await prisma.supplier.delete({ where: { id } });
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

    console.error('Deleting supplier failed:', error);
    response.status(500).json({ message: 'Unable to delete supplier' });
  }
}