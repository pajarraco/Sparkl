import { z } from "zod";

export const STORAGE_BUCKETS = ["avatars", "jobs"] as const;

export const storageBucketSchema = z.enum(STORAGE_BUCKETS);

export type StorageBucket = z.infer<typeof storageBucketSchema>;

// Hard cap enforced by input validation; per-bucket caps enforced by the
// storage service (avatars 5 MiB, job photos 10 MiB).
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const JOB_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const BUCKET_MAX_BYTES: Record<StorageBucket, number> = {
  avatars: AVATAR_MAX_BYTES,
  jobs: JOB_PHOTO_MAX_BYTES,
};

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const allowedImageContentTypeSchema = z.enum(
  ALLOWED_IMAGE_CONTENT_TYPES,
);

export type AllowedImageContentType = z.infer<
  typeof allowedImageContentTypeSchema
>;

export const CONTENT_TYPE_TO_EXT: Record<AllowedImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Short-lived URLs: the client must start the direct upload promptly.
export const UPLOAD_URL_EXPIRES_IN_SECONDS = 300;

export const getUploadUrlInputSchema = z
  .object({
    bucket: storageBucketSchema,
    contentType: allowedImageContentTypeSchema,
    contentLengthBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  })
  .strict();

export type GetUploadUrlInput = z.infer<typeof getUploadUrlInputSchema>;

export const getUploadUrlOutputSchema = z
  .object({
    url: z.string().url().max(8192),
    key: z.string().min(1).max(1024),
    bucket: storageBucketSchema,
    expiresInSeconds: z.number().int().positive(),
  })
  .strict();

export type GetUploadUrlOutput = z.infer<typeof getUploadUrlOutputSchema>;
