import type { Lang } from "@/lib/i18n/dict";
import { JA_COPY } from "./copy-ja";
import { KO_COPY } from "./copy-ko";
import { RU_COPY } from "./copy-ru";
import { FR_COPY } from "./copy-fr";
import { ZH_HANT_COPY } from "./copy-zhhant";

/** 首页语言与全站 Lang 对齐（zh / en / zh-Hant / ja / ko / ru / fr） */
export type Gt2Lang = Lang;
export type Gt2TabId = "agent" | "fursuit" | "shop" | "check" | "about";

export const GT2_TABS: { id: Gt2TabId; en: string; zh: string }[] = [
  { id: "agent", en: "Agent", zh: "智能体" },
  { id: "fursuit", en: "Fursuit", zh: "委托兽装" },
  { id: "shop", en: "Web Shop", zh: "在线商店" },
  { id: "check", en: "Check", zh: "查询" },
  { id: "about", en: "About", zh: "关于" },
];

export const GT2_TAB_STORAGE_KEY = "lw_gt2_tab";
export const GT2_REMARK_KEY = "longwoo_gt2_remark";

export interface Gt2EntryCopy {
  kicker: string;
  title: string;
  titleEn: string;
  desc: string;
  features: string[];
  cta: string;
  href: string;
  /** 可选次要 CTA（与主 CTA 按钮并排展示） */
  secondaryCta?: string;
  secondaryHref?: string;
  /** 标题右侧可选动作按钮（打开「加入我们」渠道浮层） */
  headAction?: { label: string; href: string };
  /** @deprecated 旧版弹框描述文案，浮层已改为纯渠道图标 + 二维码视图，不再展示 */
  joinDesc?: string;
  /** @deprecated 旧版弹框关闭按钮文案，浮层已移除右上角关闭叉 */
  joinClose?: string;
}

