/**
 * Русский (ru): словарь сэмплера (/sampler) — RU_SAMPLER
 * Ключи и плейсхолдеры {token} повторяют ZH_SAMPLER один к одному (103 ключа).
 * Шаблонные строки заполняются функцией fill() — динамические значения встав-
 * ляются на русские позиции, порядок свободный.
 *
 * Терминология — по стандарту качества (i18n-quality-baseline.md):
 * меховая ткань (毛布) / длина ворса (毛长) / извлечение цвета (取色) /
 * эталонный цвет Pantone (潘通参考色) / дельта Δ (色差). Бренды, сокращения и
 * технические токены сохранены без изменений: LongWoo, Studio, Pantone, sRGB,
 * OKLab, Top 3, Δ, jpg / png / webp / gif, cm, px, «Sign up» (как в исходнике).
 *
 * Лексические и стилевые решения:
 * 1. Обращение к пользователю — формальное «Вы»: глаголы во 2 л. мн. ч.
 *    повелительного наклонения (Нажмите / Перетащите / Загрузите / Оставьте…).
 * 2. Русские кавычки «ёлочки» для выделяемых фраз; «Тест B» передано как в
 *    ru-admin («Тест A, VIP») — «авторизационный тег «Тест B»».
 * 3. Согласование числительных: при динамических счётчиках невозможно стати-
 *    чески подобрать форму существительного (1 точка / 2 точки / 5 точек),
 *    поэтому использованы грамматически нейтральные обороты:
 *      — «родительный падеж — число»: «эталонов Pantone — {pantone}»,
 *        «поставщиков — {vendor}», «точек — {count}»;
 *      — «включено {on} из {total}», «не более {max} точек», «Выбрано {count}
 *        из {max}» — без имени существительного после числа.
 * 4. Числа, единицы (px, cm), десятичные дроби (0.030 / 0.090) и математи-
 *    ческие знаки (≤, >, Δ, ×) не изменяются. В тексте русского словаря
 *    не осталось ни одного иероглифа; разделители в заголовках — « · ».
 *
 * Ключи не должны быть пустыми и не должны совпадать с именем ключа — это
 * проверяется тестом покрытия i18n (i18n-coverage.test.ts).
 */
