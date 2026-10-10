// tests/release.test.ts
// M14: the forced-upgrade comparison. A wrong answer here either locks everyone out or lets an unsupported build keep running, so it is covered edge by edge.
import { compareVersions, minFor, needsUpgrade, parseVersion } from "@/features/release/version";

describe("parseVersion", () => {
  it("reads dotted numbers and tolerates a v prefix and a pre-release tail", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v2.0")).toEqual([2, 0]);
    expect(parseVersion("1.4.0-beta.2")).toEqual([1, 4, 0]);
  });
  it("rejects anything else", () => {
    for (const bad of ["", "abc", "1..2", "1.x", null, undefined]) expect(parseVersion(bad as string)).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by number, not by text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
  });
  it("treats missing parts as zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1", "1.0.1")).toBe(-1);
  });
  it("returns null when either side is unreadable", () => { expect(compareVersions("1.0.0", "soon")).toBeNull(); });
});

describe("needsUpgrade", () => {
  it("blocks only a build older than the minimum", () => {
    expect(needsUpgrade("1.0.0", "1.1.0")).toBe(true);
    expect(needsUpgrade("1.1.0", "1.1.0")).toBe(false);
    expect(needsUpgrade("1.2.0", "1.1.0")).toBe(false);
  });
  it("fails open: a missing or damaged setting never locks anyone out", () => {
    expect(needsUpgrade("1.0.0", undefined)).toBe(false);
    expect(needsUpgrade("1.0.0", "garbage")).toBe(false);
    expect(needsUpgrade(null, "2.0.0")).toBe(false);
  });
});

describe("minFor", () => {
  it("reads this platform's value from the stored setting", () => {
    expect(minFor({ ios: "1.2.0", android: "1.1.0" }, "android")).toBe("1.1.0");
    expect(minFor({ ios: "1.2.0" }, "android")).toBeUndefined();
  });
  it("ignores values that are not strings or not an object", () => {
    expect(minFor({ ios: 12 }, "ios")).toBeUndefined();
    expect(minFor(null, "ios")).toBeUndefined();
    expect(minFor("1.0.0", "ios")).toBeUndefined();
  });
});