export interface Gt2Copy {
  /** 导航/抽屉当前语言主词（随 lang 变化；en 语言时页面仍展示 GT2_TABS.zh 作副标签） */
  tabs: Record<Gt2TabId, string>;
  agent: {
    kicker: string;
    heroTitle: string;
    heroTitleEn: string;
    heroLines: string[];
    uploadBtn: string;
    /** 聊天页「新建角色」胶囊按钮的无障碍名称 */
    newRole: string;
    /** 聊天输入栏「发送」按钮的无障碍名称 */
    send: string;
    formTitle: string;
    formTitleEn: string;
    avatarHint: string;
    avatarFallback: string;
    changeAvatar: string;
    nameLabel: string;
    namePh: string;
    nicknameLabel: string;
    nicknamePh: string;
    personaLabel: string;
    personaPh: string;
    toneLabel: string;
    tonePh: string;
    greetingLabel: string;
    greetingPh: string;
    createBtn: string;
    creating: string;
    backBtn: string;
    errName: string;
    errAvatarLarge: string;
    errAvatarFormat: string;
    errCreate: string;
    errNetwork: string;
    loginHint: string;
    loginPromptText: string;
    goLogin: string;
    keepEdit: string;
    tonePresets: string[];
    chatMy: string;
    chatEmpty: string;
    chatCreateFirst: string;
    chatHello: string;
    /** 带昵称插值的问候头（{name} 为角色对你的称呼） */
    chatHelloWithName: string;
    chatInputPh: string;
    chatClearTitle: string;
    chatClearConfirm: string;
    errChatLoad: string;
    errChatSend: string;
    errChatClear: string;
    editBtn: string;
    editTitle: string;
    editTitleEn: string;
    editSubtitle: string;
    editDelete: string;
    editDeleting: string;
    editSave: string;
    editSaving: string;
    editDeleteConfirm: string;
    errEditSave: string;
    errEditDelete: string;
    errAvatarUpload: string;
  };
  fursuit: {
    kicker: string;
    title: string;
    titleEn: string;
    steps: string[];
    deliveryHint: string;
    priceRangeHint: string;
    uploadTitle: string;
    uploadHint: string;
    reupload: string;
    remove: string;
    addonMicro: string;
    addonHint: string;
    addonNone: string;
    addons: { name: string; nameEn: string; price: string; value: number; disabled?: boolean; tag?: string }[];
    benefitTitle: string;
    benefits: { label: string; labelEn: string; price: string; value: number }[];
    benefitNote: string;
    priceBase: string;
    priceAddon: string;
    priceDiscount: string;
    priceTotal: string;
    contactTitle: string;
    bodyTitle: string;
    bodyHint: string;
    socialLabel: string;
    socialPh: string;
    nameLabel: string;
    namePh: string;
    emailLabel: string;
    emailPh: string;
    dims: { key: "height" | "weight" | "chest" | "waist" | "hip" | "shoe"; label: string; unit: string }[];
    btnPrev: string;
    btnNext: string;
    submitBtn: string;
    submitting: string;
    submitHint: string;
    doneTitle: string;
    doneText: string;
    orderCodePrefix: string;
    copyBtn: string;
    copied: string;
    queryLink: string;
    saveTip: string;
    errImgRequired: string;
    errImgType: string;
    errImgLarge: string;
    errName: string;
    errEmail: string;
    errDimRequired: string;
    errSubmit: string;
    errNetwork: string;
    errUploadAlert: string;
  };
  checkPanel: {
    orderNoLabel: string;
    orderNoPh: string;
    emailLabel: string;
    emailPh: string;
    btn: string;
    loading: string;
    errOrderNoRequired: string;
    errEmailRequired: string;
    errEmailInvalid: string;
    errQueryFailed: string;
    errQueryUnknown: string;
    customerName: string;
    phone: string;
    email: string;
    serviceType: string;
    notSpecified: string;
    desc: string;
    designImage: string;
    designImageMissing: string;
    estimateAmount: string;
    note: string;
    deliveryLink: string;
    replies: string;
    createdAt: string;
    /** 同意估价（客户确认估价后进入等待工作室接单） */
    agreeEstimate: string;
    agreeEstimateDesc: string;
    agreeEstimateConfirm: string;
    agreeSuccess: string;
    agreeFailed: string;
    agreeWaiting: string;
    status: Record<string, string>;
  };
  shopPanel: {
    dropsEntryKicker: string;
    dropsEntryTitle: string;
    dropsEntryTitleEn: string;
    dropsEntryDesc: string;
    dropsEntryCta: string;
    peripheryEntryKicker: string;
    peripheryEntryTitle: string;
    peripheryEntryTitleEn: string;
    peripheryEntryDesc: string;
    peripheryEntryCta: string;
    backEntries: string;
    dropsKicker: string;
    dropsHeading: string;
    dropsSub: string;
    loading: string;
    empty: string;
    statusOnSale: string;
    statusPreparing: string;
    statusAdopted: string;
    statusOptionOnSale: string;
    statusOptionPreparing: string;
    statusOptionAdopted: string;
    btnSelect: string;
    btnAdopted: string;
    btnPreparing: string;
    viewImage: string;
    checkoutKicker: string;
    checkoutTitle: string;
    productLabel: string;
    nameLabel: string;
    namePh: string;
    emailLabel: string;
    emailPh: string;
    bodyTitle: string;
    bodyHint: string;
    heightLabel: string;
    weightLabel: string;
    chestLabel: string;
    waistLabel: string;
    hipLabel: string;
    shoeLabel: string;
    socialLabel: string;
    socialPh: string;
    agreeText: string;
    btnSubmit: string;
    submitting: string;
    errName: string;
    errEmail: string;
    errAgree: string;
    doneTitle: string;
    doneText: string;
    orderCodePrefix: string;
    queryLink: string;
    editBanner: string;
    editAdd: string;
    editExit: string;
    editTitle: string;
    editPrice: string;
    editStatus: string;
    editIncludes: string;
    editCopyright: string;
    editDelivery: string;
    editDescription: string;
    editUpload: string;
    editUploading: string;
    editUploadHint: string;
    editSave: string;
    editDelete: string;
    editCancel: string;
    editLabel: string;
    copyBtn: string;
    copied: string;
    editConfirmDelete: string;
    editSaveSuccess: string;
    editDeleteSuccess: string;
    editImageRequired: string;
    editTitleRequired: string;
    editPriceInvalid: string;
    focusTip: string;
    noPermission: string;
  };
  entries: Record<"shop" | "check" | "about", Gt2EntryCopy>;
  bubble: {
    signupEn: string;
    signupZh: string;
    langLabel: string;
    langTip: string;
    notifLabel: string;
    notifEmpty: string;
    notifLoginHint: string;
    readAll: string;
    viewOrder: string;
    markReadFail: string;
    loadFail: string;
    retry: string;
    close: string;
    logout: string;
    loggingOut: string;
    adminPanel: string;
    profileBtn: string;
  };
}

