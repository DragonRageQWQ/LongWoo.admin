/**
 * LW-I18N 取色器(/sampler) 한국어(ko) 사전
 * 출처: src/lib/i18n/zh-sampler.ts(103개 키, {token} 포함) 전량 번역.
 * 키·{token} 구성은 zh-sampler.ts와 완전 일치(1:1, 누락·추가 없음).
 * 어순·표현은 한국어 기준으로 재구성(참고: en-sampler.ts).
 *
 * ◆ 업계 용어(고정, i18n 품질 베이스라인): 퍼 원단(毛布) / 털 길이(毛长) /
 *   색상 추출(取色) / Pantone 참조 색상(潘通参考色) / 색차 Δ(色差 Δ) /
 *   상세 파라미터(详细参数) / 필터(筛选) / 데이터베이스(数据库) / 내보내기(导出).
 * ◆ 브랜드·영문·전문 용어는 원문 유지: LongWoo / Studio / Pantone / OKLab / sRGB /
 *   Top 3 / Δ / Sampler / Sign up / PIXEL & FABRIC SAMPLER, 확장자 jpg·png·webp·gif,
 *   단위 px·cm. 태그명 「测试B」는 인용부호와 함께 “Test B”로 표기.
 * ◆ 어조: 지시문·안내문은 공식 웹문어(합쇼체 ~합니다/~입니다), 요청은 '~해 주시기 바랍니다'로
 *   통일하고, 버튼·라벨은 명사형·명령형으로 처리(해요체 '~하세요/~주세요' 지양).
 * ◆ 문장부호(취사): 인용은 한국어 인용부호 “ ”, 괄호는 반각 (), 콜론은 반각 ': ',
 *   열거 구분은 중점 ' · '·쉼표(zh의 '；'는 자연스러운 ', '로 전환). 점(占位符)·숫자·단위는 원문 유지.
 * ◆ 수량사: 条/个 → 개, 家 → 곳(업체 수), 色 → 색, 点(포인트) → 개/포인트로 통일.
 */
