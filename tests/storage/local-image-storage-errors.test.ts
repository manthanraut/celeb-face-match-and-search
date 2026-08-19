import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const cryptoMocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const crypto = await importOriginal<typeof import("node:crypto")>();

  return {
    ...crypto,
    randomUUID: cryptoMocks.randomUUID,
  };
});

import { LocalImageStorage } from "../../server/storage/LocalImageStorage.js";

describe("LocalImageStorage write cleanup", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    cryptoMocks.randomUUID.mockReset();
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    );
  });

  it("removes its temporary file when the final rename fails", async () => {
    const imageUuid = "d1a8f76a-524c-41b6-a027-6e9de9c59d10";
    cryptoMocks.randomUUID.mockReturnValueOnce(imageUuid);

    const rootDirectory = await mkdtemp(join(tmpdir(), "local-image-storage-error-"));
    temporaryDirectories.push(rootDirectory);
    const storage = new LocalImageStorage(rootDirectory);
    await storage.initialize();
    await mkdir(join(rootDirectory, `${imageUuid}.jpg`));

    await expect(storage.write(Buffer.from("image"), "jpg")).rejects.toBeDefined();

    expect(await readdir(rootDirectory)).toEqual([`${imageUuid}.jpg`]);
  });
});
