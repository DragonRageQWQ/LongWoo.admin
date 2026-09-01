/**
 * 取样器图片视图变换：缩放（zoom）+ 平移（pan）纯函数模型
 *
 * 模型：源图按 object-contain 居中显示（fitRect），显示层再叠加
 * `transform: translate(panX, panY) scale(zoom)`，变换原点为 fitRect 中心。
 * 坐标约定：所有 client 坐标为容器相对坐标（容器左上角为原点）。
 *
 * 桌面：滚轮以光标为锚点缩放；移动端：两指以中点锚点捏合缩放。
 * 放大（zoom > 1）后按住拖动为平移，单击 / 长按取色逻辑保持不变。
 */

export interface ViewState {
  /** 缩放倍率（1 = 100%，≥1） */
  zoom: number
  /** 图片中心相对容器中心的水平偏移（容器 px） */
  panX: number
  /** 图片中心相对容器中心的垂直偏移（容器 px） */
  panY: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 8
/** 滚轮单步缩放倍率 */
export const ZOOM_STEP = 1.25
/** 判定为拖动平移的最小位移（px） */
export const PAN_THRESHOLD = 6

export const IDENTITY_VIEW: ViewState = { zoom: 1, panX: 0, panY: 0 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 图片中心在容器中的坐标 */
export function viewCenter(view: ViewState, cw: number, ch: number): { x: number; y: number } {
  return { x: cw / 2 + view.panX, y: ch / 2 + view.panY }
}

/** 图片显示矩形（容器坐标，已含缩放与平移） */
export function viewImageRect(
  view: ViewState,
  fitW: number,
  fitH: number,
  cw: number,
  ch: number,
): { x: number; y: number; w: number; h: number } {
  const c = viewCenter(view, cw, ch)
  return {
    x: c.x - (fitW * view.zoom) / 2,
    y: c.y - (fitH * view.zoom) / 2,
    w: fitW * view.zoom,
    h: fitH * view.zoom,
  }
}

/** 容器坐标 → 图像像素；不在图片显示范围内返回 null */
export function clientToPixel(
  clientX: number,
  clientY: number,
  view: ViewState,
  fitW: number,
  fitH: number,
  imgW: number,
  imgH: number,
  cw: number,
  ch: number,
): { px: number; py: number } | null {
  const r = viewImageRect(view, fitW, fitH, cw, ch)
  const ox = clientX - r.x
  const oy = clientY - r.y
  if (ox < 0 || oy < 0 || ox > r.w || oy > r.h) return null
  return {
    px: Math.min(imgW - 1, Math.max(0, Math.round((ox / r.w) * imgW))),
    py: Math.min(imgH - 1, Math.max(0, Math.round((oy / r.h) * imgH))),
  }
}

/** 图像像素 → 容器显示坐标（选点标记 / 放大镜定位） */
export function pixelToClient(
  px: number,
  py: number,
  view: ViewState,
  fitW: number,
  fitH: number,
  imgW: number,
  imgH: number,
  cw: number,
  ch: number,
): { x: number; y: number } {
  const r = viewImageRect(view, fitW, fitH, cw, ch)
  return { x: r.x + (px / imgW) * r.w, y: r.y + (py / imgH) * r.h }
}

/**
 * 以 anchor（容器坐标）为锚点缩放 factor 倍，锚点下的图像内容保持不动
 * （缩小至 1 时平移自动归零，即“返回 100% 比例”）
 */
export function zoomAt(
  view: ViewState,
  anchorX: number,
  anchorY: number,
  factor: number,
  cw: number,
  ch: number,
): ViewState {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  if (zoom === view.zoom) return view
  const k = zoom / view.zoom
  const c = viewCenter(view, cw, ch)
  if (zoom <= MIN_ZOOM) return IDENTITY_VIEW
  return {
    zoom,
    panX: anchorX - (anchorX - c.x) * k - cw / 2,
    panY: anchorY - (anchorY - c.y) * k - ch / 2,
  }
}

/** 平移边界收敛：图片边缘不越过容器可视区（图片小于容器时 pan 归零） */
export function clampPan(view: ViewState, fitW: number, fitH: number, cw: number, ch: number): ViewState {
  if (view.zoom <= MIN_ZOOM) return IDENTITY_VIEW
  const imgW = fitW * view.zoom
  const imgH = fitH * view.zoom
  const maxX = Math.max(0, (imgW - cw) / 2)
  const maxY = Math.max(0, (imgH - ch) / 2)
  return { ...view, panX: clamp(view.panX, -maxX, maxX), panY: clamp(view.panY, -maxY, maxY) }
}

/** 两指捏合：以中点 anchor 缩放（dist/startDist 为距离比），结果含边界收敛 */
export function pinchZoom(
  view: ViewState,
  anchorX: number,
  anchorY: number,
  startDist: number,
  dist: number,
  fitW: number,
  fitH: number,
  cw: number,
  ch: number,
): ViewState {
  if (startDist <= 0 || dist <= 0) return view
  const next = zoomAt(view, anchorX, anchorY, dist / startDist, cw, ch)
  return clampPan(next, fitW, fitH, cw, ch)
}

/** 平移增量应用（含边界收敛） */
export function panBy(view: ViewState, dx: number, dy: number, fitW: number, fitH: number, cw: number, ch: number): ViewState {
  return clampPan({ ...view, panX: view.panX + dx, panY: view.panY + dy }, fitW, fitH, cw, ch)
}
