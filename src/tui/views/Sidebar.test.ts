import { describe, expect, it } from "bun:test";
import { getSidebarScrollTop } from "./Sidebar.tsx";

describe("getSidebarScrollTop", () => {
  it("keeps a selected row below the first viewport visible", () => {
    const scrollTop = getSidebarScrollTop(46, 18);

    expect(scrollTop).toBe(29);
    expect(46 - scrollTop).toBeLessThan(18);
  });

  it("does not scroll while the selected row is already visible", () => {
    expect(getSidebarScrollTop(5, 18)).toBe(0);
  });
});
