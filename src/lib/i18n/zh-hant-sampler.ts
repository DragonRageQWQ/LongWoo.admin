/**
 * 繁體中文（zh-Hant）取色器（/sampler）字典
 * 覆蓋圖片與毛布取色器主體（UnifiedSampler）、右上角 dock（SamplerDock）與
 * 服務端頁頭／metadata。對照簡體源：src/lib/i18n/zh-sampler.ts（103 鍵，
 * 本檔鍵集合與所有 {token} 與源檔完全一致）。
 *
 * 用詞基線（依 i18n-quality-baseline.md 第 5 節「繁體中文（zh-Hant）用詞基線」，
 * 並與 zh-hant-pages.ts / zh-hant-admin.ts 既有風格對齊）：
 *  - 台灣慣用：載入／上傳／點擊／拖曳／鬆開／縮放／捲動／刪除／新增／儲存／
 *    設定／搜尋／網路／圖片／伺服器／檔案／篩選／匯出／下載／複製／登入／註冊。
 *  - 訊息（message）與資訊（information）分流；資料（data）統一用「資料」。
 *  - 計數詞：色庫以「條」計、毛布商家以「家」計、毛布色數用「色」、取樣點用「點」。
 *  - 引號一律「」；中文語句內標點用全形。
 *
 * 翻譯取捨說明：
 *  1. 簡體源中的「潘通」於繁中一律還原為 Pantone（品牌基線：Pantone 保留原文，
 *     避免與簡中譯名歧義、並達跨語言一致）。例：潘通色庫 → Pantone 色庫。
 *  2. 「毛布」指人造毛皮布料（faux fur），與全站 zh-Hant 基線一致保留「毛布」。
 *  3. 動作用語：松手→鬆開、拖拽→拖曳、添加（取色點）→新增、导入→匯入、
 *     數據→資料、服務器→伺服器、匹配→比對、支持→支援。
 *  4. 行業專名與英文原樣保留：Pantone、sRGB、OKLab、Top 3、Δ、LongWoo、
 *     Studio、Sign up、jpg/png/webp/gif、px、cm；檔名／數值中的半形逗號、斜線維持源檔。
 *  5. 簡體源中略寫的指令（如「点已选点删除」）補全為通順祈使句，語義不增減。
 */
