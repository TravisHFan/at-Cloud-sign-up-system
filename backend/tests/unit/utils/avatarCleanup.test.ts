import { beforeEach, describe, expect, it, vi } from "vitest";

const { unlink, log } = vi.hoisted(() => ({
  unlink: vi.fn(),
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("fs", () => ({
  default: { promises: { unlink } },
}));
vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => log),
}));

import {
  cleanupOldAvatar,
  deleteOldAvatarFile,
  isUploadedAvatar,
} from "../../../src/utils/avatarCleanup";

describe("avatarCleanup", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnvironment, NODE_ENV: "test" };
    delete process.env.UPLOAD_DESTINATION;
    unlink.mockResolvedValue(undefined);
  });

  it.each([
    ["/uploads/avatars/user.jpg", true],
    ["https://example.com/uploads/avatars/user.jpg", true],
    ["/default-avatar-male.jpg", false],
    [undefined, false],
    [null, false],
  ])("identifies uploaded avatars", (value, expected) => {
    expect(isUploadedAvatar(value)).toBe(expected);
  });

  it("does not touch the filesystem for default avatars", async () => {
    await expect(deleteOldAvatarFile("/default-avatar-male.jpg")).resolves.toBe(
      false,
    );
    expect(unlink).not.toHaveBeenCalled();
  });

  it("deletes an uploaded avatar asynchronously from the configured directory", async () => {
    process.env.UPLOAD_DESTINATION = "/data/uploads/";

    await expect(
      deleteOldAvatarFile("https://app.test/uploads/avatars/old.jpg?version=2"),
    ).resolves.toBe(true);

    expect(unlink).toHaveBeenCalledWith("/data/uploads/avatars/old.jpg");
  });

  it("uses the local upload directory outside production", async () => {
    await deleteOldAvatarFile("/uploads/avatars/local.png");

    expect(unlink).toHaveBeenCalledWith(
      expect.stringMatching(/uploads\/avatars\/local\.png$/),
    );
  });

  it("treats an already-missing avatar as successfully cleaned state", async () => {
    unlink.mockRejectedValue(
      Object.assign(new Error("missing"), { code: "ENOENT" }),
    );

    await expect(
      deleteOldAvatarFile("/uploads/avatars/missing.jpg"),
    ).resolves.toBe(false);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("isolates other filesystem failures", async () => {
    unlink.mockRejectedValue(
      Object.assign(new Error("denied"), { code: "EACCES" }),
    );

    await expect(
      deleteOldAvatarFile("/uploads/avatars/protected.jpg"),
    ).resolves.toBe(false);
    expect(log.error).toHaveBeenCalled();
  });

  it("uses the same asynchronous deletion path through cleanupOldAvatar", async () => {
    await expect(
      cleanupOldAvatar("user-1", "/uploads/avatars/old.webp"),
    ).resolves.toBe(true);
    expect(unlink).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledWith(
      "Cleaning up old avatar for user",
      undefined,
      expect.objectContaining({ userId: "user-1" }),
    );
  });
});
