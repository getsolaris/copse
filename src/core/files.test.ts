import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "fs";
import { join } from "path";
import { copyFiles, linkFiles, cleanupFiles } from "./files";
import { cleanupTempDirs, createTempDir } from "./test-helpers";

interface TestFs {
  writeFileSync(path: string, data: string): void;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readFileSync(path: string, encoding: "utf-8"): string;
  lstatSync(path: string): { isSymbolicLink(): boolean };
  existsSync(path: string): boolean;
  readlinkSync(path: string): string;
  symlinkSync(target: string, path: string): void;
}

const {
  writeFileSync, mkdirSync, readFileSync,
  lstatSync, existsSync, readlinkSync, symlinkSync,
} = fs as unknown as TestFs;

describe("copyFiles", () => {
  let srcDir: string;
  let dstDir: string;

  function setup() {
    srcDir = createTempDir("omw-files-test-");
    dstDir = createTempDir("omw-files-test-");
  }

  afterEach(() => {
    cleanupTempDirs();
  });

  it("copies existing file to target", () => {
    setup();
    writeFileSync(join(srcDir, ".env"), "SECRET=123");

    const result = copyFiles(srcDir, dstDir, [".env"]);

    expect(result.copied).toEqual([".env"]);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(readFileSync(join(dstDir, ".env"), "utf-8")).toBe("SECRET=123");
  });

  it("skips with warning when source is missing", () => {
    setup();

    const result = copyFiles(srcDir, dstDir, ["missing.txt"]);

    expect(result.copied).toEqual([]);
    expect(result.skipped).toEqual(["missing.txt"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Source not found");
  });

  it("skips with warning when target already exists", () => {
    setup();
    writeFileSync(join(srcDir, ".env"), "NEW_CONTENT");
    writeFileSync(join(dstDir, ".env"), "ORIGINAL");

    const result = copyFiles(srcDir, dstDir, [".env"]);

    expect(result.copied).toEqual([]);
    expect(result.skipped).toEqual([".env"]);
    expect(result.warnings[0]).toContain("Target already exists");
    expect(readFileSync(join(dstDir, ".env"), "utf-8")).toBe("ORIGINAL");
  });
});

describe("linkFiles", () => {
  let srcDir: string;
  let dstDir: string;

  function setup() {
    srcDir = createTempDir("omw-files-test-");
    dstDir = createTempDir("omw-files-test-");
  }

  afterEach(() => {
    cleanupTempDirs();
  });

  it("creates symlink for existing directory", () => {
    setup();
    const subdir = join(srcDir, "node_modules");
    mkdirSync(subdir);

    const result = linkFiles(srcDir, dstDir, ["node_modules"]);

    expect(result.linked).toEqual(["node_modules"]);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);

    const linkPath = join(dstDir, "node_modules");
    expect(existsSync(linkPath)).toBe(true);
  });

  it("skips with warning when source is missing", () => {
    setup();

    const result = linkFiles(srcDir, dstDir, ["nonexistent"]);

    expect(result.linked).toEqual([]);
    expect(result.skipped).toEqual(["nonexistent"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Source not found");
  });

  it("skips with warning when target already exists", () => {
    setup();
    mkdirSync(join(srcDir, "node_modules"));
    mkdirSync(join(dstDir, "node_modules"));

    const result = linkFiles(srcDir, dstDir, ["node_modules"]);

    expect(result.linked).toEqual([]);
    expect(result.skipped).toEqual(["node_modules"]);
    expect(result.warnings[0]).toContain("Target already exists");
  });

  it("created symlink is actually a symlink, not a copy", () => {
    setup();
    const subdir = join(srcDir, "vendor");
    mkdirSync(subdir);
    writeFileSync(join(subdir, "marker.txt"), "proof");

    linkFiles(srcDir, dstDir, ["vendor"]);

    const linkPath = join(dstDir, "vendor");
    const stat = lstatSync(linkPath);
    expect(stat.isSymbolicLink()).toBe(true);

    const target = readlinkSync(linkPath);
    expect(target).toBe(subdir);
  });
});

describe("cleanupFiles", () => {
  let dir: string;

  function setup() {
    dir = createTempDir("omw-files-test-");
  }

  afterEach(() => {
    cleanupTempDirs();
  });

  it("removes a copied file", () => {
    setup();
    writeFileSync(join(dir, ".env"), "data");

    cleanupFiles(dir, [".env"]);

    expect(existsSync(join(dir, ".env"))).toBe(false);
  });

  it("removes a symlink without removing the source", () => {
    setup();
    const sourceDir = createTempDir("omw-files-test-");
    const realDir = join(sourceDir, "real");
    mkdirSync(realDir);
    writeFileSync(join(realDir, "keep.txt"), "important");

    const linkPath = join(dir, "real");
    symlinkSync(realDir, linkPath);

    cleanupFiles(dir, ["real"]);

    expect(existsSync(linkPath)).toBe(false);
    expect(existsSync(join(realDir, "keep.txt"))).toBe(true);
  });

  it("does not throw for non-existent files", () => {
    setup();
    expect(() => cleanupFiles(dir, ["ghost.txt", "phantom.txt"])).not.toThrow();
  });
});
