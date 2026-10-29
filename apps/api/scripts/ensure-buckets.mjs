// Local-dev helper: ensure the MinIO buckets exist, then prove the
// presigned-upload path works end to end (PUT via presigned URL + GET back).
// Not part of the test suite: it needs a live S3 endpoint (see
// docker-compose.dev.yml). Run: pnpm --filter @sparkl/api buckets
import { existsSync } from "node:fs";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Read the repo-root .env like the API does, so a second worktree's
// stack (own ports) is never mixed up with the main one. Shell variables
// still win.
const rootEnv = new URL("../../../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const client = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "sparkl",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "sparkl1234",
  },
});

const BUCKETS = ["avatars", "jobs"];

async function ensureBucket(name) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }));
    console.log(`bucket ok: ${name}`);
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      await client.send(new CreateBucketCommand({ Bucket: name }));
      console.log(`bucket created: ${name}`);
    } else {
      throw err;
    }
  }
}

async function smokeTest() {
  const key = `smoke/${Date.now()}.txt`;
  const body = "sparkl-storage-smoke";
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: "jobs",
      Key: key,
      ContentType: "text/plain",
    }),
    { expiresIn: 300 },
  );
  const put = await fetch(url, { method: "PUT", body });
  if (!put.ok) throw new Error(`presigned PUT failed: ${put.status}`);
  const got = await client.send(
    new GetObjectCommand({ Bucket: "jobs", Key: key }),
  );
  const text = await got.Body.transformToString();
  if (text !== body) throw new Error(`roundtrip mismatch: ${text}`);
  console.log(`smoke ok: presigned PUT + GET roundtrip on jobs/${key}`);
}

for (const bucket of BUCKETS) await ensureBucket(bucket);
await smokeTest();
