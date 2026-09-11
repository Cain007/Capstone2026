import type { RequestHandler } from 'express';
import multer from 'multer';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const parseImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
  fileFilter: (_request, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) callback(new Error('Unsupported image type'));
    else callback(null, true);
  },
}).single('image');

function matchesSignature(file: Express.Multer.File) {
  const data = file.buffer;
  if (file.mimetype === 'image/jpeg') return data.length >= 3 && data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (file.mimetype === 'image/png') return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return data.length >= 16 && data.toString('ascii', 0, 4) === 'RIFF'
    && data.toString('ascii', 8, 12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(data.toString('ascii', 12, 16));
}

export const productImageUpload: RequestHandler = (request, response, next) => {
  parseImage(request, response, (error: unknown) => {
    if (error) {
      const oversized = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
      const unsupported = error instanceof Error && error.message === 'Unsupported image type';
      response.status(oversized ? 413 : unsupported ? 415 : 400).json({
        message: oversized ? 'Product image must not exceed 5 MB'
          : unsupported ? 'Unsupported image type' : 'Invalid image upload; send one image file only',
      });
      return;
    }
    if (!request.file) {
      response.status(400).json({ message: 'Product image is required' });
      return;
    }
    if (!matchesSignature(request.file)) {
      response.status(415).json({ message: 'Unsupported image type or invalid file signature' });
      return;
    }
    next();
  });
};

// No shared mutation limiter exists. Bound authenticated image mutations per process.
const attempts = new Map<string, { count: number; expires: number }>();
const windowMs = 15 * 60 * 1000;
export const productImageRateLimit: RequestHandler = (request, response, next) => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const key = request.authUser!.id;
  const entry = attempts.get(key) ?? { count: 0, expires: now + windowMs };
  if (entry.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) {
    response.setHeader('Retry-After', Math.ceil((entry.expires - now) / 1000));
    response.status(429).json({ message: 'Too many product image requests. Please try again later.' });
    return;
  }
  entry.count++;
  attempts.set(key, entry);
  next();
};
