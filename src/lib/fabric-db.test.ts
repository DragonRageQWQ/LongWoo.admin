import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FABRIC_CIDS,
  fabricImagePath,
  fabricOklab,
  matchFabrics,
  normalizeFabric,
  type FabricItem,
} from "./fabric-types";

const raw = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public/fabric/fabric-data.json"), "utf8")
) as FabricItem[];
const fabrics = raw.map((f) => normalizeFabric(f));
const validCids = new Set(FABRIC_CIDS.map((c) => c.cid));

describe("毛布数据库（public/fabric/fabric-data.json）", () => {
  it("商家与条目数符合预期", () => {
    const counts = new Map<string, number>();
    for (const f of raw) counts.set(f.vendor, (counts.get(f.vendor) ?? 0) + 1);
    expect(counts.get("咩咩毛")).toBe(71);
    expect(counts.get("年糕毛")).toBe(43);
    expect(counts.get("犬物语")).toBe(71);
    expect(counts.get("月亮毛")).toBe(102);
    expect(counts.get("海鲜毛")).toBe(108);
    expect(counts.get("柔光狐")).toBe(50);
    expect(counts.get("瑶光狐")).toBe(54);
    expect(counts.get("似水毛")).toBe(93);
    expect(counts.get("冰淇淋")).toBe(94);
    expect(counts.get("软糖鲨")).toBe(103);
    expect(raw).toHaveLength(789);
  });

  it("id 唯一且 cid 合法", () => {
    expect(new Set(raw.map((f) => f.id)).size).toBe(raw.length);
    for (const f of raw) expect(validCids.has(f.cid)).toBe(true);
  });

  it("oklab 与 sRGB 自洽（容差 0.0005）", () => {
    for (const f of raw) {
      const computed = fabricOklab(f.sRGB[0], f.sRGB[1], f.sRGB[2]);
      const stored = f.oklab ?? [];
      stored.forEach((v, i) => expect(Math.abs(v - computed[i])).toBeLessThan(0.0005));
    }
  });

  it("每条 source 都有对应图片文件", () => {
    const dir = path.join(process.cwd(), "public/fabric");
    const files = new Set(fs.readdirSync(dir));
    for (const f of raw) expect(files.has(f.source)).toBe(true);
  });

  it("fabricImagePath 路径可解码回真实文件", () => {
    const dir = path.join(process.cwd(), "public/fabric");
    const sample = raw.find((f) => f.vendor === "月亮毛")!;
    const p = fabricImagePath(sample.source);
    expect(p.startsWith("/fabric/")).toBe(true);
    const decoded = decodeURIComponent(p.replace("/fabric/", ""));
    expect(fs.existsSync(path.join(dir, decoded))).toBe(true);
  });

  it("以自身颜色匹配，Top1 应命中自身", () => {
    const byId = new Map(fabrics.map((f) => [f.id, f]));
    for (const id of ["0072", "0115", "0186", "0231", "0288", "0356", "0406", "0460"]) {
      const target = byId.get(id)!;
      const top = matchFabrics(target.oklab, fabrics, 1);
      expect(top[0].fabric.id).toBe(id);
      expect(top[0].delta).toBeCloseTo(0, 6);
    }
  });

  it("跨商家匹配：暖红应命中红色系毛布", () => {
    const top = matchFabrics(fabricOklab(190, 40, 45), fabrics, 5);
    expect(top.length).toBe(5);
    expect(top[0].delta).toBeLessThan(0.1);
    // 偏橙的暖红可能落入黄-橙（c02）或褐（c03），但红色系（c01）应进入 Top5
    for (const m of top) expect(["c01", "c02", "c03"]).toContain(m.fabric.cid);
    expect(top.some((m) => m.fabric.cid === "c01")).toBe(true);
  });
});