export const KO_SAMPLER: Record<string, string> = {
  // ===== 페이지 레벨(sampler/page.tsx 서버) =====
  'sampler.page.title': '이미지 & 퍼 원단 색상 추출기',
  'sampler.page.backHome': '홈으로 돌아가기',
  'sampler.metaTitle': '퍼 원단 색상 추출기 | LongWoo Studio',
  'sampler.metaDesc':
    '설정 이미지를 업로드해 픽셀 색상을 추출하면, Pantone 참조 색상 및 퍼 원단 라이브러리와 자동으로 매칭하여 퍼 원단 코디 효과를 빠르게 미리 볼 수 있습니다.',

  // ===== 상단 힌트 / 툴바 =====
  'sampler.hint.clickGuide':
    '클릭으로 포인트 추가(최대 {max}개) · 길게 눌러 돋보기로 정밀하게 색상 추출 · 선택한 포인트를 클릭하면 삭제',

  // ===== 데이터베이스 버튼 =====
  'sampler.db.button': '데이터베이스',
  'sampler.db.all': '전체',
  'sampler.db.custom': '사용자 지정',
  'sampler.db.loadingSummary': '데이터베이스 불러오는 중…',
  'sampler.db.summary':
    '데이터베이스 · Pantone {pantone}개 · 원단 시리즈 {vendor}개(활성 {on}개): {detail}',
  'sampler.db.kindSummary': '{kind} {on}/{total}개 활성',
  'sampler.db.summarySep': ', ',
  'sampler.db.mobileTitle': '데이터베이스 필터',
  'sampler.db.closePanel': '데이터베이스 패널 닫기',

  // ===== Pantone 색상 라이브러리 패널 =====
  'sampler.pantone.title': 'Pantone 색상 라이브러리',
  'sampler.pantone.sub': '공식 표준 색상 라이브러리 · {n}개 · 항상 포함',

  // ===== 퍼 원단 라이브러리 패널 =====
  'sampler.fabricLib.label': '퍼 원단 라이브러리',
  'sampler.fabricLib.kindPrefix': '종류 · {kind}',
  'sampler.fabricLib.vendorOffTitle': '클릭하여 이 시리즈 활성화',
  'sampler.fabricLib.vendorOnTitle': '클릭하여 이 시리즈 비활성화',
  'sampler.fabricLib.colorCount': '{count}색',
  'sampler.fabricLib.moreKinds': '추가 종류(아직 활성화되지 않음)',
  'sampler.fabricLib.notImported': '가져오지 않음',
  'sampler.fabricLib.panelNote':
    '비활성화한 퍼 원단 업체는 색상 추출 매칭 결과에 나타나지 않습니다. 퍼 원단 라이브러리는 최소 한 곳 이상 활성화해 두시기 바랍니다.',

  // ===== 업로드 / 드래그 =====
  'sampler.upload.replace': '이미지 교체',
  'sampler.upload.new': '이미지 업로드',
  'sampler.drop.title': '이미지를 이곳으로 끌어다 놓거나, 클릭하여 선택해 주시기 바랍니다',
  'sampler.drop.sub': '로컬에서 처리되어 서버에 업로드되지 않습니다 · jpg / png / webp / gif 지원',
  'sampler.img.sourceAlt': '추출 원본 이미지',

  // ===== 돋보기 / 줌 / 상태바 =====
  'sampler.loupe.release': '손을 떼면 색상 추출',
  'sampler.loupe.press': '길게 눌러 색상 추출…',
  'sampler.statusBar.pressLocked':
    '픽셀이 잠겼습니다. 돋보기를 이동해 위치를 정한 뒤, 손을 떼면 색상이 추출됩니다',
  'sampler.statusBar.pressMove':
    '돋보기를 누른 채 이동해 주시기 바랍니다. 길게 누르면 픽셀이 잠기고, 손을 떼면 색상이 추출됩니다…',
  'sampler.zoom.restore': '클릭하여 100%로 되돌리기',
  'sampler.statusBar.pointsSelected': '{count} / {max}개 선택됨',
  'sampler.statusBar.waiting': '이미지 업로드를 기다리는 중',

  // ===== 오른쪽 파라미터 영역 =====
  'sampler.params.title': 'Sampler · 추출 파라미터',
  'sampler.params.clear': '지우기',
  'sampler.params.emptyNoImage':
    '이미지를 업로드한 뒤 클릭/길게 눌러 색상을 추출하면 이곳에 파라미터가 표시됩니다',
  'sampler.params.emptyNoPoints':
    '위쪽 이미지에서 클릭하거나 길게 눌러 색상을 추출해 주시기 바랍니다(최대 {max}개)',

  // ===== 색차 범례 / 하단 설명 =====
  'sampler.legend.direct': 'Δ≤0.030 바로 사용',
  'sampler.legend.reference': '0.030<Δ≤0.090 참고로 사용',
  'sampler.legend.none': 'Δ>0.090 참고 가치 없음',
  'sampler.disclaimer':
    '퍼 원단 색상 값은 업체 컬러 카드에서 가져온 것으로 커뮤니티/샘플 데이터이며 분광기 실측값이 아닙니다. Pantone은 근사 매칭이므로, 최종 납품 전에는 반드시 공식 컬러 카드를 기준으로 확인해 주시기 바랍니다.',

  // ===== 파라미터 카드(PointCard) =====
  'sampler.card.deleteAria': '선택 포인트 {n} 삭제',
  'sampler.card.pantoneRef': 'Pantone 참조 ×{n}',
  'sampler.card.expand': '상세 파라미터',
  'sampler.card.collapse': '상세 파라미터 접기',
  'sampler.card.fabricsTop': '참조 퍼 원단 Top 3',
  'sampler.card.fabricsLoading': '퍼 원단 라이브러리 불러오는 중…',

  // ===== 퍼 원단 행 / 퍼 원단 상세 =====
  'sampler.fabricRow.collapseTitle':
    '다시 클릭하면 상세 정보가 접힙니다: {name}({vendor})',
  'sampler.fabricRow.viewTitle': '클릭하여 퍼 원단 상세 정보 보기: {name}({vendor})',
  'sampler.detail.largeImgFailed': '이미지를 불러오지 못해 확대 이미지를 볼 수 없습니다',
  'sampler.detail.viewLarge': '클릭하여 확대 이미지 보기',
  'sampler.detail.colorFamily': '색상 계열',
  'sampler.detail.furLength': '털 길이',
  'sampler.detail.kind': '퍼 원단 종류',
  'sampler.detail.pantone': 'Pantone',
  'sampler.detail.zoomAria': '{name}({vendor}) 확대 이미지 미리보기',
  'sampler.detail.closeZoom': '확대 이미지 미리보기 닫기',
  'sampler.detail.overlayHint': '오버레이를 클릭하면 닫힙니다',

  // ===== showStatus 상태 메시지 =====
  'sampler.status.dbReady':
    '데이터베이스 준비 완료: Pantone 색상 라이브러리 {pantone}개 · 퍼 원단 {fabric}색 / 업체 {vendor}곳{dataNote} · 이미지 업로드 후 클릭/길게 눌러 색상을 추출해 주시기 바랍니다',
  'sampler.status.liveData': '(실제 데이터)',
  'sampler.status.sampleData': '(샘플 데이터)',
  'sampler.status.imageOnly': '이미지 파일만 지원합니다(jpg / png / webp / gif)',
  'sampler.status.imgLoaded':
    '{w} × {h}px 로드됨 · 휠/핀치로 확대·축소 · 클릭/길게 눌러 색상 추출(최대 {max}개)',
  'sampler.status.pointDeleted': '포인트 {id} 삭제됨({x}, {y})',
  'sampler.status.maxPoints':
    '포인트는 최대 {max}개까지 선택할 수 있습니다. 기존 선택 포인트 중 일부를 먼저 삭제해 주시기 바랍니다',
  'sampler.status.pixelAlready': '픽셀({x}, {y})은 이미 선택되었습니다. 다른 위치를 선택해 주시기 바랍니다',
  'sampler.status.pointAdded': '포인트 {id} 선택됨 · 픽셀({x}, {y}) · #{hex}',
  'sampler.status.pointRemoved': '포인트 {id} 삭제됨',
  'sampler.status.cleared': '선택한 모든 포인트가 삭제되었습니다',
  'sampler.status.keepOneVendor': '퍼 원단 업체는 최소 한 곳을 활성화해야 하므로 전부 끌 수 없습니다',

  // ===== SamplerDock(오른쪽 위 dock) =====
  'sampler.switchLangTip': '언어 전환',
  'sampler.dock.exportAria': '데이터 내보내기',
  'sampler.dock.exportHead': '데이터 내보내기',
  'sampler.dock.close': '닫기',
  'sampler.dock.pointCount': '{count}개',
  'sampler.dock.checking': '권한 확인 중…',
  'sampler.dock.guestTitle': '색상 추출 데이터를 내보내려면 로그인이 필요합니다',
  'sampler.dock.guestDesc':
    '로그인한 계정이 관리자이면서 “Test B” 권한 태그를 보유해야 컴퓨터로 내보낼 수 있습니다',
  'sampler.dock.guestCta': '로그인하러 가기',
  'sampler.dock.deniedTitle': '내보내기 권한이 없습니다',
  'sampler.dock.deniedDefault':
    '이 계정에는 “Test B” 내보내기 권한 태그가 없습니다. 최고 관리자에게 문의해 권한을 부여받은 뒤 사용해 주시기 바랍니다',
  'sampler.dock.checkFailed': '권한 확인에 실패했습니다. 잠시 후 다시 시도해 주시기 바랍니다',
  'sampler.dock.imgLabel': '이미지 · ',
  'sampler.dock.dbLabel': '데이터베이스 · ',
  'sampler.dock.unnamed': '제목 없음',
  'sampler.dock.dims': '({w} × {h} px)',
  'sampler.dock.dbInfo': 'Pantone {pantone}개 · 퍼 원단 {fabric}색 / 업체 {vendor}곳',
  'sampler.dock.downloaded': '다운로드 완료',
  'sampler.dock.downloadJson': 'JSON 다운로드',
  'sampler.dock.copied': '복사 완료',
  'sampler.dock.copyText': '텍스트 복사',
  'sampler.dock.emptyHint':
    '아직 색상을 추출하지 않았습니다. 이미지를 업로드하고 클릭해 포인트를 추가하면 구성안을 내보낼 수 있습니다',
  'sampler.dock.signUp': 'Sign up',
  'sampler.dock.signInSmall': '로그인/회원가입',

  // ===== 데이터 내보내기 순수 텍스트 목록(buildExportText) =====
  'sampler.export.title': 'LongWoo · 퍼 원단 색상 구성안',
  'sampler.export.time': '생성 시간: {time}',
  'sampler.export.source': '이미지 출처: {name}({w} × {h} px)',
  'sampler.export.db':
    '데이터베이스: Pantone {pantone}개 · 퍼 원단 {fabric}색 / 업체 {vendor}곳 · 활성화 {enabled}곳',
  'sampler.export.pantoneLabel': 'Pantone: ',
  'sampler.export.fabricLabel': '퍼 원단 참조: ',
}
