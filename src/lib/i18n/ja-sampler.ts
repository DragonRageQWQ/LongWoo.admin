/**
 * 日本語（ja）取色サンプラー（/sampler）用辞書
 * 対訳元：src/lib/i18n/zh-sampler.ts（key と一対一対応・全 103 キー）。
 * 文体・ニュアンスの基準：src/lib/i18n/en-sampler.ts。用語は翻訳品質基線（i18n-quality-baseline.md）に従う。
 *
 * 決定事項（取舍）：
 * - 固定訳：毛布→ファー生地、毛长→毛の長さ、取色（動作）→カラー抽出、潘通参考色→Pantone 参考色、色差 Δ→Δ。
 * - ツール名は en の Sampler に合わせ「サンプラー」で統一（画像とファー生地サンプラー）。
 *   metaTitle の「取色器」は基線の固定訳どおり「カラー抽出」とした（zh の「取样器／取色器」の揺れを ja でも素直に反映）。
 * - 商家／vendor は「ベンダー」とし、助数詞は「社」で統一（数える対象：Pantone 見本=件、毛布の色=色、ポイント=ポイント）。
 * - 授权标签「测试B」→「テストB」（zh の「测试B」に対応、タグ名の英字 B は保持）。
 * - ボタン・ツールチップの指示は簡潔な命令形／「クリックで…」形、説明・状態メッセージは「です・ます／ください」調で統一（基線 4-1）。
 * - 引用符は「」、括弧は全角（）を使用。
 * - 固有名詞・形式記号は原文のまま保持：Pantone / sRGB / OKLab / Top 3 / Δ / jpg / png / webp / gif / px / cm /
 *   LongWoo / PIXEL & FABRIC SAMPLER / Sign up。なお本ファイルのキーに sRGB / OKLab / cm / PIXEL & FABRIC SAMPLER は
 *   存在しないため出現しない（出現する箇所があれば保持する方針）。
 * - {token} はすべて原位置のまま保持（注入値の順序は各キー内で変更しない）。
 */
