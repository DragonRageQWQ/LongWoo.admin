/**
 * LW-I18N 取色器（/sampler）中文字典
 * 覆盖图片与毛布取样器主体（UnifiedSampler）、右上角 dock（SamplerDock）与
 * 服务端页头/metadata。所有键以 'sampler.' 为前缀；模板串使用 {token} 占位。
 * 文案由 UnifiedSampler / SamplerDock / sampler/page 的 t() + fill() 读取。
 */
export const ZH_SAMPLER: Record<string, string> = {
  // ===== 页面级（sampler/page.tsx 服务端）=====
  'sampler.page.title': '图片与毛布取样器',
  'sampler.page.backHome': '返回首页',
  'sampler.metaTitle': '毛布取色器 | LongWoo Studio',
  'sampler.metaDesc':
    '上传设定图进行像素取色，自动匹配潘通参考色与毛布色库，快速预览毛布搭配效果。',

  // ===== 顶部提示 / 工具条 =====
  'sampler.hint.clickGuide': '点击选点（≤{max}）· 长按放大镜精确取色 · 点已选点删除',

  // ===== 数据库按钮 =====
  'sampler.db.button': '数据库',
  'sampler.db.all': '全量',
  'sampler.db.custom': '自定义',
  'sampler.db.loadingSummary': '数据库加载中…',
  'sampler.db.summary': '数据库 · 潘通 {pantone} 条 · {vendor} 个毛布系列（开启 {on} 个）：{detail}',
  'sampler.db.kindSummary': '{kind} {on}/{total} 开启',
  'sampler.db.summarySep': '；',
  'sampler.db.mobileTitle': '数据库筛选',
  'sampler.db.closePanel': '关闭数据库面板',

  // ===== 潘通色库面板 =====
  'sampler.pantone.title': '潘通色库',
  'sampler.pantone.sub': '官方常用色库 · {n} 条 · 必选',

  // ===== 毛布色库面板 =====
  'sampler.fabricLib.label': '毛布色库',
  'sampler.fabricLib.kindPrefix': '种类 · {kind}',
  'sampler.fabricLib.vendorOffTitle': '点击开启该系列',
  'sampler.fabricLib.vendorOnTitle': '点击关闭该系列',
  'sampler.fabricLib.colorCount': '{count} 色',
  'sampler.fabricLib.moreKinds': '更多种类（暂未开启）',
  'sampler.fabricLib.notImported': '未导入',
  'sampler.fabricLib.panelNote': '关闭的毛布商家不会出现在取色匹配结果中；至少保留一个毛布色库开启。',

  // ===== 上传 / 拖拽 =====
  'sampler.upload.replace': '更换图片',
  'sampler.upload.new': '上传图片',
  'sampler.drop.title': '拖拽图片到此处，或点击选择',
  'sampler.drop.sub': '本地处理，不上传服务器 · 支持 jpg / png / webp / gif',
  'sampler.img.sourceAlt': '取样源图',

  // ===== 放大镜 / 缩放 / 状态条 =====
  'sampler.loupe.release': '松手取色',
  'sampler.loupe.press': '长按取色…',
  'sampler.statusBar.pressLocked': '已锁定像素，移动放大镜定位，松手取色',
  'sampler.statusBar.pressMove': '按住移动放大镜，长按锁定后松手取色…',
  'sampler.zoom.restore': '点击恢复 100%',
  'sampler.statusBar.pointsSelected': '已选 {count} / {max} 点',
  'sampler.statusBar.waiting': '等待上传图片',

  // ===== 右侧参数区 =====
  'sampler.params.title': 'Sampler · 取样参数',
  'sampler.params.clear': '清空',
  'sampler.params.emptyNoImage': '上传图片并点击/长按取色后，参数显示在这里',
  'sampler.params.emptyNoPoints': '在上方图片中点击或长按取色（最多 {max} 点）',

  // ===== 色差图例 / 底部说明 =====
  'sampler.legend.direct': 'Δ≤0.030 直接使用',
  'sampler.legend.reference': '0.030<Δ≤0.090 参考使用',
  'sampler.legend.none': 'Δ>0.090 无参考价值',
  'sampler.disclaimer':
    '毛布色值来自商家色卡（社区/示例数据，非分光仪实测）；潘通为近似匹配，正式交付请以官方色卡为准',

  // ===== 参数卡（PointCard）=====
  'sampler.card.deleteAria': '删除选点 {n}',
  'sampler.card.pantoneRef': 'Pantone 参考 ×{n}',
  'sampler.card.expand': '详细参数',
  'sampler.card.collapse': '收起详细参数',
  'sampler.card.fabricsTop': '参考毛布 Top 3',
  'sampler.card.fabricsLoading': '毛布库加载中…',

  // ===== 毛布行 / 毛布详情 =====
  'sampler.fabricRow.collapseTitle': '再次点击收回详情：{name}（{vendor}）',
  'sampler.fabricRow.viewTitle': '点击查看毛布详情：{name}（{vendor}）',
  'sampler.detail.largeImgFailed': '图片加载失败，暂不可查看大图',
  'sampler.detail.viewLarge': '点击查看大图',
  'sampler.detail.colorFamily': '色系',
  'sampler.detail.furLength': '毛长',
  'sampler.detail.kind': '毛布种类',
  'sampler.detail.pantone': '潘通',
  'sampler.detail.zoomAria': '{name}（{vendor}）大图预览',
  'sampler.detail.closeZoom': '关闭大图预览',
  'sampler.detail.overlayHint': '点击遮罩关闭',

  // ===== showStatus 状态消息 =====
  'sampler.status.dbReady':
    '数据库已就绪：潘通色库 {pantone} 条 · 毛布 {fabric} 色 / {vendor} 家商家{dataNote} · 上传图片后点击/长按取色',
  'sampler.status.liveData': '（真实数据）',
  'sampler.status.sampleData': '（示例数据）',
  'sampler.status.imageOnly': '仅支持图片文件（jpg / png / webp / gif）',
  'sampler.status.imgLoaded':
    '已载入 {w} × {h}px · 滚轮/双指缩放 · 点击/长按取色（最多 {max} 点）',
  'sampler.status.pointDeleted': '已删除点 {id}（{x}, {y}）',
  'sampler.status.maxPoints': '最多选择 {max} 个点，请先删除部分选点',
  'sampler.status.pixelAlready': '该像素（{x}, {y}）已选，请选择其他位置',
  'sampler.status.pointAdded': '已选点 {id} · 像素（{x}, {y}）· #{hex}',
  'sampler.status.pointRemoved': '已删除点 {id}',
  'sampler.status.cleared': '已清空全部选点',
  'sampler.status.keepOneVendor': '毛布色库至少保留一个商家，不能全部关闭',

  // ===== SamplerDock（右上角 dock）=====
  'sampler.switchLangTip': '语言切换',
  'sampler.dock.exportAria': '数据导出',
  'sampler.dock.exportHead': '数据导出',
  'sampler.dock.close': '关闭',
  'sampler.dock.pointCount': '{count} 点',
  'sampler.dock.checking': '授权检查中…',
  'sampler.dock.guestTitle': '导出取色数据需要登录',
  'sampler.dock.guestDesc': '登录后需为管理员并携带「测试B」授权标签方可导出到电脑',
  'sampler.dock.guestCta': '去登录',
  'sampler.dock.deniedTitle': '暂无导出权限',
  'sampler.dock.deniedDefault': '账号未获「测试B」导出授权标签，请联系超管开通后使用',
  'sampler.dock.checkFailed': '授权检查失败，请稍后重试',
  'sampler.dock.imgLabel': '图片 · ',
  'sampler.dock.dbLabel': '数据库 · ',
  'sampler.dock.unnamed': '未命名',
  'sampler.dock.dims': '（{w} × {h} px）',
  'sampler.dock.dbInfo': '潘通 {pantone} 条 · 毛布 {fabric} 色 / {vendor} 家',
  'sampler.dock.downloaded': '已下载',
  'sampler.dock.downloadJson': '下载 JSON',
  'sampler.dock.copied': '已复制',
  'sampler.dock.copyText': '复制文本',
  'sampler.dock.emptyHint': '尚未取色 —— 先上传图片并点击添加取色点，即可导出方案',
  'sampler.dock.signUp': 'Sign up',
  'sampler.dock.signInSmall': '登录/注册',

  // ===== 数据导出纯文本清单（buildExportText）=====
  'sampler.export.title': 'LongWoo · 毛布取色方案',
  'sampler.export.time': '生成时间：{time}',
  'sampler.export.source': '图片来源：{name}（{w} × {h} px）',
  'sampler.export.db': '数据库：潘通 {pantone} 条 · 毛布 {fabric} 色 / {vendor} 家 · 已开启 {enabled} 家',
  'sampler.export.pantoneLabel': 'Pantone：',
  'sampler.export.fabricLabel': '毛布参考：',
}
