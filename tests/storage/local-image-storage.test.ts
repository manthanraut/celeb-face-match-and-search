import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { LocalImageStorage } from "../../server/storage/LocalImageStorage.js";
import { StoredImageNotFoundError } from "../../server/storage/ImageStorage.js";

const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png)$/;

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

describe("LocalImageStorage", () => {
  const temporaryDirectories: string[] = [];

  async function createStorageRoot(...segments: string[]): Promise<string> {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "local-image-storage-"));
    temporaryDirectories.push(temporaryDirectory);
    return join(temporaryDirectory, ...segments);
  }

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    );
  });

  it("initializes a nested storage directory recursively", async () => {
    const rootDirectory = await createStorageRoot("nested", "images");
    const storage = new LocalImageStorage(rootDirectory);

    await storage.initialize();

    await expect(stat(rootDirectory)).resolves.toMatchObject({});
    expect((await stat(rootDirectory)).isDirectory()).toBe(true);
  });

  it.each(["jpg", "png"] as const)("writes %s images under generated UUID keys", async (extension) => {
    const rootDirectory = await createStorageRoot();
    const storage = new LocalImageStorage(rootDirectory);
    const contents = Buffer.from(`image-${extension}`);
    await storage.initialize();

    const key = await storage.write(contents, extension);

    expect(key).toMatch(STORAGE_KEY_PATTERN);
    expect(key.endsWith(`.${extension}`)).toBe(true);
    expect(await readdir(rootDirectory)).toEqual([key]);

    const metadata = await stat(join(rootDirectory, key));
    expect(metadata.size).toBe(contents.byteLength);

    if (process.platform !== "win32") {
      expect(metadata.mode & 0o777).toBe(0o600);
    }
  });

  it("generates a distinct safe key for every write", async () => {
    const rootDirectory = await createStorageRoot();
    const storage = new LocalImageStorage(rootDirectory);

    const keys = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        storage.write(Buffer.from(`image-${index}`), index % 2 === 0 ? "jpg" : "png"),
      ),
    );

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => STORAGE_KEY_PATTERN.test(key))).toBe(true);
    expect((await readdir(rootDirectory)).sort()).toEqual([...keys].sort());
  });

  it("opens the stored bytes as a stream with their actual size", async () => {
    const rootDirectory = await createStorageRoot();
    const storage = new LocalImageStorage(rootDirectory);
    const contents = Buffer.from("stored image bytes");
    await storage.initialize();
    const key = await storage.write(contents, "jpg");

    const openedImage = await storage.open(key);

    expect(openedImage.sizeBytes).toBe(contents.byteLength);
    await expect(readStream(openedImage.stream)).resolves.toEqual(contents);
  });

  it("maps a missing image to StoredImageNotFoundError", async () => {
    const rootDirectory = await createStorageRoot();
    const storage = new LocalImageStorage(rootDirectory);
    await storage.initialize();

    await expect(storage.open(`${randomUUID()}.jpg`)).rejects.toBeInstanceOf(
      StoredImageNotFoundError,
    );
  });

  it("deletes stored images and ignores missing images", async () => {
    const rootDirectory = await createStorageRoot();
    const storage = new LocalImageStorage(rootDirectory);
    await storage.initialize();
    const key = await storage.write(Buffer.from("image"), "png");

    await storage.delete(key);
    await expect(storage.delete(key)).resolves.toBeUndefined();
    await expect(storage.open(key)).rejects.toBeInstanceOf(StoredImageNotFoundError);
  });

  it.each([
    "../outside.jpg",
    "..\\outside.jpg",
    "/tmp/outside.jpg",
    "nested/image.jpg",
    "",
    ".",
    "not-a-uuid.jpg",
    `${randomUUID()}.gif`,
    `${randomUUID().toUpperCase()}.jpg`,
  ])("rejects unsafe or unsupported key %s", async (key) => {
    const rootDirectory = await createStorageRoot();
    const storage = new LocalImageStorage(rootDirectory);
    await storage.initialize();

    await expect(storage.open(key)).rejects.toThrow("Invalid local image storage key.");
    await expect(storage.delete(key)).rejects.toThrow("Invalid local image storage key.");
  });
});