export const ZH_HANT_SAMPLER: Record<string, string> = {
  // ===== 頁面級（sampler/page.tsx 服務端）=====
  'sampler.page.title': '圖片與毛布取色器',
  'sampler.page.backHome': '返回首頁',
  'sampler.metaTitle': '毛布取色器 | LongWoo Studio',
  'sampler.metaDesc':
    '上傳設定圖進行像素取色，自動比對 Pantone 參考色與毛布色庫，快速預覽毛布搭配效果。',

  // ===== 頂部提示 / 工具條 =====
  'sampler.hint.clickGuide': '點擊選點（≤{max}）· 長按放大鏡精確取色 · 點擊已選點可刪除',

  // ===== 資料庫按鈕 =====
  'sampler.db.button': '資料庫',
  'sampler.db.all': '全部',
  'sampler.db.custom': '自訂',
  'sampler.db.loadingSummary': '資料庫載入中…',
  'sampler.db.summary': '資料庫 · Pantone {pantone} 條 · {vendor} 個毛布系列（開啟 {on} 個）：{detail}',
  'sampler.db.kindSummary': '{kind} {on}／{total} 開啟',
  'sampler.db.summarySep': '；',
  'sampler.db.mobileTitle': '資料庫篩選',
  'sampler.db.closePanel': '關閉資料庫面板',

  // ===== Pantone 色庫面板 =====
  'sampler.pantone.title': 'Pantone 色庫',
  'sampler.pantone.sub': '官方常用色庫 · {n} 條 · 必選',

  // ===== 毛布色庫面板 =====
  'sampler.fabricLib.label': '毛布色庫',
  'sampler.fabricLib.kindPrefix': '種類 · {kind}',
  'sampler.fabricLib.vendorOffTitle': '點擊開啟該系列',
  'sampler.fabricLib.vendorOnTitle': '點擊關閉該系列',
  'sampler.fabricLib.colorCount': '{count} 色',
  'sampler.fabricLib.moreKinds': '更多種類（暫未開啟）',
  'sampler.fabricLib.notImported': '未匯入',
  'sampler.fabricLib.panelNote': '關閉的毛布商家不會出現在取色比對結果中；請至少保留一個毛布色庫開啟。',

  // ===== 上傳 / 拖曳 =====
  'sampler.upload.replace': '更換圖片',
  'sampler.upload.new': '上傳圖片',
  'sampler.drop.title': '拖曳圖片到此處，或點擊選擇',
  'sampler.drop.sub': '本機處理，不上傳伺服器 · 支援 jpg / png / webp / gif',
  'sampler.img.sourceAlt': '取色來源圖',

  // ===== 放大鏡 / 縮放 / 狀態列 =====
  'sampler.loupe.release': '鬆開取色',
  'sampler.loupe.press': '長按取色…',
  'sampler.statusBar.pressLocked': '已鎖定像素，移動放大鏡定位，鬆開取色',
  'sampler.statusBar.pressMove': '按住移動放大鏡，長按鎖定後鬆開取色…',
  'sampler.zoom.restore': '點擊恢復 100%',
  'sampler.statusBar.pointsSelected': '已選 {count} / {max} 點',
  'sampler.statusBar.waiting': '等待上傳圖片',

  // ===== 右側參數區 =====
  'sampler.params.title': 'Sampler · 取色參數',
  'sampler.params.clear': '清空',
  'sampler.params.emptyNoImage': '上傳圖片並點擊／長按取色後，參數會顯示在這裡',
  'sampler.params.emptyNoPoints': '在上方圖片中點擊或長按取色（最多 {max} 點）',

  // ===== 色差圖例 / 底部說明 =====
  'sampler.legend.direct': 'Δ≤0.030 直接使用',
  'sampler.legend.reference': '0.030<Δ≤0.090 參考使用',
  'sampler.legend.none': 'Δ>0.090 無參考價值',
  'sampler.disclaimer':
    '毛布色值來自商家色卡（社群／示例資料，非分光儀實測）；Pantone 為近似比對，正式交付請以官方色卡為準',

  // ===== 參數卡（PointCard）=====
  'sampler.card.deleteAria': '刪除選點 {n}',
  'sampler.card.pantoneRef': 'Pantone 參考 ×{n}',
  'sampler.card.expand': '詳細參數',
  'sampler.card.collapse': '收起詳細參數',
  'sampler.card.fabricsTop': '參考毛布 Top 3',
  'sampler.card.fabricsLoading': '毛布庫載入中…',

  // ===== 毛布列 / 毛布詳情 =====
  'sampler.fabricRow.collapseTitle': '再次點擊收回詳情：{name}（{vendor}）',
  'sampler.fabricRow.viewTitle': '點擊查看毛布詳情：{name}（{vendor}）',
  'sampler.detail.largeImgFailed': '圖片載入失敗，暫時無法查看大圖',
  'sampler.detail.viewLarge': '點擊查看大圖',
  'sampler.detail.colorFamily': '色系',
  'sampler.detail.furLength': '毛長',
  'sampler.detail.kind': '毛布種類',
  'sampler.detail.pantone': 'Pantone',
  'sampler.detail.zoomAria': '{name}（{vendor}）大圖預覽',
  'sampler.detail.closeZoom': '關閉大圖預覽',
  'sampler.detail.overlayHint': '點擊遮罩關閉',

  // ===== showStatus 狀態訊息 =====
  'sampler.status.dbReady':
    '資料庫已就緒：Pantone 色庫 {pantone} 條 · 毛布 {fabric} 色／{vendor} 家商家{dataNote} · 上傳圖片後點擊／長按取色',
  'sampler.status.liveData': '（真實資料）',
  'sampler.status.sampleData': '（示例資料）',
  'sampler.status.imageOnly': '僅支援圖片檔案（jpg / png / webp / gif）',
  'sampler.status.imgLoaded':
    '已載入 {w} × {h}px · 滾輪／雙指縮放 · 點擊／長按取色（最多 {max} 點）',
  'sampler.status.pointDeleted': '已刪除點 {id}（{x}, {y}）',
  'sampler.status.maxPoints': '最多選擇 {max} 個點，請先刪除部分選點',
  'sampler.status.pixelAlready': '該像素（{x}, {y}）已選取，請選擇其他位置',
  'sampler.status.pointAdded': '已選點 {id} · 像素（{x}, {y}）· #{hex}',
  'sampler.status.pointRemoved': '已刪除點 {id}',
  'sampler.status.cleared': '已清空全部選點',
  'sampler.status.keepOneVendor': '毛布色庫至少保留一個商家，不能全部關閉',

  // ===== SamplerDock（右上角 dock）=====
  'sampler.switchLangTip': '語言切換',
  'sampler.dock.exportAria': '匯出資料',
  'sampler.dock.exportHead': '匯出資料',
  'sampler.dock.close': '關閉',
  'sampler.dock.pointCount': '{count} 點',
  'sampler.dock.checking': '授權檢查中…',
  'sampler.dock.guestTitle': '匯出取色資料需要登入',
  'sampler.dock.guestDesc': '登入後需為管理員並帶有「測試B」授權標籤，方可匯出到電腦',
  'sampler.dock.guestCta': '前往登入',
  'sampler.dock.deniedTitle': '暫無匯出權限',
  'sampler.dock.deniedDefault': '帳號未獲得「測試B」匯出授權標籤，請聯絡超管開通後再使用',
  'sampler.dock.checkFailed': '授權檢查失敗，請稍後重試',
  'sampler.dock.imgLabel': '圖片 · ',
  'sampler.dock.dbLabel': '資料庫 · ',
  'sampler.dock.unnamed': '未命名',
  'sampler.dock.dims': '（{w} × {h} px）',
  'sampler.dock.dbInfo': 'Pantone {pantone} 條 · 毛布 {fabric} 色／{vendor} 家',
  'sampler.dock.downloaded': '已下載',
  'sampler.dock.downloadJson': '下載 JSON',
  'sampler.dock.copied': '已複製',
  'sampler.dock.copyText': '複製文字',
  'sampler.dock.emptyHint': '尚未取色 —— 先上傳圖片並點擊新增取色點，即可匯出方案',
  'sampler.dock.signUp': 'Sign up',
  'sampler.dock.signInSmall': '登入／註冊',

  // ===== 資料匯出純文字清單（buildExportText）=====
  'sampler.export.title': 'LongWoo · 毛布取色方案',
  'sampler.export.time': '產生時間：{time}',
  'sampler.export.source': '圖片來源：{name}（{w} × {h} px）',
  'sampler.export.db': '資料庫：Pantone {pantone} 條 · 毛布 {fabric} 色／{vendor} 家 · 已開啟 {enabled} 家',
  'sampler.export.pantoneLabel': 'Pantone：',
  'sampler.export.fabricLabel': '毛布參考：',
}
