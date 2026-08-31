import { describe, expect, it } from "vitest";
import {
  cidInfo,
  fabricImagePath,
  fabricOklab,
  fabricPhText,
  matchFabrics,
  normalizeFabric,
  type FabricItem,
} from "./fabric-types";

const item: FabricItem = {
  id: "0001",
  cid: "c00",
  skuId: "mmm001",
  vendor: "咩咩毛",
  name: "漂白",
  ph: 50,
  fabricKind: "长毛",
  sRGB: [236, 232, 226],
  source: "0001漂白-5cm-咩咩毛-mmm001-长毛.png",
};

describe("normalizeFabric", () => {
  it("缺失 oklab 时从 sRGB 计算并补 hex", () => {
    const n = normalizeFabric(item);
    expect(n.hex).toBe("#ECE8E2");
    expect(n.oklab).toHaveLength(3);
    expect(n.oklab[0]).toBeCloseTo(fabricOklab(236, 232, 226)[0], 6);
  });
  it("自带 oklab 时优先使用", () => {
    const n = normalizeFabric({ ...item, oklab: [0.9, 0.01, 0.01] });
    expect(n.oklab).toEqual([0.9, 0.01, 0.01]);
  });
});

describe("matchFabrics", () => {
  const fabrics = Array.from({ length: 3000 }, (_, i) =>
    normalizeFabric({
      ...item,
      id: String(i).padStart(4, "0"),
      sRGB: [(i * 7) % 256, (i * 13) % 256, (i * 19) % 256],
    })
  );

  it("返回 Top N 且按色差升序", () => {
    const target = fabricOklab(200, 100, 60);
    const res = matchFabrics(target, fabrics, 20);
    expect(res).toHaveLength(20);
    for (let i = 1; i < res.length; i++) {
      expect(res[i].delta).toBeGreaterThanOrEqual(res[i - 1].delta);
    }
    // 完全相同的颜色 delta 应为 0
    const exact = matchFabrics(fabrics[0].oklab, fabrics, 1);
    expect(exact[0].delta).toBe(0);
    expect(exact[0].fabric.id).toBe(fabrics[0].id);
  });

  it("3000 条数据匹配性能 < 50ms", () => {
    const target = fabricOklab(80, 140, 200);
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      matchFabrics(target, fabrics, 20);
    }
    const elapsed = performance.now() - start;
    expect(elapsed / 20).toBeLessThan(50);
  });

  it("topN 超过数据量时返回全部", () => {
    const res = matchFabrics([0.5, 0, 0], fabrics.slice(0, 5), 20);
    expect(res).toHaveLength(5);
  });
});

describe("工具函数", () => {
  it("cidInfo 查询与预留兜底", () => {
    expect(cidInfo("c00").label).toBe("黑白灰");
    expect(cidInfo("c08").label).toBe("预留");
    expect(cidInfo("xx").label).toBe("xx");
  });
  it("fabricPhText 单位换算", () => {
    expect(fabricPhText(50)).toBe("50mm（5cm）");
    expect(fabricPhText(35)).toBe("35mm");
  });
  it("fabricImagePath 编码中文文件名", () => {
    expect(fabricImagePath("0001漂白.png")).toContain("fabric/");
    expect(fabricImagePath("0001漂白.png")).toContain("%");
  });
});
