import { v2 as cloudinary } from 'cloudinary';

export class ProductImageError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export const PRODUCT_IMAGE_FOLDER = 'king-of-clouds/products';
let configured = false;

function configureStorage() {
  // Missing optional storage credentials must not disable ordinary Product CRUD.
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret) {
    throw new ProductImageError(503, 'Product image storage is not configured');
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export async function uploadProductImage(buffer: Buffer) {
  configureStorage();
  return new Promise<{ imageUrl: string; imagePublicId: string }>((resolve, reject) => {
    const failure = () => reject(new ProductImageError(502, 'Unable to upload product image'));
    try {
      const stream = cloudinary.uploader.upload_stream({
        folder: PRODUCT_IMAGE_FOLDER,
        resource_type: 'image',
        allowed_formats: ['jpg', 'png', 'webp'],
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        timeout: 30000,
      }, (error, result) => {
        if (error || !result?.secure_url?.startsWith('https://') || !result.public_id) {
          failure();
          return;
        }
        resolve({ imageUrl: result.secure_url, imagePublicId: result.public_id });
      });
      stream.on('error', failure);
      stream.end(buffer);
    } catch {
      failure();
    }
  });
}

export async function deleteProductImage(publicId: string) {
  configureStorage();
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image', type: 'upload', invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Deletion rejected');
  } catch {
    throw new ProductImageError(502, 'Unable to delete product image');
  }
}

export async function cleanupProductImage(publicId: string | null, productId: string) {
  if (!publicId) return;
  try {
    await deleteProductImage(publicId);
  } catch {
    // Identifiers allow manual orphan cleanup; never log raw provider errors or credentials.
    console.warn('Product image cleanup failed', { productId, publicId });
  }
}
