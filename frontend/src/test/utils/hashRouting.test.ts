import { describe, expect, it } from "vitest";
import {
  getAbsoluteHashRouteUrl,
  getDirectPathHashRouteReplacement,
  getHashRouteUrl,
} from "../../utils/hashRouting";

describe("hash routing helpers", () => {
  it("builds app hash routes", () => {
    expect(getHashRouteUrl("/dashboard/event/evt123")).toBe(
      "/#/dashboard/event/evt123",
    );
  });

  it("builds absolute shareable hash route URLs", () => {
    expect(
      getAbsoluteHashRouteUrl(
        "/dashboard/programs/program-123",
        "https://example.com/",
      ),
    ).toBe("https://example.com/#/dashboard/programs/program-123");
  });

  it("rescues direct program detail links into HashRouter routes", () => {
    expect(
      getDirectPathHashRouteReplacement({
        pathname: "/dashboard/programs/program-123",
        search: "?ref=share",
      }),
    ).toBe("/#/dashboard/programs/program-123?ref=share");
  });

  it("rescues direct event public/detail links into HashRouter routes", () => {
    expect(
      getDirectPathHashRouteReplacement({
        pathname: "/dashboard/event/evt123",
      }),
    ).toBe("/#/dashboard/event/evt123");
    expect(
      getDirectPathHashRouteReplacement({
        pathname: "/p/public-event",
      }),
    ).toBe("/#/p/public-event");
  });

  it("does not rewrite when a hash route is already present", () => {
    expect(
      getDirectPathHashRouteReplacement({
        pathname: "/dashboard/programs/program-123",
        hash: "#/dashboard/programs/program-123",
      }),
    ).toBeNull();
  });
});