export const JA_SAMPLER: Record<string, string> = {
  // ===== ページレベル（sampler/page.tsx サーバー側）=====
  'sampler.page.title': '画像とファー生地サンプラー',
  'sampler.page.backHome': 'ホームへ戻る',
  'sampler.metaTitle': 'ファー生地カラー抽出 | LongWoo Studio',
  'sampler.metaDesc':
    '設定画をアップロードしてピクセルのカラー抽出を行い、Pantone 参考色とファー生地ライブラリに自動マッチングします。ファー生地の組み合わせをすばやくプレビューできます。',

  // ===== 上部ヒント / ツールバー =====
  'sampler.hint.clickGuide': 'クリックでポイント追加（≤{max}）· 長押しでルーペによる精密カラー抽出 · 選択済みポイントをクリックで削除',

  // ===== データベースボタン =====
  'sampler.db.button': 'データベース',
  'sampler.db.all': 'すべて',
  'sampler.db.custom': 'カスタム',
  'sampler.db.loadingSummary': 'データベースを読み込み中…',
  'sampler.db.summary': 'データベース · Pantone {pantone} 件 · 毛布シリーズ {vendor} 種（有効 {on} 種）：{detail}',
  'sampler.db.kindSummary': '{kind} {on}/{total} 有効',
  'sampler.db.summarySep': '、',
  'sampler.db.mobileTitle': 'データベースの絞り込み',
  'sampler.db.closePanel': 'データベースパネルを閉じる',

  // ===== Pantone ライブラリパネル =====
  'sampler.pantone.title': 'Pantone ライブラリ',
  'sampler.pantone.sub': '公式標準ライブラリ · {n} 件 · 常時含まれます',

  // ===== ファー生地ライブラリパネル =====
  'sampler.fabricLib.label': 'ファー生地ライブラリ',
  'sampler.fabricLib.kindPrefix': '種類 · {kind}',
  'sampler.fabricLib.vendorOffTitle': 'クリックでこのシリーズを有効化',
  'sampler.fabricLib.vendorOnTitle': 'クリックでこのシリーズを無効化',
  'sampler.fabricLib.colorCount': '{count} 色',
  'sampler.fabricLib.moreKinds': 'その他の種類（未対応）',
  'sampler.fabricLib.notImported': '未インポート',
  'sampler.fabricLib.panelNote': '無効にしたファー生地ベンダーはカラー抽出のマッチング結果に含まれません。ファー生地ライブラリは少なくとも 1 社を有効にしてください',

  // ===== アップロード / ドラッグ =====
  'sampler.upload.replace': '画像を差し替え',
  'sampler.upload.new': '画像をアップロード',
  'sampler.drop.title': '画像をここへドラッグするか、クリックして選択してください',
  'sampler.drop.sub': 'ローカルで処理されるため、サーバーへはアップロードされません · 対応形式：jpg / png / webp / gif',
  'sampler.img.sourceAlt': 'カラー抽出の元画像',

  // ===== ルーペ / ズーム / ステータスバー =====
  'sampler.loupe.release': '離すとカラー抽出',
  'sampler.loupe.press': '長押しでカラー抽出…',
  'sampler.statusBar.pressLocked': 'ピクセルをロックしました。ルーペを動かして位置を決め、離すとカラー抽出します',
  'sampler.statusBar.pressMove': '押したままルーペを移動します。長押しでロックしてから離すとカラー抽出…',
  'sampler.zoom.restore': 'クリックで 100% に戻す',
  'sampler.statusBar.pointsSelected': '選択済み {count} / {max} ポイント',
  'sampler.statusBar.waiting': '画像のアップロードを待っています',

  // ===== 右側のパラメータ領域 =====
  'sampler.params.title': 'Sampler · サンプリングパラメータ',
  'sampler.params.clear': 'クリア',
  'sampler.params.emptyNoImage': '画像をアップロードしてクリック/長押しでカラー抽出すると、ここにパラメータが表示されます',
  'sampler.params.emptyNoPoints': '上の画像をクリックまたは長押ししてカラー抽出してください（最大 {max} ポイント）',

  // ===== 色差の凡例 / 下部注記 =====
  'sampler.legend.direct': 'Δ≤0.030 そのまま使用',
  'sampler.legend.reference': '0.030<Δ≤0.090 参考として使用',
  'sampler.legend.none': 'Δ>0.090 参考価値なし',
  'sampler.disclaimer':
    'ファー生地の色値はベンダーのカラーカード（コミュニティ/サンプルデータであり、分光測色計による実測ではありません）に基づいています。Pantone は近似マッチのため、正式な納品前には公式カラーカードでご確認ください',

  // ===== ポイントカード（PointCard）=====
  'sampler.card.deleteAria': 'ポイント {n} を削除',
  'sampler.card.pantoneRef': 'Pantone 参考 ×{n}',
  'sampler.card.expand': '詳細パラメータ',
  'sampler.card.collapse': '詳細パラメータを閉じる',
  'sampler.card.fabricsTop': '参考ファー生地 Top 3',
  'sampler.card.fabricsLoading': 'ファー生地ライブラリを読み込み中…',

  // ===== ファー生地行 / ファー生地詳細 =====
  'sampler.fabricRow.collapseTitle': 'もう一度クリックすると詳細を閉じます：{name}（{vendor}）',
  'sampler.fabricRow.viewTitle': 'クリックでファー生地の詳細を表示します：{name}（{vendor}）',
  'sampler.detail.largeImgFailed': '画像の読み込みに失敗しました。拡大プレビューは表示できません',
  'sampler.detail.viewLarge': 'クリックで拡大プレビューを表示',
  'sampler.detail.colorFamily': 'カラー系統',
  'sampler.detail.furLength': '毛の長さ',
  'sampler.detail.kind': 'ファー生地の種類',
  'sampler.detail.pantone': 'Pantone',
  'sampler.detail.zoomAria': '{name}（{vendor}）の拡大プレビュー',
  'sampler.detail.closeZoom': '拡大プレビューを閉じる',
  'sampler.detail.overlayHint': 'オーバーレイをクリックして閉じる',

  // ===== showStatus の状態メッセージ =====
  'sampler.status.dbReady':
    'データベース準備完了：Pantone ライブラリ {pantone} 件 · ファー生地 {fabric} 色 / ベンダー {vendor} 社{dataNote} · 画像をアップロード後、クリック/長押しでカラー抽出してください',
  'sampler.status.liveData': '（実データ）',
  'sampler.status.sampleData': '（サンプルデータ）',
  'sampler.status.imageOnly': '対応しているのは画像ファイルのみです（jpg / png / webp / gif）',
  'sampler.status.imgLoaded':
    '読み込み完了：{w} × {h}px · スクロール/ピンチでズーム · クリック/長押しでカラー抽出（最大 {max} ポイント）',
  'sampler.status.pointDeleted': 'ポイント {id} を削除しました（{x}, {y}）',
  'sampler.status.maxPoints': '選択できるのは最大 {max} ポイントです。先に一部のポイントを削除してください',
  'sampler.status.pixelAlready': 'このピクセル（{x}, {y}）は選択済みです。別の場所を選択してください',
  'sampler.status.pointAdded': 'ポイント {id} を選択しました · ピクセル（{x}, {y}）· #{hex}',
  'sampler.status.pointRemoved': 'ポイント {id} を削除しました',
  'sampler.status.cleared': 'すべての選択ポイントをクリアしました',
  'sampler.status.keepOneVendor': 'ファー生地ライブラリは少なくとも 1 社のベンダーを有効にしてください。すべて無効にすることはできません',

  // ===== SamplerDock（右上の dock）=====
  'sampler.switchLangTip': '言語切替',
  'sampler.dock.exportAria': 'データをエクスポート',
  'sampler.dock.exportHead': 'データのエクスポート',
  'sampler.dock.close': '閉じる',
  'sampler.dock.pointCount': '{count} ポイント',
  'sampler.dock.checking': '権限を確認中…',
  'sampler.dock.guestTitle': 'カラー抽出データのエクスポートにはログインが必要です',
  'sampler.dock.guestDesc': 'ログイン後、管理者ロールと「テストB」のエクスポート権限タグを持つアカウントのみ、PC へのエクスポートができます',
  'sampler.dock.guestCta': 'ログインする',
  'sampler.dock.deniedTitle': 'エクスポート権限がありません',
  'sampler.dock.deniedDefault': 'このアカウントには「テストB」のエクスポート権限タグがありません。管理者に連絡して有効にしてもらってください',
  'sampler.dock.checkFailed': '権限の確認に失敗しました。しばらくしてから再試行してください',
  'sampler.dock.imgLabel': '画像 · ',
  'sampler.dock.dbLabel': 'データベース · ',
  'sampler.dock.unnamed': '無題',
  'sampler.dock.dims': '（{w} × {h} px）',
  'sampler.dock.dbInfo': 'Pantone {pantone} 件 · ファー生地 {fabric} 色 / ベンダー {vendor} 社',
  'sampler.dock.downloaded': 'ダウンロード済み',
  'sampler.dock.downloadJson': 'JSON をダウンロード',
  'sampler.dock.copied': 'コピー済み',
  'sampler.dock.copyText': 'テキストをコピー',
  'sampler.dock.emptyHint': 'まだカラー抽出されていません —— 画像をアップロードしてクリックでポイントを追加すれば、スキームをエクスポートできます',
  'sampler.dock.signUp': 'Sign up',
  'sampler.dock.signInSmall': 'ログイン / 新規登録',

  // ===== テキスト書き出し一覧（buildExportText）=====
  'sampler.export.title': 'LongWoo · ファー生地カラースキーム',
  'sampler.export.time': '生成日時：{time}',
  'sampler.export.source': '画像ソース：{name}（{w} × {h} px）',
  'sampler.export.db': 'データベース：Pantone {pantone} 件 · ファー生地 {fabric} 色 / ベンダー {vendor} 社 · 有効 {enabled} 社',
  'sampler.export.pantoneLabel': 'Pantone：',
  'sampler.export.fabricLabel': 'ファー生地参考：',
}
