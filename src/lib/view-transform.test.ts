import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clientToPixel,
  clampPan,
  panBy,
  pinchZoom,
  pixelToClient,
  viewCenter,
  viewImageRect,
  zoomAt,
  type ViewState,
} from "./view-transform";

// 容器 800x600，源图 1000x800 → fitRect（object-contain）：w=750 h=600，居中
const CW = 800
const CH = 600
const IMG_W = 1000
const IMG_H = 800
const FIT_W = 750
const FIT_H = 600

const base: ViewState = { zoom: 1, panX: 0, panY: 0 }

describe("view-transform 基础换算", () => {
  it("zoom=1 时图片居中，中心对应图像中心", () => {
    const r = viewImageRect(base, FIT_W, FIT_H, CW, CH)
    expect(r).toEqual({ x: 25, y: 0, w: 750, h: 600 })
    const px = clientToPixel(CW / 2, CH / 2, base, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    expect(px).toEqual({ px: 500, py: 400 })
  });

  it("clientToPixel 在图片范围外返回 null", () => {
    expect(clientToPixel(10, 300, base, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)).toBeNull()
    expect(clientToPixel(400, 610, base, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)).toBeNull()
  });

  it("pixelToClient 与 clientToPixel 互逆（图像内像素）", () => {
    const c = pixelToClient(100, 200, base, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    const back = clientToPixel(c.x, c.y, base, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    expect(back).toEqual({ px: 100, py: 200 })
  });
});

describe("zoomAt 锚点缩放", () => {
  it("以图像中心为锚放大 2 倍后中心像素不变，pan 归零", () => {
    const v = zoomAt(base, CW / 2, CH / 2, 2, CW, CH)
    expect(v.zoom).toBe(2)
    expect(v.panX).toBe(0)
    expect(v.panY).toBe(0)
    const px = clientToPixel(CW / 2, CH / 2, v, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    expect(px).toEqual({ px: 500, py: 400 })
  });

  it("以非中心锚点缩放：锚点下的图像像素保持不动", () => {
    const anchor = { x: 600, y: 400 }
    const before = clientToPixel(anchor.x, anchor.y, base, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)!
    const v = zoomAt(base, anchor.x, anchor.y, 1.6, CW, CH)
    const after = clientToPixel(anchor.x, anchor.y, v, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    expect(after).toEqual(before)
  });

  it("缩放钳制在 [1, 8]，缩小至 1 时重置平移", () => {
    expect(zoomAt({ zoom: 7.5, panX: 50, panY: 30 }, CW / 2, CH / 2, 2, CW, CH).zoom).toBe(MAX_ZOOM)
    const v = zoomAt(base, CW / 2, CH / 2, 0.5, CW, CH)
    expect(v.zoom).toBe(MIN_ZOOM)
    expect(v.panX).toBe(0)
    expect(v.panY).toBe(0)
  });
});

describe("clampPan / panBy / pinchZoom", () => {
  it("clampPan：放大后平移不越界", () => {
    const v: ViewState = { zoom: 2, panX: 9999, panY: -9999 }
    const c = clampPan(v, FIT_W, FIT_H, CW, CH)
    expect(c.panX).toBe((FIT_W * 2 - CW) / 2) // 750*2-800=700 → 350
    expect(c.panY).toBe(-((FIT_H * 2 - CH) / 2)) // 600*2-600=600 → 300
  });

  it("zoom=1 时 pan 恒为零", () => {
    expect(clampPan({ zoom: 1, panX: 100, panY: 100 }, FIT_W, FIT_H, CW, CH)).toEqual(base)
  });

  it("panBy 增量移动并收敛边界", () => {
    const v: ViewState = { zoom: 2, panX: 0, panY: 0 }
    const p = panBy(v, 100, 50, FIT_W, FIT_H, CW, CH)
    expect(p.panX).toBe(100)
    expect(p.panY).toBe(50)
    const p2 = panBy(p, 9999, 0, FIT_W, FIT_H, CW, CH)
    expect(p2.panX).toBe(350)
  });

  it("pinchZoom 放大到 2 倍后，再次等比例捏合保持不变", () => {
    const startDist = 100
    const v = pinchZoom(base, CW / 2, CH / 2, startDist, 200, FIT_W, FIT_H, CW, CH)
    expect(v.zoom).toBe(2)
    const v2 = pinchZoom(v, CW / 2, CH / 2, 200, 100, FIT_W, FIT_H, CW, CH)
    expect(v2.zoom).toBeCloseTo(1, 6)
  });
});

// 回归：取色点标记必须始终锚定同一图像像素。
// 组件渲染不再缓存选点时的显示坐标，而是用「像素坐标 + 当前 view」实时换算
// pixelToClient —— 本测试保证该换算在任意缩放/平移序列下都指向原像素。
describe("选点锚定不变性（取样器缩放/平移后标记贴住像素）", () => {
  const sampledPixel = { px: 137, py: 268 } // 用户选中的图像像素

  it("任意视图下 pixelToClient 显示位置都能反解回原像素", () => {
    const views: ViewState[] = [
      base,
      zoomAt(base, CW / 2, CH / 2, 4, CW, CH),
      zoomAt(base, 150, 500, 2.5, CW, CH),
      clampPan({ zoom: 8, panX: 123, panY: -77 }, FIT_W, FIT_H, CW, CH),
      { zoom: 3.2, panX: -90, panY: 45 },
    ]
    for (const v of views) {
      const disp = pixelToClient(sampledPixel.px, sampledPixel.py, v, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
      const back = clientToPixel(disp.x, disp.y, v, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
      expect(back, `view=${JSON.stringify(v)}`).toEqual(sampledPixel)
    }
  });

  it("放大后再缩小回 100%：显示位置回到初始坐标（不残留错位）", () => {
    const at100 = pixelToClient(sampledPixel.px, sampledPixel.py, base, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    const zoomed = zoomAt(base, 300, 200, 3, CW, CH)
    const atZoom = pixelToClient(sampledPixel.px, sampledPixel.py, zoomed, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    // 放大后标记确实随图片位移（覆盖原 bug：缓存静态坐标不跟随）
    expect(atZoom).not.toEqual(at100)
    // 缩小回 100%（clampPan 归零）后标记回到与图片一致的初始位置
    const back = clampPan({ zoom: 0.5, panX: 0, panY: 0 }, FIT_W, FIT_H, CW, CH)
    expect(back).toEqual(base)
    const atBack = pixelToClient(sampledPixel.px, sampledPixel.py, back, FIT_W, FIT_H, IMG_W, IMG_H, CW, CH)
    expect(atBack).toEqual(at100)
  });
});
