import { describe, expect, it } from "vitest";
import { srgbToOklab, matchPantone, rgbToHex } from "./color-math";

const close = (a: number, b: number, eps = 0.001) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("srgbToOklab（已知参考值）", () => {
  it("白色 → L=1, a=0, b=0", () => {
    const l = srgbToOklab(255, 255, 255);
    close(l.L, 1); close(l.a, 0); close(l.b, 0);
  });
  it("黑色 → L=0, a=0, b=0", () => {
    const l = srgbToOklab(0, 0, 0);
    close(l.L, 0); close(l.a, 0); close(l.b, 0);
  });
  it("红色 → 已知参考值", () => {
    const l = srgbToOklab(255, 0, 0);
    close(l.L, 0.627955, 0.002);
    close(l.a, 0.224863, 0.002);
    close(l.b, 0.125846, 0.002);
  });
  it("绿色 → 已知参考值", () => {
    const l = srgbToOklab(0, 255, 0);
    close(l.L, 0.866439, 0.002);
    close(l.a, -0.233888, 0.002);
    close(l.b, 0.179498, 0.002);
  });
  it("蓝色 → 已知参考值", () => {
    const l = srgbToOklab(0, 0, 255);
    close(l.L, 0.452014, 0.002);
    close(l.a, -0.032458, 0.002);
    close(l.b, -0.311528, 0.002);
  });
});

describe("matchPantone / rgbToHex", () => {
  it("Classic Blue 近似匹配（19-4052 #0F4C81）", () => {
    const m = matchPantone(15, 76, 129);
    expect(m?.code).toContain("19-4052");
  });
  it("接近黑色的颜色匹配到 Black C 或深色参考", () => {
    const m = matchPantone(45, 41, 38);
    expect(m?.delta).toBeLessThan(0.05);
  });
  it("rgbToHex 格式化", () => {
    expect(rgbToHex(15, 76, 129)).toBe("#0F4C81");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 254, 221)).toBe("#FFFEDD");
  });
});
