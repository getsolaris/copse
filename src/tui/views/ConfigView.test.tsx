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

  it("shows update config rows", () => {
    // Given
    const config: OmlConfig = {
      version: 1,
      repos: [],
      updates: {
        enabled: false,
        checkIntervalHours: 6,
        ignoredVersion: "1.2.3",
      },
    };

    // When
    const rows = buildRows(config);

    // Then
    expect(rows.find((row) => row.key === "u.enabled")).toMatchObject({
      kind: "field",
      label: "enabled",
      value: "false",
      rawValue: false,
      path: ["updates", "enabled"],
      editKind: "boolean",
      depth: 1,
    });
    expect(rows.find((row) => row.key === "u.checkIntervalHours")).toMatchObject({
      kind: "field",
      label: "checkIntervalHours",
      value: "6",
      rawValue: 6,
      path: ["updates", "checkIntervalHours"],
      editKind: null,
      depth: 1,
    });
    expect(rows.find((row) => row.key === "u.ignoredVersion")).toMatchObject({
      kind: "field",
      label: "ignoredVersion",
      value: "1.2.3",
      rawValue: "1.2.3",
      path: ["updates", "ignoredVersion"],
      editKind: "string",
      depth: 1,
    });
  });
});
