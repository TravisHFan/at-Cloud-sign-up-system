import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  compressUploadedImage,
  logCompressionStats,
  includeCompressionInfo,
} from "../../../src/middleware/imageCompression";

// Mock ImageCompressionService methods
vi.mock("../../../src/services/ImageCompressionService", () => ({
  ImageCompressionService: {
    validateImageFile: vi.fn(async () => ({ isValid: true })),
    getCompressionProfile: vi.fn(() => ({ quality: 80, maxWidth: 1024 })),
    compressImage: vi.fn(async (inputPath: string) => ({
      originalPath: inputPath,
      compressedPath: inputPath.replace(/\.jpg$/, ".compressed.jpg"),
      originalSize: 1000,
      compressedSize: 400,
      compressionRatio: 60,
      dimensions: { width: 800, height: 600 },
    })),
    formatFileSize: vi.fn((n: number) => `${n}B`),
  },
}));

import { ImageCompressionService } from "../../../src/services/ImageCompressionService";

const makeReqResNext = (file?: Partial<Express.Multer.File>) => {
  const req = {
    file: file as any,
  } as unknown as Request & { compressionResult?: any };

  let statusCode = 200;
  let jsonBody: any = undefined;
  const res = {
    status: vi.fn((code: number) => {
      statusCode = code;
      return res as any;
    }),
    json: vi.fn((body: any) => {
      jsonBody = body;
      return res as any;
    }),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;
  return {
    req,
    res,
    next,
    get statusCode() {
      return statusCode;
    },
    get jsonBody() {
      return jsonBody;
    },
  };
};

describe("imageCompression middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when no file and calls next()", async () => {
    const { req, res, next } = makeReqResNext();
    await compressUploadedImage(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("validates, compresses, mutates req.file, sets compressionResult, then next()", async () => {
    const { req, res, next } = makeReqResNext({
      fieldname: "avatar",
      filename: "photo.jpg",
      path: "/tmp/photo.jpg",
      size: 1234,
    });

    await compressUploadedImage(req, res, next);

    expect(ImageCompressionService.validateImageFile).toHaveBeenCalledWith(
      "/tmp/photo.jpg"
    );
    expect(ImageCompressionService.getCompressionProfile).toHaveBeenCalledWith(
      "avatar"
    );
    expect(ImageCompressionService.compressImage).toHaveBeenCalled();

    // req.file mutated
    expect(req.file?.path).toBe("/tmp/photo.compressed.jpg");
    expect(req.file?.filename).toBe("photo.compressed.jpg");
    expect(req.file?.size).toBe(400);

    // compressionResult assigned
    expect(req.compressionResult).toMatchObject({
      originalSize: 1000,
      compressedSize: 400,
      compressionRatio: 60,
      dimensions: { width: 800, height: 600 },
    });

    expect(next).toHaveBeenCalled();
  });

  it("returns 400 when validateImageFile says invalid", async () => {
    (ImageCompressionService.validateImageFile as any).mockResolvedValueOnce({
      isValid: false,
      error: "not image",
    });

    const ctx = makeReqResNext({
      fieldname: "avatar",
      filename: "photo.jpg",
      path: "/tmp/photo.jpg",
      size: 1234,
    });

    await compressUploadedImage(ctx.req, ctx.res, ctx.next);

    expect(ctx.statusCode).toBe(400);
    expect(ctx.jsonBody).toMatchObject({ success: false });
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it("handle exception with 500 json", async () => {
    (ImageCompressionService.validateImageFile as any).mockRejectedValueOnce(
      new Error("boom")
    );

    const ctx = makeReqResNext({
      fieldname: "avatar",
      filename: "photo.jpg",
      path: "/tmp/photo.jpg",
      size: 1234,
    });

    await compressUploadedImage(ctx.req, ctx.res, ctx.next);

    expect(ctx.statusCode).toBe(500);
    expect(ctx.jsonBody).toMatchObject({ success: false });
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it("logCompressionStats prints stats when present and calls next()", () => {
    const { req, res, next } = makeReqResNext({
      fieldname: "avatar",
      filename: "photo.compressed.jpg",
      path: "/tmp/photo.compressed.jpg",
      size: 400,
    });
    (req as any).compressionResult = {
      originalSize: 1000,
      compressedSize: 400,
      compressionRatio: 60,
      dimensions: { width: 800, height: 600 },
    };

    const spy = vi.spyOn(ImageCompressionService, "formatFileSize");
    logCompressionStats(req, res, next);
    expect(spy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("includeCompressionInfo augments res.json when compressionResult exists", () => {
    const { req } = makeReqResNext({
      fieldname: "avatar",
      filename: "photo.compressed.jpg",
      path: "/tmp/photo.compressed.jpg",
      size: 400,
    });
    (req as any).compressionResult = {
      originalSize: 1000,
      compressedSize: 400,
      compressionRatio: 60,
      dimensions: { width: 800, height: 600 },
    };

    let payload: any;
    const res: any = {
      json: (b: any) => {
        payload = b;
        return res;
      },
    };
    const next: any = vi.fn();

    includeCompressionInfo(req as any, res, next);

    // call json after middleware wraps it
    res.json({ ok: true });

    expect(payload).toMatchObject({
      ok: true,
      compressionInfo: expect.any(Object),
    });
    expect(next).toHaveBeenCalled();
  });
});
