// Infrastructure adapter: the only file that imports the S3 SDK. Local dev
// points S3_ENDPOINT at MinIO with S3_FORCE_PATH_STYLE=true; production
// uses R2/S3 via env — same code path.
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  type StorageBucket,
  UPLOAD_URL_EXPIRES_IN_SECONDS,
} from "@sparkl/shared";
import type { PresignedUploader } from "../services/storage.js";

const BUCKET_ENV_VARS = {
  avatars: "AVATARS_BUCKET",
  jobs: "JOBS_BUCKET",
} as const satisfies Record<StorageBucket, string>;

type Env = Record<string, string | undefined>;

// Logical bucket (`avatars`/`jobs`) -> physical bucket name from env, so
// deployments never hardcode infrastructure names.
export function resolveBucketName(bucket: StorageBucket, env: Env): string {
  const name = env[BUCKET_ENV_VARS[bucket]];
  if (!name) {
    throw new Error(
      `missing required env var ${BUCKET_ENV_VARS[bucket]} for bucket ${bucket}`,
    );
  }
  return name;
}

export interface S3UploaderOptions {
  client?: S3Client;
  env?: Env;
}

export function createS3PresignedUploader(
  options: S3UploaderOptions = {},
): PresignedUploader {
  const env = options.env ?? process.env;
  const client =
    options.client ??
    new S3Client({
      region: env.S3_REGION ?? env.AWS_REGION ?? "us-east-1",
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    });
  return {
    async createUploadUrl({ bucket, key, contentType, expiresInSeconds }) {
      const Bucket = resolveBucketName(bucket, env);
      const command = new PutObjectCommand({
        Bucket,
        Key: key,
        ContentType: contentType,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds || UPLOAD_URL_EXPIRES_IN_SECONDS,
      });
      return { url, expiresInSeconds };
    },
  };
}
