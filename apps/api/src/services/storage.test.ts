import { UPLOAD_URL_EXPIRES_IN_SECONDS } from "@sparkl/shared";
import { describe, expect, it } from "vitest";
import {
  type PresignedUploader,
  StorageError,
  buildScopedKey,
  requestUploadUrl,
} from "./storage.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function makeUploader() {
  const calls: {
    bucket: string;
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }[] = [];
  const uploader: PresignedUploader = {
    async createUploadUrl(args) {
      calls.push({ ...args });
      return {
        url: `https://files.test/${args.key}?sig=abc`,
        expiresInSeconds: args.expiresInSeconds,
      };
    },
  };
  return { uploader, calls };
}

describe("buildScopedKey", () => {
  it("formats keys as bucket/userId/fileId.ext", () => {
    expect(buildScopedKey(USER_ID, "avatars", "file-1", "jpg")).toBe(
      `avatars/${USER_ID}/file-1.jpg`,
    );
  });

  it("normalizes the extension (strips dots, lowercases)", () => {
    expect(buildScopedKey(USER_ID, "jobs", "file-2", ".PNG")).toBe(
      `jobs/${USER_ID}/file-2.png`,
    );
  });

  it("rejects path-traversal extensions", () => {
    expect(() => buildScopedKey(USER_ID, "jobs", "file-3", "../exe")).toThrow(
      StorageError,
    );
  });
});

describe("requestUploadUrl", () => {
  it("returns a short-lived URL with a caller-scoped key", async () => {
    const { uploader, calls } = makeUploader();
    const out = await requestUploadUrl(
      { uploader, generateId: () => "file-1" },
      { userId: USER_ID },
      {
        bucket: "avatars",
        contentType: "image/jpeg",
        contentLengthBytes: 1024,
      },
    );
    expect(out).toEqual({
      url: `https://files.test/avatars/${USER_ID}/file-1.jpg?sig=abc`,
      key: `avatars/${USER_ID}/file-1.jpg`,
      bucket: "avatars",
      expiresInSeconds: UPLOAD_URL_EXPIRES_IN_SECONDS,
    });
    expect(calls[0]?.expiresInSeconds).toBe(UPLOAD_URL_EXPIRES_IN_SECONDS);
    expect(calls[0]?.contentType).toBe("image/jpeg");
  });

  it("maps content types to extensions", async () => {
    const { uploader } = makeUploader();
    const out = await requestUploadUrl(
      { uploader, generateId: () => "f" },
      { userId: USER_ID },
      { bucket: "jobs", contentType: "image/webp", contentLengthBytes: 10 },
    );
    expect(out.key.endsWith(".webp")).toBe(true);
  });

  it("rejects files over the per-bucket cap even under the global max", async () => {
    const { uploader } = makeUploader();
    await expect(
      requestUploadUrl(
        { uploader },
        { userId: USER_ID },
        {
          bucket: "avatars",
          contentType: "image/png",
          contentLengthBytes: 6 * 1024 * 1024,
        },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects unknown buckets at runtime", async () => {
    const { uploader } = makeUploader();
    await expect(
      requestUploadUrl(
        { uploader },
        { userId: USER_ID },
        {
          bucket: "secrets" as never,
          contentType: "image/png",
          contentLengthBytes: 10,
        },
      ),
    ).rejects.toBeInstanceOf(StorageError);
  });
});
