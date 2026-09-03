/**
 * LW-I18N 取色器（/sampler）英文字典
 * 与 ZH_SAMPLER 的 key 一一对应；模板串使用 {token} 占位，
 * 语序按英文习惯自由组织（由 fill() 注入动态值）。
 */
export const EN_SAMPLER: Record<string, string> = {
  // ===== Page-level (server, sampler/page.tsx) =====
  'sampler.page.title': 'Image & Fabric Sampler',
  'sampler.page.backHome': 'Back to Home',
  'sampler.metaTitle': 'Fabric Sampler | LongWoo Studio',
  'sampler.metaDesc':
    'Upload a character sheet to sample pixel colors, auto-matched against Pantone references and the fabric library for quick fabric previews.',

  // ===== Top hint / toolbar =====
  'sampler.hint.clickGuide':
    'Click to add points (≤{max}) · long-press for the pixel loupe · click a point to delete it',

  // ===== Database button =====
  'sampler.db.button': 'Database',
  'sampler.db.all': 'All',
  'sampler.db.custom': 'Custom',
  'sampler.db.loadingSummary': 'Loading database…',
  'sampler.db.summary':
    'Database · {pantone} Pantone swatches · {vendor} vendors ({on} enabled): {detail}',
  'sampler.db.kindSummary': '{kind} {on}/{total} enabled',
  'sampler.db.summarySep': ', ',
  'sampler.db.mobileTitle': 'Database Filter',
  'sampler.db.closePanel': 'Close database panel',

  // ===== Pantone library panel =====
  'sampler.pantone.title': 'Pantone Library',
  'sampler.pantone.sub': 'Official standard library · {n} swatches · always included',

  // ===== Fabric library panel =====
  'sampler.fabricLib.label': 'Fabric Library',
  'sampler.fabricLib.kindPrefix': 'Kind · {kind}',
  'sampler.fabricLib.vendorOffTitle': 'Click to enable this vendor',
  'sampler.fabricLib.vendorOnTitle': 'Click to disable this vendor',
  'sampler.fabricLib.colorCount': '{count} colors',
  'sampler.fabricLib.moreKinds': 'More kinds (not enabled yet)',
  'sampler.fabricLib.notImported': 'Not imported',
  'sampler.fabricLib.panelNote':
    'Disabled fabric vendors are excluded from sampling results; keep at least one fabric library vendor enabled.',

  // ===== Upload / drop =====
  'sampler.upload.replace': 'Replace image',
  'sampler.upload.new': 'Upload image',
  'sampler.drop.title': 'Drag an image here, or click to choose',
  'sampler.drop.sub': 'Processed locally — nothing is uploaded · supports jpg / png / webp / gif',
  'sampler.img.sourceAlt': 'Source image for sampling',

  // ===== Loupe / zoom / status bar =====
  'sampler.loupe.release': 'Release to pick',
  'sampler.loupe.press': 'Long-press to pick…',
  'sampler.statusBar.pressLocked': 'Pixel locked — move the loupe to position, then release to pick',
  'sampler.statusBar.pressMove':
    'Hold and drag the loupe; keep holding to lock, then release to pick…',
  'sampler.zoom.restore': 'Click to reset to 100%',
  'sampler.statusBar.pointsSelected': 'Selected {count} / {max} points',
  'sampler.statusBar.waiting': 'Waiting for image upload',

  // ===== Right-side parameters =====
  'sampler.params.title': 'Sampler · Sampling Parameters',
  'sampler.params.clear': 'Clear',
  'sampler.params.emptyNoImage':
    'Parameters appear here after you upload an image and click or long-press to pick colors',
  'sampler.params.emptyNoPoints':
    'Click or long-press the image above to pick colors (up to {max} points)',

  // ===== Delta legend / footnote =====
  'sampler.legend.direct': 'Δ≤0.030 Use directly',
  'sampler.legend.reference': '0.030<Δ≤0.090 Use for reference',
  'sampler.legend.none': 'Δ>0.090 No reference value',
  'sampler.disclaimer':
    'Fabric colors come from vendor color cards (community / sample data, not spectrophotometer measurements); Pantone matches are approximate — confirm against the official color card before final delivery.',

  // ===== Point card =====
  'sampler.card.deleteAria': 'Delete point {n}',
  'sampler.card.pantoneRef': 'Pantone refs ×{n}',
  'sampler.card.expand': 'Details',
  'sampler.card.collapse': 'Hide details',
  'sampler.card.fabricsTop': 'Top 3 Fabrics',
  'sampler.card.fabricsLoading': 'Loading fabric library…',

  // ===== Fabric row / detail =====
  'sampler.fabricRow.collapseTitle': 'Click again to collapse details: {name} ({vendor})',
  'sampler.fabricRow.viewTitle': 'Click to view fabric details: {name} ({vendor})',
  'sampler.detail.largeImgFailed': 'Image failed to load — large preview is unavailable',
  'sampler.detail.viewLarge': 'Click to view large preview',
  'sampler.detail.colorFamily': 'Color family',
  'sampler.detail.furLength': 'Fur length',
  'sampler.detail.kind': 'Fabric kind',
  'sampler.detail.pantone': 'Pantone',
  'sampler.detail.zoomAria': '{name} ({vendor}) large preview',
  'sampler.detail.closeZoom': 'Close large preview',
  'sampler.detail.overlayHint': 'Click the overlay to close',

  // ===== showStatus messages =====
  'sampler.status.dbReady':
    'Database ready: {pantone} Pantone swatches · {fabric} fabric colors / {vendor} vendors{dataNote} · upload an image, then click / long-press to pick colors',
  'sampler.status.liveData': ' (live data)',
  'sampler.status.sampleData': ' (sample data)',
  'sampler.status.imageOnly': 'Only image files are supported (jpg / png / webp / gif)',
  'sampler.status.imgLoaded':
    'Loaded {w} × {h}px · scroll / pinch to zoom · click / long-press to pick (up to {max} points)',
  'sampler.status.pointDeleted': 'Removed point {id} ({x}, {y})',
  'sampler.status.maxPoints': 'A maximum of {max} points can be selected — delete some first',
  'sampler.status.pixelAlready': 'Pixel ({x}, {y}) is already selected — choose another spot',
  'sampler.status.pointAdded': 'Point {id} selected · pixel ({x}, {y}) · #{hex}',
  'sampler.status.pointRemoved': 'Removed point {id}',
  'sampler.status.cleared': 'All sample points cleared',
  'sampler.status.keepOneVendor': 'Keep at least one fabric vendor enabled — they cannot all be off',

  // ===== SamplerDock (top-right dock) =====
  'sampler.switchLangTip': 'Switch language',
  'sampler.dock.exportAria': 'Export data',
  'sampler.dock.exportHead': 'Export data',
  'sampler.dock.close': 'Close',
  'sampler.dock.pointCount': '{count} pts',
  'sampler.dock.checking': 'Checking authorization…',
  'sampler.dock.guestTitle': 'Sign in required to export sampled data',
  'sampler.dock.guestDesc':
    'After signing in, an admin role with the “Test B” authorization tag is required to export to your computer',
  'sampler.dock.guestCta': 'Sign in',
  'sampler.dock.deniedTitle': 'No export permission',
  'sampler.dock.deniedDefault':
    'This account does not have the “Test B” export authorization tag — contact an administrator to enable it',
  'sampler.dock.checkFailed': 'Authorization check failed. Please try again later.',
  'sampler.dock.imgLabel': 'Image · ',
  'sampler.dock.dbLabel': 'Database · ',
  'sampler.dock.unnamed': 'Untitled',
  'sampler.dock.dims': ' ({w} × {h} px)',
  'sampler.dock.dbInfo': '{pantone} Pantone swatches · {fabric} fabrics / {vendor} vendors',
  'sampler.dock.downloaded': 'Downloaded',
  'sampler.dock.downloadJson': 'Download JSON',
  'sampler.dock.copied': 'Copied',
  'sampler.dock.copyText': 'Copy text',
  'sampler.dock.emptyHint':
    'Nothing sampled yet — upload an image and click to add sample points, then you can export your scheme',
  'sampler.dock.signUp': 'Sign up',
  'sampler.dock.signInSmall': 'Sign in / Register',

  // ===== Plain-text export list (buildExportText) =====
  'sampler.export.title': 'LongWoo · Fabric Color Scheme',
  'sampler.export.time': 'Generated: {time}',
  'sampler.export.source': 'Image source: {name} ({w} × {h} px)',
  'sampler.export.db':
    'Database: {pantone} Pantone swatches · {fabric} fabrics / {vendor} vendors · {enabled} enabled',
  'sampler.export.pantoneLabel': 'Pantone: ',
  'sampler.export.fabricLabel': 'Fabric refs: ',
}