export const RU_SAMPLER: Record<string, string> = {
  // ===== Уровень страницы (server, sampler/page.tsx) =====
  'sampler.page.title': 'Извлечение цвета из изображений и меховых тканей',
  'sampler.page.backHome': 'На главную',
  'sampler.metaTitle': 'Извлечение цвета меховой ткани | LongWoo Studio',
  'sampler.metaDesc':
    'Загрузите референс-арт для извлечения цвета по пикселям: цвета автоматически сопоставляются с эталонными цветами Pantone и библиотекой меховых тканей, чтобы вы могли быстро оценить варианты сочетаний.',

  // ===== Подсказка сверху / панель инструментов =====
  'sampler.hint.clickGuide':
    'Нажмите на изображение, чтобы добавить точку (не более {max}) · долгое нажатие — лупа для точного выбора цвета · нажмите на уже выбранную точку, чтобы удалить её',

  // ===== Кнопка базы данных =====
  'sampler.db.button': 'База данных',
  'sampler.db.all': 'Все',
  'sampler.db.custom': 'Пользовательские',
  'sampler.db.loadingSummary': 'Загрузка базы данных…',
  'sampler.db.summary':
    'База данных · эталонов Pantone — {pantone} · поставщиков — {vendor} (включено — {on}): {detail}',
  'sampler.db.kindSummary': '{kind}: включено {on} из {total}',
  'sampler.db.summarySep': '; ',
  'sampler.db.mobileTitle': 'Фильтр базы данных',
  'sampler.db.closePanel': 'Закрыть панель базы данных',

  // ===== Библиотека Pantone =====
  'sampler.pantone.title': 'Библиотека Pantone',
  'sampler.pantone.sub': 'Официальная стандартная библиотека · эталонов — {n} · всегда включена',

  // ===== Библиотека меховых тканей =====
  'sampler.fabricLib.label': 'Библиотека меховых тканей',
  'sampler.fabricLib.kindPrefix': 'Вид · {kind}',
  'sampler.fabricLib.vendorOffTitle': 'Нажмите, чтобы включить этого поставщика',
  'sampler.fabricLib.vendorOnTitle': 'Нажмите, чтобы отключить этого поставщика',
  'sampler.fabricLib.colorCount': 'цветов — {count}',
  'sampler.fabricLib.moreKinds': 'Другие виды (пока не включены)',
  'sampler.fabricLib.notImported': 'Не импортировано',
  'sampler.fabricLib.panelNote':
    'Отключённые поставщики не участвуют в результатах извлечения цвета — оставьте включённым хотя бы одного поставщика из библиотеки меховых тканей.',

  // ===== Загрузка / перетаскивание =====
  'sampler.upload.replace': 'Заменить изображение',
  'sampler.upload.new': 'Загрузить изображение',
  'sampler.drop.title': 'Перетащите изображение сюда или нажмите, чтобы выбрать',
  'sampler.drop.sub': 'Всё обрабатывается локально, ничего не загружается · поддерживаются jpg / png / webp / gif',
  'sampler.img.sourceAlt': 'Исходное изображение для извлечения цвета',

  // ===== Лупа / масштаб / строка состояния =====
  'sampler.loupe.release': 'Отпустите, чтобы выбрать цвет',
  'sampler.loupe.press': 'Удерживайте, чтобы извлечь цвет…',
  'sampler.statusBar.pressLocked':
    'Пиксель зафиксирован — переместите лупу в нужное место и отпустите, чтобы выбрать цвет',
  'sampler.statusBar.pressMove':
    'Удерживайте и ведите лупу; продолжайте удерживать, чтобы зафиксировать пиксель, затем отпустите для выбора цвета…',
  'sampler.zoom.restore': 'Нажмите, чтобы вернуть масштаб 100%',
  'sampler.statusBar.pointsSelected': 'Выбрано {count} из {max}',
  'sampler.statusBar.waiting': 'Ожидание загрузки изображения',

  // ===== Параметры справа =====
  'sampler.params.title': 'Sampler · Параметры извлечения цвета',
  'sampler.params.clear': 'Очистить',
  'sampler.params.emptyNoImage':
    'Параметры появятся здесь после загрузки изображения и выбора цвета нажатием или долгим нажатием',
  'sampler.params.emptyNoPoints':
    'Нажмите или зажмите изображение выше, чтобы выбрать цвет (не более {max} точек)',

  // ===== Легенда дельты / примечание =====
  'sampler.legend.direct': 'Δ≤0.030 — можно использовать напрямую',
  'sampler.legend.reference': '0.030<Δ≤0.090 — можно использовать как ориентир',
  'sampler.legend.none': 'Δ>0.090 — справочной ценности нет',
  'sampler.disclaimer':
    'Цвета меховых тканей взяты из фирменных карт цветов поставщиков (данные сообщества и примеры, а не измерения спектрофотометром); подбор Pantone приблизителен — при окончательной сдаче заказа сверяйтесь с официальной картой цветов.',

  // ===== Карточка точки =====
  'sampler.card.deleteAria': 'Удалить точку {n}',
  'sampler.card.pantoneRef': 'Совпадения Pantone ×{n}',
  'sampler.card.expand': 'Подробные параметры',
  'sampler.card.collapse': 'Скрыть подробные параметры',
  'sampler.card.fabricsTop': 'Top 3 подходящих меховых тканей',
  'sampler.card.fabricsLoading': 'Загрузка библиотеки меховых тканей…',

  // ===== Строка ткани / сведения о ткани =====
  'sampler.fabricRow.collapseTitle': 'Нажмите ещё раз, чтобы свернуть сведения: {name} ({vendor})',
  'sampler.fabricRow.viewTitle': 'Нажмите, чтобы открыть сведения о ткани: {name} ({vendor})',
  'sampler.detail.largeImgFailed': 'Не удалось загрузить изображение — просмотр в большом размере недоступен',
  'sampler.detail.viewLarge': 'Нажмите, чтобы открыть изображение в большом размере',
  'sampler.detail.colorFamily': 'Цветовая гамма',
  'sampler.detail.furLength': 'Длина ворса',
  'sampler.detail.kind': 'Вид меховой ткани',
  'sampler.detail.pantone': 'Pantone',
  'sampler.detail.zoomAria': 'Предпросмотр в большом размере: {name} ({vendor})',
  'sampler.detail.closeZoom': 'Закрыть большой предпросмотр',
  'sampler.detail.overlayHint': 'Нажмите на фон, чтобы закрыть',

  // ===== Сообщения showStatus =====
  'sampler.status.dbReady':
    'База данных готова: эталонов Pantone — {pantone} · цветов меховых тканей — {fabric} · поставщиков — {vendor}{dataNote}. Загрузите изображение и выбирайте цвет нажатием или долгим нажатием',
  'sampler.status.liveData': ' (реальные данные)',
  'sampler.status.sampleData': ' (демонстрационные данные)',
  'sampler.status.imageOnly': 'Поддерживаются только изображения (jpg / png / webp / gif)',
  'sampler.status.imgLoaded':
    'Загружено {w} × {h}px · масштабирование колесом мыши / жестом · выбор цвета нажатием или долгим нажатием (не более {max} точек)',
  'sampler.status.pointDeleted': 'Точка {id} удалена ({x}, {y})',
  'sampler.status.maxPoints': 'Можно выбрать не более {max} точек — сначала удалите часть точек',
  'sampler.status.pixelAlready': 'Пиксель ({x}, {y}) уже выбран — выберите другое место',
  'sampler.status.pointAdded': 'Выбрана точка {id} · пиксель ({x}, {y}) · #{hex}',
  'sampler.status.pointRemoved': 'Точка {id} удалена',
  'sampler.status.cleared': 'Все выбранные точки удалены',
  'sampler.status.keepOneVendor':
    'Оставьте включённым хотя бы одного поставщика меховых тканей — отключать всех нельзя',

  // ===== SamplerDock (dock в правом верхнем углу) =====
  'sampler.switchLangTip': 'Сменить язык',
  'sampler.dock.exportAria': 'Экспорт данных',
  'sampler.dock.exportHead': 'Экспорт данных',
  'sampler.dock.close': 'Закрыть',
  'sampler.dock.pointCount': 'точек — {count}',
  'sampler.dock.checking': 'Проверка авторизации…',
  'sampler.dock.guestTitle': 'Для экспорта данных нужно войти в аккаунт',
  'sampler.dock.guestDesc':
    'После входа понадобится роль администратора с авторизационным тегом «Тест B» — только тогда данные можно будет экспортировать на компьютер',
  'sampler.dock.guestCta': 'Войти',
  'sampler.dock.deniedTitle': 'Нет прав на экспорт',
  'sampler.dock.deniedDefault':
    'Этому аккаунту не выдан авторизационный тег «Тест B» для экспорта — обратитесь к администратору, чтобы его включили',
  'sampler.dock.checkFailed': 'Не удалось проверить авторизацию. Повторите попытку позже.',
  'sampler.dock.imgLabel': 'Изображение · ',
  'sampler.dock.dbLabel': 'База данных · ',
  'sampler.dock.unnamed': 'Без названия',
  'sampler.dock.dims': ' ({w} × {h} px)',
  'sampler.dock.dbInfo': 'эталонов Pantone — {pantone} · цветов меховых тканей — {fabric} / поставщиков — {vendor}',
  'sampler.dock.downloaded': 'Скачано',
  'sampler.dock.downloadJson': 'Скачать JSON',
  'sampler.dock.copied': 'Скопировано',
  'sampler.dock.copyText': 'Скопировать текст',
  'sampler.dock.emptyHint':
    'Данных ещё нет — загрузите изображение и добавьте точки нажатием, чтобы затем экспортировать свою схему',
  'sampler.dock.signUp': 'Sign up',
  'sampler.dock.signInSmall': 'Вход / Регистрация',

  // ===== Простой текстовый экспорт (buildExportText) =====
  'sampler.export.title': 'LongWoo · Палитра меховых тканей',
  'sampler.export.time': 'Сформировано: {time}',
  'sampler.export.source': 'Источник изображения: {name} ({w} × {h} px)',
  'sampler.export.db':
    'База данных: эталонов Pantone — {pantone} · цветов меховых тканей — {fabric} / поставщиков — {vendor} · включено — {enabled}',
  'sampler.export.pantoneLabel': 'Pantone: ',
  'sampler.export.fabricLabel': 'Меховые ткани: ',
}
