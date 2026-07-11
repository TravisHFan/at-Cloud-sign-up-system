import { beforeEach, describe, expect, it, vi } from "vitest";
import { programsService } from "./programs.api";

describe("programsService.listPrograms", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  function respondWith(data: unknown[]) {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({ success: true, data }),
    });
  }

  it("bounds legacy array requests to 100 programs", async () => {
    respondWith([]);

    await programsService.listPrograms();

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toMatch(/\/programs$/);
    expect(url.searchParams.get("limit")).toBe("100");
  });

  it("forwards explicit pagination and preserves the array response contract", async () => {
    const programs = [{ id: "program-1", title: "Mentor Program" }];
    respondWith(programs);

    const result = await programsService.listPrograms({
      type: "Webinar",
      q: "mentor",
      page: 2,
      limit: 25,
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      type: "Webinar",
      q: "mentor",
      page: "2",
      limit: "25",
    });
    expect(result).toEqual(programs);
  });
});