export const COPY: Record<Gt2Lang, Gt2Copy> = {
  zh: {
    tabs: { agent: "智能体", fursuit: "委托兽装", shop: "在线商店", check: "查询", about: "关于" },
    agent: {
      kicker: "LONGWOO · CHARACTER LAB",
      heroTitle: "创建你的角色",
      heroTitleEn: "Create Your Character",
      heroLines: [
        "上传设定图，描述角色的个性，免费生成你的专属角色 AI。",
        "长期的学习与陪伴，可以让 AI 心智无限逼近于真实状态。",
        "已被充分训练的 AI 角色，未来可以被载入实体兽装。",
      ],
      uploadBtn: "开始创建",
      newRole: "新建角色",
      send: "发送",
      formTitle: "角色设定",
      formTitleEn: "Character Profile",
      avatarHint: "点击上传头像 · JPEG / PNG / GIF / WebP · ≤ 2MB",
      avatarFallback: "头像",
      changeAvatar: "更换头像",
      nameLabel: "名字",
      namePh: "给 TA 取一个名字",
      nicknameLabel: "你的称呼",
      nicknamePh: "AI 会这样称呼你",
      personaLabel: "人设",
      personaPh: "描述 TA 的性格、经历与说话方式……",
      toneLabel: "语气风格",
      tonePh: "自定义，或点选预设",
      greetingLabel: "开场白",
      greetingPh: "TA 见到你的第一句话",
      createBtn: "创建角色",
      creating: "创建中…",
      backBtn: "返回",
      errName: "请先给角色取一个名字",
      errAvatarLarge: "头像图片不能超过 2MB",
      errAvatarFormat: "仅支持 JPEG / PNG / GIF / WebP 格式",
      errCreate: "创建失败，请稍后重试",
      errNetwork: "网络异常，请稍后重试",
      loginHint: "创建角色需要先登录",
      loginPromptText: "创建角色需要先登录，你的设定草稿已保存，登录后会自动恢复",
      goLogin: "去登录",
      keepEdit: "继续编辑",
      tonePresets: ["温柔", "活泼", "傲娇", "高冷", "幽默", "可爱", "沉稳", "热情", "毒舌", "元气", "慵懒", "神秘"],
      chatMy: "我的角色",
      chatEmpty: "还没有角色，创建你的第一个角色吧",
      chatCreateFirst: "去创建",
      chatHello: "和 TA 打个招呼吧",
      chatHelloWithName: "和 TA 打个招呼吧 · 叫你「{name}」",
      chatInputPh: "对 TA 说点什么…",
      chatClearTitle: "清空对话",
      chatClearConfirm: "确定要清空与这个角色的全部对话记录吗？",
      errChatLoad: "角色加载失败，请稍后重试",
      errChatSend: "发送失败，请稍后重试",
      errChatClear: "清空失败，请重试",
      editBtn: "调整设定",
      editTitle: "编辑角色",
      editTitleEn: "Edit Character",
      editSubtitle: "调整 TA 的设定，随时焕然一新",
      editDelete: "删除角色",
      editDeleting: "删除中…",
      editSave: "保存",
      editSaving: "保存中…",
      editDeleteConfirm: "确定要删除角色「{name}」吗？TA 的全部对话记录也会被删除，此操作不可恢复。",
      errEditSave: "保存失败，请稍后重试",
      errEditDelete: "删除失败，请稍后重试",
      errAvatarUpload: "头像上传失败，请重试",
    },
    fursuit: {
      kicker: "COMMISSION · FULL CUSTOM",
      title: "委托你的兽装",
      titleEn: "Commission Your Fursuit",
      steps: ["上传设定图", "选配内容", "折抵权益", "联系方式", "等待估价"],
      deliveryHint: "预计 4-6 周后交付*",
      priceRangeHint: "首次购置价格依照15000RMB-25000RMB区间计算",
      uploadTitle: "上传设定图",
      uploadHint: "图片不大于 20MB",
      reupload: "重新上传",
      remove: "移除",
      addonMicro: "选配 · ADD-ON",
      addonHint: "可多选 · 选中的内容将计入估价",
      addonNone: "无",
      addons: [
        { name: "便携式头包", nameEn: "Head Bag", price: "RMB 300", value: 300 },
        { name: "室内脚", nameEn: "Indoor Feet", price: "RMB 750", value: 750 },
        { name: "Longwoo Vision 视觉增强套件", nameEn: "Vision Kit", price: "RMB 8,888", value: 8888, disabled: true, tag: "暂未上线" },
      ],
      benefitTitle: "第三步：是否行使折抵权益与复购权益",
      benefits: [
        { label: "不使用", labelEn: "None", price: "RMB 0", value: 0 },
        { label: "4年期换购权益", labelEn: "4-Year Trade-in", price: "-RMB 3,000", value: 3000 },
        { label: "复购权益*", labelEn: "Repurchase*", price: "-RMB 2,000", value: 2000 },
      ],
      benefitNote: "*原 象山工作室 的首任单主同享复购权益",
      priceBase: "基础价格",
      priceAddon: "附加选项",
      priceDiscount: "折抵",
      priceTotal: "合计",
      contactTitle: "第四步：请填写您的数据与联系方式",
      bodyTitle: "身体数据",
      bodyHint: "身高 / 体重为必填 · 其余选填 · 便于预估尺寸",
      socialLabel: "任意平台可以联系到您的账号（如：Bilibili QQ X...）",
      socialPh: "请输入您的社交平台账号",
      nameLabel: "姓名",
      namePh: "请输入您的姓名",
      emailLabel: "Email",
      emailPh: "your@email.com",
      dims: [
        { key: "height", label: "身高", unit: "cm" },
        { key: "weight", label: "体重", unit: "kg" },
        { key: "chest", label: "胸围", unit: "cm" },
        { key: "waist", label: "腰围", unit: "cm" },
        { key: "hip", label: "臀围", unit: "cm" },
        { key: "shoe", label: "鞋码", unit: "" },
      ],
      btnPrev: "上一步",
      btnNext: "下一步",
      submitBtn: "提 交",
      submitting: "提交中…",
      submitHint: "提交后我们将人工估价，并尽快与您联系",
      doneTitle: "第五步：请等待我们的人工估价回复",
      doneText: "我们将在工作日9:00-17:00回复报价并与您进行接下来的沟通",
      orderCodePrefix: "您的订单代码：",
      copyBtn: "复制订单代码",
      copied: "已复制 ✓",
      queryLink: "去查询进度",
      saveTip: "请妥善保存订单代码，用于后续查询估价与进度",
      errImgRequired: "请先上传设定图",
      errImgType: "仅支持图片文件",
      errImgLarge: "图片不能超过 20MB",
      errName: "请输入姓名",
      errEmail: "请输入有效的邮箱地址",
      errDimRequired: "此项未填写",
      errSubmit: "提交失败，请稍后重试",
      errNetwork: "网络错误，请稍后重试",
      errUploadAlert: "设定图上传失败：{msg}。文件名已随订单保存，您可稍后登录个人中心补充设定图，或联系客服协助上传。",
    },
    checkPanel: {
      orderNoLabel: "委托单号",
      orderNoPh: "如 LW20250101001",
      emailLabel: "邮箱",
      emailPh: "请输入提交委托时填写的邮箱",
      btn: "查询委托",
      loading: "查询中…",
      errOrderNoRequired: "请输入委托单号",
      errEmailRequired: "请输入邮箱",
      errEmailInvalid: "请输入有效的邮箱地址",
      errQueryFailed: "查询失败，请检查单号与邮箱是否正确",
      errQueryUnknown: "查询时发生未知错误，请稍后重试",
      customerName: "客户姓名",
      phone: "联系电话",
      email: "邮箱",
      serviceType: "服务类型",
      notSpecified: "未指定",
      desc: "需求描述",
      designImage: "设定图",
      designImageMissing: "设定图上传未成功，如有疑问请联系客服",
      estimateAmount: "估价金额",
      note: "备注：",
      deliveryLink: "交付链接",
      replies: "回复记录",
      createdAt: "创建时间",
      agreeEstimate: "同意估价",
      agreeEstimateDesc: "请确认估价金额，同意后工作室将开始处理您的委托。",
      agreeEstimateConfirm: "确认同意该估价？同意后工作室将尽快接单开始制作。",
      agreeSuccess: "已确认估价，工作室将尽快接单开始制作",
      agreeFailed: "确认失败，请稍后重试",
      agreeWaiting: "您已确认估价，工作室接单后将开始制作，请留意进度更新。",
      status: {
        pending: "待估价",
        estimated: "已估价",
        agreed: "已同意估价",
        accepted: "已接单",
        rejected: "已拒单",
        processing: "处理中",
        delivered: "已交付",
        completed: "已完成",
      },
    },
    shopPanel: {
      dropsEntryKicker: "01",
      dropsEntryTitle: "现货掉落",
      dropsEntryTitleEn: "DROP FURSUITS",
      dropsEntryDesc: "预设兽装定期掉落，现货与预售同步开放。无需漫长等待，遇见即是缘分。",
      dropsEntryCta: "进入掉落",
      peripheryEntryKicker: "02",
      peripheryEntryTitle: "龙坞周边",
      peripheryEntryTitleEn: "LONGWOO MERCH",
      peripheryEntryDesc: "周边商品筹备中，敬请期待。",
      peripheryEntryCta: "未开放",
      backEntries: "返回商店",
      dropsKicker: "01 / DROP ITEMS",
      dropsHeading: "现货掉落",
      dropsSub: "成品部分立即交付 剩余部分预计 4-6 周后交付*",
      loading: "正在加载掉落信息…",
      empty: "暂无掉落信息，敬请期待",
      statusOnSale: "发售",
      statusPreparing: "准备",
      statusAdopted: "领养",
      statusOptionOnSale: "发售（可购买）",
      statusOptionPreparing: "准备（仅查看）",
      statusOptionAdopted: "领养（交付中）",
      btnSelect: "选择",
      btnAdopted: "已被领养",
      btnPreparing: "准备中 · 敬请期待",
      viewImage: "查看完整大图",
      checkoutKicker: "02 / CHECKOUT",
      checkoutTitle: "确认购买",
      productLabel: "已选掉落",
      nameLabel: "姓名",
      namePh: "请输入您的姓名",
      emailLabel: "Email",
      emailPh: "your@email.com",
      bodyTitle: "身体数据",
      bodyHint: "选填 · 便于预估尺寸",
      heightLabel: "身高",
      weightLabel: "体重",
      chestLabel: "胸围",
      waistLabel: "腰围",
      hipLabel: "臀围",
      shoeLabel: "鞋码",
      socialLabel: "任意平台可以联系到您的账号（如：Bilibili QQ X...）",
      socialPh: "请输入您的社交平台账号",
      agreeText: "我已阅读并同意购买协议",
      btnSubmit: "提 交",
      submitting: "提交中…",
      errName: "请输入姓名",
      errEmail: "请输入有效的邮箱地址",
      errAgree: "请先阅读并同意购买协议",
      doneTitle: "购买成功",
      doneText: "我们将在工作日9:00-17:00回复报价并与您进行接下来的沟通",
      orderCodePrefix: "您的订单代码：",
      queryLink: "去查询进度",
      editBanner: "编辑模式：修改后保存将同步到用户可见的掉落界面",
      editAdd: "+ 新增掉落",
      editExit: "退出编辑",
      editTitle: "掉落标题",
      editPrice: "价格（RMB）",
      editStatus: "掉落状态",
      editIncludes: "包含内容",
      editCopyright: "版权说明",
      editDelivery: "交付说明",
      editDescription: "介绍信息",
      editUpload: "上传图片",
      editUploading: "上传中…",
      editUploadHint: "JPEG / PNG / GIF / WebP",
      editSave: "保存修改",
      editDelete: "删除",
      editCancel: "取消",
      editLabel: "编辑",
      copyBtn: "复制订单代码",
      copied: "已复制 ✓",
      editConfirmDelete: "确定删除该掉落吗？删除后立即从前端掉落界面消失，此操作不可恢复。",
      editSaveSuccess: "保存成功，掉落界面已同步更新",
      editDeleteSuccess: "删除成功",
      editImageRequired: "请上传介绍图片",
      editTitleRequired: "请填写掉落标题",
      editPriceInvalid: "请填写有效价格",
      focusTip: "焦点：点击下方图片选择角色所在区域",
      noPermission: "无编辑权限，仅管理员可编辑掉落信息",
    },
    entries: {
      shop: {
        kicker: "03 / PRE-ORDER DROPS",
        title: "在线商店",
        titleEn: "Web Shop",
        desc: "预设兽装定期掉落，现货与预售同步开放。无需漫长等待，遇见即是缘分。",
        features: ["预设兽装掉落购买", "现货与预售同步", "工作室直发 · 全程可查"],
        cta: "进入商店",
        href: "/?tab=shop",
      },
      check: {
        kicker: "04 / ORDER TRACKING",
        title: "查询",
        titleEn: "Check",
        desc: "输入订单号与邮箱，随时查看委托进度、留言沟通与售后记录。",
        features: ["订单进度实时查询", "留言与售后沟通", "附件与设定图回顾"],
        cta: "查询订单",
        href: "/?tab=check",
      },
      about: {
        kicker: "05 / ABOUT",
        title: "关于",
        titleEn: "About",
        desc: "认识龙坞：作品图鉴、毛布取色器与创作社群，都从这里开始。",
        features: ["作品图鉴", "毛布取色器", "加入社群"],
        cta: "龙坞图鉴",
        href: "/gallery",
        secondaryCta: "毛布取色器",
        secondaryHref: "/sampler",
        headAction: { label: "加入我们", href: "mailto:hello@longwoo.studio" },
        joinDesc: "通过下方渠道找到龙坞，一起加入我们的社群吧。",
        joinClose: "关闭",
      },
    },
    bubble: {
      signupEn: "Sign up",
      signupZh: "登录/注册",
      langLabel: "语言",
      langTip: "切换语言",
      notifLabel: "站内信",
      notifEmpty: "暂无通知",
      notifLoginHint: "登录后可查看站内信",
      readAll: "全部已读",
      viewOrder: "查看订单",
      markReadFail: "操作失败，请重试",
      loadFail: "加载失败",
      retry: "重试",
      close: "关闭",
      logout: "退出登录",
      loggingOut: "退出中…",
      adminPanel: "管理后台",
      profileBtn: "个人中心",
    },
  },
  en: {
    tabs: { agent: "Agent", fursuit: "Fursuit", shop: "Web Shop", check: "Check", about: "About" },
    agent: {
      kicker: "LONGWOO · CHARACTER LAB",
      heroTitle: "Create Your Character",
      heroTitleEn: "创建你的角色",
      heroLines: [
        "Upload a reference sheet, describe the personality, and generate your character AI for free.",
        "With long-term learning and companionship, the AI mind gets infinitely close to a real one.",
        "A fully trained AI character can be loaded into a physical fursuit in the future.",
      ],
      uploadBtn: "Start Creating",
      newRole: "New character",
      send: "Send",
      formTitle: "Character Profile",
      formTitleEn: "角色设定",
      avatarHint: "Tap to upload avatar · JPEG / PNG / GIF / WebP · ≤ 2MB",
      avatarFallback: "Avatar",
      changeAvatar: "Change",
      nameLabel: "Name",
      namePh: "Give them a name",
      nicknameLabel: "Your Nickname",
      nicknamePh: "How the AI addresses you",
      personaLabel: "Persona",
      personaPh: "Describe their personality, story and way of speaking…",
      toneLabel: "Tone",
      tonePh: "Custom, or pick a preset",
      greetingLabel: "Greeting",
      greetingPh: "The first thing they say to you",
      createBtn: "Create Character",
      creating: "Creating…",
      backBtn: "Back",
      errName: "Please give your character a name first",
      errAvatarLarge: "Avatar image must be under 2MB",
      errAvatarFormat: "Only JPEG / PNG / GIF / WebP are supported",
      errCreate: "Failed to create, please retry",
      errNetwork: "Network error, please retry",
      loginHint: "Sign in first to create a character",
      loginPromptText: "Sign in to create this character. Your draft is saved and will be restored after signing in.",
      goLogin: "Sign In",
      keepEdit: "Keep Editing",
      tonePresets: ["Gentle", "Lively", "Tsundere", "Aloof", "Humorous", "Cute", "Calm", "Warm", "Snarky", "Energetic", "Lazy", "Mysterious"],
      chatMy: "My Characters",
      chatEmpty: "No characters yet — create your first one",
      chatCreateFirst: "Create",
      chatHello: "Say hi to your character",
      chatHelloWithName: "Say hi to your character · they call you “{name}”",
      chatInputPh: "Say something…",
      chatClearTitle: "Clear chat",
      chatClearConfirm: "Clear all chat history with this character?",
      errChatLoad: "Failed to load character, please retry",
      errChatSend: "Failed to send, please retry",
      errChatClear: "Failed to clear, please retry",
      editBtn: "Settings",
      editTitle: "Edit Character",
      editTitleEn: "编辑角色",
      editSubtitle: "Tune their settings anytime — keep them fresh",
      editDelete: "Delete Character",
      editDeleting: "Deleting…",
      editSave: "Save",
      editSaving: "Saving…",
      editDeleteConfirm: "Delete \"{name}\"? All chat history with them will also be deleted. This cannot be undone.",
      errEditSave: "Failed to save, please retry",
      errEditDelete: "Failed to delete, please retry",
      errAvatarUpload: "Failed to upload avatar, please retry",
    },
    fursuit: {
      kicker: "COMMISSION · FULL CUSTOM",
      title: "Commission Your Fursuit",
      titleEn: "委托你的兽装",
      steps: ["Reference Sheet", "Add-ons", "Trade-in", "Contact", "Estimate"],
      deliveryHint: "Estimated delivery in 4-6 weeks*",
      priceRangeHint: "First commission priced between RMB 15,000 - 25,000",
      uploadTitle: "Upload Reference Sheet",
      uploadHint: "Max 20MB per image",
      reupload: "Re-upload",
      remove: "Remove",
      addonMicro: "ADD-ON · 选配",
      addonHint: "Multi-select — chosen items count toward the estimate",
      addonNone: "None",
      addons: [
        { name: "Portable Head Bag", nameEn: "便携式头包", price: "RMB 300", value: 300 },
        { name: "Indoor Feet", nameEn: "室内脚", price: "RMB 750", value: 750 },
        { name: "Longwoo Vision Kit", nameEn: "视觉增强套件", price: "RMB 8,888", value: 8888, disabled: true, tag: "Coming Soon" },
      ],
      benefitTitle: "Step 3: Trade-in or repurchase benefits?",
      benefits: [
        { label: "None", labelEn: "不使用", price: "RMB 0", value: 0 },
        { label: "4-Year Trade-in", labelEn: "4年期换购权益", price: "-RMB 3,000", value: 3000 },
        { label: "Repurchase*", labelEn: "复购权益", price: "-RMB 2,000", value: 2000 },
      ],
      benefitNote: "*First-time clients of the original Xiangshan Studio enjoy the repurchase benefit too",
      priceBase: "Base Price",
      priceAddon: "Add-ons",
      priceDiscount: "Trade-in",
      priceTotal: "Total",
      contactTitle: "Step 4: Your details & contact info",
      bodyTitle: "Body Measurements",
      bodyHint: "Height & weight required · rest optional · helps us estimate sizing",
      socialLabel: "Any account where we can reach you (e.g. Bilibili QQ X...)",
      socialPh: "Enter your social account",
      nameLabel: "Name",
      namePh: "Your name",
      emailLabel: "Email",
      emailPh: "your@email.com",
      dims: [
        { key: "height", label: "Height", unit: "cm" },
        { key: "weight", label: "Weight", unit: "kg" },
        { key: "chest", label: "Chest", unit: "cm" },
        { key: "waist", label: "Waist", unit: "cm" },
        { key: "hip", label: "Hip", unit: "cm" },
        { key: "shoe", label: "Shoe", unit: "" },
      ],
      btnPrev: "Back",
      btnNext: "Next",
      submitBtn: "Submit",
      submitting: "Submitting…",
      submitHint: "We'll manually estimate your commission and reach out soon",
      doneTitle: "Step 5: Await our manual estimate",
      doneText: "We reply with a quote and follow up during weekdays 9:00-17:00",
      orderCodePrefix: "Your order code: ",
      copyBtn: "Copy Order Code",
      copied: "Copied ✓",
      queryLink: "Track Progress",
      saveTip: "Keep this code safe to check your estimate and progress later",
      errImgRequired: "Please upload a reference sheet first",
      errImgType: "Image files only",
      errImgLarge: "Image must be under 20MB",
      errName: "Please enter your name",
      errEmail: "Please enter a valid email address",
      errDimRequired: "Required",
      errSubmit: "Failed to submit, please retry",
      errNetwork: "Network error, please retry",
      errUploadAlert: "Reference sheet upload failed: {msg}. The file name was saved with the order — you can add it later from your profile, or contact support.",
    },
    checkPanel: {
      orderNoLabel: "Order No.",
      orderNoPh: "e.g. LW20250101001",
      emailLabel: "Email",
      emailPh: "Enter the email used when submitting the order",
      btn: "Track Order",
      loading: "Searching…",
      errOrderNoRequired: "Please enter the order number",
      errEmailRequired: "Please enter your email address",
      errEmailInvalid: "Please enter a valid email address",
      errQueryFailed: "Query failed. Check the order number and email",
      errQueryUnknown: "An unknown error occurred. Please try again",
      customerName: "Customer",
      phone: "Phone",
      email: "Email",
      serviceType: "Service",
      notSpecified: "Not specified",
      desc: "Requirements",
      designImage: "Design Image",
      designImageMissing: "Design image failed to upload. Please contact support if needed",
      estimateAmount: "Estimated Amount",
      note: "Note: ",
      deliveryLink: "Delivery Link",
      replies: "Replies",
      createdAt: "Created",
      agreeEstimate: "Accept Estimate",
      agreeEstimateDesc: "Please confirm the estimated amount. The studio will start your order once you accept.",
      agreeEstimateConfirm: "Accept this estimate? The studio will start working on your order shortly after.",
      agreeSuccess: "Estimate accepted. The studio will start working on your order soon",
      agreeFailed: "Failed to confirm. Please try again",
      agreeWaiting: "You have accepted the estimate. The studio will start working after accepting the order. Stay tuned for updates.",
      status: {
        pending: "Pending",
        estimated: "Estimated",
        agreed: "Estimate Accepted",
        accepted: "Accepted",
        rejected: "Rejected",
        processing: "In Progress",
        delivered: "Delivered",
        completed: "Completed",
      },
    },
    shopPanel: {
      dropsEntryKicker: "01",
      dropsEntryTitle: "Drop Fursuits",
      dropsEntryTitleEn: "DROP FURSUITS",
      dropsEntryDesc: "Pre-made fursuits drop regularly — in stock and pre-order at the same time. No long waits.",
      dropsEntryCta: "Browse Drops",
      peripheryEntryKicker: "02",
      peripheryEntryTitle: "LongWoo Merch",
      peripheryEntryTitleEn: "LONGWOO MERCH",
      peripheryEntryDesc: "Merchandise is in preparation. Stay tuned.",
      peripheryEntryCta: "Coming Soon",
      backEntries: "Back to Shop",
      dropsKicker: "01 / DROP ITEMS",
      dropsHeading: "Drop Fursuits",
      dropsSub: "Finished parts ship immediately · remaining parts in 4-6 weeks*",
      loading: "Loading drops…",
      empty: "No drops yet. Stay tuned",
      statusOnSale: "On Sale",
      statusPreparing: "Preparing",
      statusAdopted: "Adopted",
      statusOptionOnSale: "On Sale (buyable)",
      statusOptionPreparing: "Preparing (view only)",
      statusOptionAdopted: "Adopted (in delivery)",
      btnSelect: "Select",
      btnAdopted: "Adopted",
      btnPreparing: "Preparing · Stay Tuned",
      viewImage: "View full image",
      checkoutKicker: "02 / CHECKOUT",
      checkoutTitle: "Confirm Purchase",
      productLabel: "Selected Drop",
      nameLabel: "Name",
      namePh: "Your name",
      emailLabel: "Email",
      emailPh: "your@email.com",
      bodyTitle: "Body Measurements",
      bodyHint: "Optional · helps us estimate sizing",
      heightLabel: "Height",
      weightLabel: "Weight",
      chestLabel: "Chest",
      waistLabel: "Waist",
      hipLabel: "Hip",
      shoeLabel: "Shoe",
      socialLabel: "Any account where we can reach you (e.g. Bilibili QQ X...)",
      socialPh: "Enter your social account",
      agreeText: "I have read and agree to the purchase agreement",
      btnSubmit: "Submit",
      submitting: "Submitting…",
      errName: "Please enter your name",
      errEmail: "Please enter a valid email address",
      errAgree: "Please read and agree to the purchase agreement first",
      doneTitle: "Purchase Successful",
      doneText: "We reply with a quote and follow up during weekdays 9:00-17:00",
      orderCodePrefix: "Your order code: ",
      queryLink: "Track Progress",
      editBanner: "Edit mode: saved changes sync to the public drop page",
      editAdd: "+ Add Drop",
      editExit: "Exit Edit",
      editTitle: "Drop Title",
      editPrice: "Price (RMB)",
      editStatus: "Status",
      editIncludes: "Includes",
      editCopyright: "Copyright",
      editDelivery: "Delivery",
      editDescription: "Description",
      editUpload: "Upload Image",
      editUploading: "Uploading…",
      editUploadHint: "JPEG / PNG / GIF / WebP",
      editSave: "Save Changes",
      editDelete: "Delete",
      editCancel: "Cancel",
      editLabel: "Edit",
      copyBtn: "Copy Order Code",
      copied: "Copied ✓",
      editConfirmDelete: "Delete this drop? It disappears from the public page immediately. This cannot be undone.",
      editSaveSuccess: "Saved. The public drop page has been updated",
      editDeleteSuccess: "Deleted",
      editImageRequired: "Please upload an image",
      editTitleRequired: "Please enter a title",
      editPriceInvalid: "Please enter a valid price",
      focusTip: "Focus: click the image below to choose where the character is",
      noPermission: "No edit permission. Only admins can edit drops",
    },
    entries: {
      shop: {
        kicker: "03 / PRE-ORDER DROPS",
        title: "Web Shop",
        titleEn: "在线商店",
        desc: "Pre-made fursuits drop regularly — in-stock and pre-order side by side. No long wait; when you meet the one, it's fate.",
        features: ["Pre-made fursuit drops", "In-stock & pre-order together", "Shipped by the studio · fully trackable"],
        cta: "Enter Shop",
        href: "/?tab=shop",
      },
      check: {
        kicker: "04 / ORDER TRACKING",
        title: "Check",
        titleEn: "查询",
        desc: "Enter your order number and email to track commission progress, messages and after-sales records anytime.",
        features: ["Real-time order tracking", "Messages & after-sales", "Attachments & reference review"],
        cta: "Track Order",
        href: "/?tab=check",
      },
      about: {
        kicker: "05 / ABOUT",
        title: "About",
        titleEn: "关于",
        desc: "Get to know LongWoo: our work gallery, fabric sampler and community, all from here.",
        features: ["Work gallery", "Fabric sampler", "Community"],
        cta: "View Gallery",
        href: "/gallery",
        secondaryCta: "Fabric Sampler",
        secondaryHref: "/sampler",
        headAction: { label: "Join Us", href: "mailto:hello@longwoo.studio" },
        joinDesc: "Find LongWoo through the channels below and join our community.",
        joinClose: "Close",
      },
    },
    bubble: {
      signupEn: "Sign up",
      signupZh: "登录/注册",
      langLabel: "Language",
      langTip: "Switch language",
      notifLabel: "Inbox",
      notifEmpty: "No notifications yet",
      notifLoginHint: "Sign in to view your inbox",
      readAll: "Mark all read",
      viewOrder: "View order",
      markReadFail: "Failed, please retry",
      loadFail: "Failed to load",
      retry: "Retry",
      close: "Close",
      logout: "Sign out",
      loggingOut: "Signing out…",
      adminPanel: "Admin",
      profileBtn: "Profile",
    },
  },
  "zh-Hant": ZH_HANT_COPY,
  ja: JA_COPY,
  ko: KO_COPY,
  ru: RU_COPY,
  fr: FR_COPY,
};
