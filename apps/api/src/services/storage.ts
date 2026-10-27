import { randomUUID } from "node:crypto";
import {
  type AllowedImageContentType,
  BUCKET_MAX_BYTES,
  CONTENT_TYPE_TO_EXT,
  type GetUploadUrlInput,
  type GetUploadUrlOutput,
  SPARKL_ERROR_CODES,
  type SparklErrorCode,
  type StorageBucket,
  UPLOAD_URL_EXPIRES_IN_SECONDS,
} from "@sparkl/shared";

export class StorageError extends Error {
  readonly code: SparklErrorCode;

  constructor(code: SparklErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

function validationError(message: string): StorageError {
  return new StorageError(SPARKL_ERROR_CODES.VALIDATION_ERROR, message);
}

// Pure: every object lives under its owner's id and logical bucket, so a
// presigned URL can never address another user's files.
export function buildScopedKey(
  userId: string,
  bucket: StorageBucket,
  fileId: string,
  ext: string,
): string {
  const normalized = ext.toLowerCase().replace(/^\.+/, "");
  if (!/^[a-z0-9]{1,10}$/.test(normalized)) {
    throw validationError(`unsupported file extension: ${ext}`);
  }
  return `${bucket}/${userId}/${fileId}.${normalized}`;
}

// Port implemented by `storage/s3.ts`. Drizzle-free: uploads never touch
// the database; the caller persists the returned key (avatar/job photo).
export interface PresignedUploader {
  createUploadUrl(args: {
    bucket: StorageBucket;
    key: string;
    contentType: AllowedImageContentType;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresInSeconds: number }>;
}

export interface RequestUploadUrlDeps {
  uploader: PresignedUploader;
  generateId?: () => string;
}

export async function requestUploadUrl(
  deps: RequestUploadUrlDeps,
  caller: { userId: string },
  input: GetUploadUrlInput,
): Promise<GetUploadUrlOutput> {
  const bucketMax = BUCKET_MAX_BYTES[input.bucket];
  if (bucketMax === undefined) {
    throw validationError(`unknown bucket: ${input.bucket}`);
  }
  if (input.contentLengthBytes > bucketMax) {
    throw validationError(
      `file too large for bucket ${input.bucket}: ` +
        `${input.contentLengthBytes} > ${bucketMax} bytes`,
    );
  }
  const ext = CONTENT_TYPE_TO_EXT[input.contentType];
  if (!ext) {
    throw validationError(`unsupported content type: ${input.contentType}`);
  }
  const generateId = deps.generateId ?? randomUUID;
  const key = buildScopedKey(caller.userId, input.bucket, generateId(), ext);
  const { url, expiresInSeconds } = await deps.uploader.createUploadUrl({
    bucket: input.bucket,
    key,
    contentType: input.contentType,
    expiresInSeconds: UPLOAD_URL_EXPIRES_IN_SECONDS,
  });
  return { url, key, bucket: input.bucket, expiresInSeconds };
}
