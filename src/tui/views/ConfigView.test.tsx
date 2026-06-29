import { describe, expect, it } from "bun:test";
import type { OmlConfig } from "../../core/config.ts";
import { buildRows } from "./ConfigView.tsx";

describe("buildRows", () => {
  it("shows editable terminalCommand config field when unset", () => {
    // Given
    const config: OmlConfig = { version: 1, repos: [] };

    // When
    const rows = buildRows(config);
    const terminalRow = rows.find((row) => row.key === "top.terminalCommand");

    // Then
    expect(terminalRow).toMatchObject({
      kind: "field",
      label: "terminalCommand",
      value: "(auto)",
      rawValue: undefined,
      path: ["terminalCommand"],
      editKind: "string",
      depth: 0,
    });
    expect(terminalRow?.suggestions).toContain("Ghostty");
  });
});
