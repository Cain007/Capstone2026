import type { Request, Response } from 'express';
import { AuditAction, AuditEntityType, AuditEventType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recordAuditEvent } from '../utils/audit.js';
import { cleanupProductImage, deleteProductImage, ProductImageError, uploadProductImage } from '../services/productImageStorage.js';

const imageSelect = { id: true, sku: true, name: true, imageUrl: true, imagePublicId: true } as const;
type ImageProduct = { id: string; sku: string; name: string; imageUrl: string | null; imagePublicId: string | null };

async function findProduct(request: Request) {
  const id = typeof request.params.id === 'string' ? request.params.id.trim() : '';
  if (!id) throw new ProductImageError(404, 'Product not found');
  const product = await prisma.product.findUnique({ where: { id }, select: imageSelect });
  if (!product) throw new ProductImageError(404, 'Product not found');
  return product;
}

async function updateImage(request: Request, product: ImageProduct, image: { imageUrl: string | null; imagePublicId: string | null }, operation: string) {
  await prisma.$transaction(async transaction => {
    // Compare-and-swap protects a newer upload/removal from stale requests on any server instance.
    const changed = await transaction.product.updateMany({
      where: { id: product.id, imagePublicId: product.imagePublicId, imageUrl: product.imageUrl },
      data: image,
    });
    if (!changed.count) throw new ProductImageError(409, 'Product image changed. Reload the product and try again.');
    await recordAuditEvent({
      request, eventType: AuditEventType.ADMIN_ACTION, action: AuditAction.UPDATE,
      entityType: AuditEntityType.PRODUCT, entityId: product.id,
      entityLabel: `${product.sku} - ${product.name}`, actorUserId: request.authUser?.id ?? null,
      before: { imageUrl: product.imageUrl }, after: { imageUrl: image.imageUrl },
      metadata: { operation },
    }, transaction);
  });
}

function fail(response: Response, error: unknown, operation: string) {
  if (error instanceof ProductImageError) {
    response.status(error.status).json({ message: error.message });
  } else {
    console.error('Product image database operation failed', { operation });
    response.status(500).json({ message: `Unable to ${operation} product image` });
  }
}

export async function uploadImage(request: Request, response: Response) {
  try {
    const product = await findProduct(request);
    if (!request.file) throw new ProductImageError(400, 'Product image is required');
    const image = await uploadProductImage(request.file.buffer);
    try {
      await updateImage(request, product, image, product.imagePublicId ? 'PRODUCT_IMAGE_REPLACED' : 'PRODUCT_IMAGE_UPLOADED');
    } catch (error) {
      await cleanupProductImage(image.imagePublicId, product.id);
      throw error;
    }
    await cleanupProductImage(product.imagePublicId, product.id);
    response.json({ imageUrl: image.imageUrl });
  } catch (error) {
    fail(response, error, 'upload');
  }
}

export async function removeImage(request: Request, response: Response) {
  try {
    const product = await findProduct(request);
    if (product.imagePublicId || product.imageUrl) {
      if (product.imagePublicId) await deleteProductImage(product.imagePublicId);
      try {
        await updateImage(request, product, { imageUrl: null, imagePublicId: null }, 'PRODUCT_IMAGE_REMOVED');
      } catch (error) {
        if (error instanceof ProductImageError) throw error;
        // Retry a transient DB/audit failure after remote deletion; never overwrite a concurrent image.
        try {
          await updateImage(request, product, { imageUrl: null, imagePublicId: null }, 'PRODUCT_IMAGE_REMOVED');
        } catch (retryError) {
          console.error('Product image metadata reconciliation required', { productId: product.id, publicId: product.imagePublicId });
          throw retryError;
        }
      }
    }
    response.status(204).send();
  } catch (error) {
    fail(response, error, 'delete');
  }
}
