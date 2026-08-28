export type Gt2Lang = "zh" | "en";
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
}

export interface Gt2Copy {
  agent: {
    kicker: string;
    heroTitle: string;
    heroTitleEn: string;
    heroLines: string[];
    uploadBtn: string;
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
    tonePresets: string[];
    chatMy: string;
    chatEmpty: string;
    chatCreateFirst: string;
    chatHello: string;
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
    uploadTitle: string;
    uploadHint: string;
    reupload: string;
    remove: string;
    addonMicro: string;
    addonHint: string;
    addons: { name: string; nameEn: string; price: string }[];
    dims: { key: "height" | "chest" | "shoe" | "waist"; label: string; unit: string }[];
    remarkPh: string;
    submitBtn: string;
    submitHint: string;
    errImgRequired: string;
    errImgType: string;
    errImgLarge: string;
  };
  entries: Record<"shop" | "check" | "about", Gt2EntryCopy>;
  bubble: {
    signupEn: string;
    signupZh: string;
    langLabel: string;
    notifLabel: string;
    notifEmpty: string;
    notifLoginHint: string;
    readAll: string;
    viewOrder: string;
    markReadFail: string;
    loadFail: string;
    retry: string;
    logout: string;
    loggingOut: string;
    adminPanel: string;
    profileBtn: string;
  };
}

export const COPY: Record<Gt2Lang, Gt2Copy> = {
  zh: {
    agent: {
      kicker: "LONGWOO · CHARACTER LAB",
      heroTitle: "创建你的角色",
      heroTitleEn: "Create Your Character",
      heroLines: [
        "上传设定图，描述角色的个性，免费生成你的专属角色 AI。",
        "长期的学习与陪伴，可以让 AI 心智无限逼近于真实状态。",
        "已被充分训练的 AI 角色，可以被载入实体兽装。",
      ],
      uploadBtn: "上传",
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
      tonePresets: ["温柔", "活泼", "傲娇", "高冷", "幽默", "可爱", "沉稳", "热情", "毒舌", "元气", "慵懒", "神秘"],
      chatMy: "我的角色",
      chatEmpty: "还没有角色，创建你的第一个角色吧",
      chatCreateFirst: "去创建",
      chatHello: "和 TA 打个招呼吧",
      chatInputPh: "对 TA 说点什么…",
      chatClearTitle: "清空对话",
      chatClearConfirm: "确定要清空和这个角色的全部对话记录吗？",
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
      uploadTitle: "上传设定图",
      uploadHint: "图片不大于 20M",
      reupload: "重新上传",
      remove: "移除",
      addonMicro: "选配 · ADD-ON",
      addonHint: "点击进入选配流程，可多选",
      addons: [
        { name: "便携式头包", nameEn: "Head Bag", price: "RMB 300" },
        { name: "室内脚", nameEn: "Indoor Feet", price: "RMB 750" },
      ],
      dims: [
        { key: "height", label: "身高", unit: "cm" },
        { key: "chest", label: "胸围", unit: "cm" },
        { key: "shoe", label: "鞋码", unit: "cm" },
        { key: "waist", label: "腰围", unit: "cm" },
      ],
      remarkPh: ">_< 有什么要嘱咐我们的？",
      submitBtn: "确认估价",
      submitHint: "已填信息将自动带入完整委托流程",
      errImgRequired: "请先上传设定图",
      errImgType: "仅支持图片文件",
      errImgLarge: "图片不能超过 20MB",
    },
    entries: {
      shop: {
        kicker: "03 / PRE-ORDER DROPS",
        title: "在线商店",
        titleEn: "Web Shop",
        desc: "预设兽装定期掉落，现货与预售同步开放。无需漫长等待，遇见即是缘分。",
        features: ["预设兽装掉落购买", "现货与预售同步", "工作室直发 · 全程可查"],
        cta: "进入商店",
        href: "/preorder-step1.html",
      },
      check: {
        kicker: "04 / ORDER TRACKING",
        title: "查询",
        titleEn: "Check",
        desc: "输入订单号与手机号，随时查看委托进度、留言沟通与售后记录。",
        features: ["订单进度实时查询", "留言与售后沟通", "附件与设定图回顾"],
        cta: "查询订单",
        href: "/order/query",
      },
      about: {
        kicker: "05 / ACCOUNT",
        title: "关于",
        titleEn: "About",
        desc: "管理你的个人资料、历史委托与通知设置。",
        features: ["个人资料管理", "历史订单汇总", "通知与安全设置"],
        cta: "前往个人中心",
        href: "/profile",
      },
    },
    bubble: {
      signupEn: "Sign up",
      signupZh: "登录/注册",
      langLabel: "语言",
      notifLabel: "站内信",
      notifEmpty: "暂无通知",
      notifLoginHint: "登录后可查看站内信",
      readAll: "全部已读",
      viewOrder: "查看订单",
      markReadFail: "操作失败，请重试",
      loadFail: "加载失败",
      retry: "重试",
      logout: "退出登录",
      loggingOut: "退出中…",
      adminPanel: "管理后台",
      profileBtn: "个人中心",
    },
  },
  en: {
    agent: {
      kicker: "LONGWOO · CHARACTER LAB",
      heroTitle: "Create Your Character",
      heroTitleEn: "创建你的角色",
      heroLines: [
        "Upload a reference sheet, describe the personality, and generate your character AI for free.",
        "With long-term learning and companionship, the AI mind gets infinitely close to a real one.",
        "A fully trained AI character can be loaded into a physical fursuit.",
      ],
      uploadBtn: "Upload",
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
      tonePresets: ["Gentle", "Lively", "Tsundere", "Aloof", "Humorous", "Cute", "Calm", "Warm", "Snarky", "Energetic", "Lazy", "Mysterious"],
      chatMy: "My Characters",
      chatEmpty: "No characters yet — create your first one",
      chatCreateFirst: "Create",
      chatHello: "Say hi to your character",
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
      uploadTitle: "Upload Reference Sheet",
      uploadHint: "Max 20MB per image",
      reupload: "Re-upload",
      remove: "Remove",
      addonMicro: "ADD-ON · 选配",
      addonHint: "Enter the add-on flow, multi-select supported",
      addons: [
        { name: "Portable Head Bag", nameEn: "便携式头包", price: "RMB 300" },
        { name: "Indoor Feet", nameEn: "室内脚", price: "RMB 750" },
      ],
      dims: [
        { key: "height", label: "Height", unit: "cm" },
        { key: "chest", label: "Chest", unit: "cm" },
        { key: "shoe", label: "Shoe", unit: "cm" },
        { key: "waist", label: "Waist", unit: "cm" },
      ],
      remarkPh: ">_< Anything you'd like to tell us?",
      submitBtn: "Get a Quote",
      submitHint: "Your entries will carry into the full commission flow",
      errImgRequired: "Please upload a reference sheet first",
      errImgType: "Image files only",
      errImgLarge: "Image must be under 20MB",
    },
    entries: {
      shop: {
        kicker: "03 / PRE-ORDER DROPS",
        title: "Web Shop",
        titleEn: "在线商店",
        desc: "Pre-made fursuits drop regularly — in-stock and pre-order side by side. No long wait; when you meet the one, it's fate.",
        features: ["Pre-made fursuit drops", "In-stock & pre-order together", "Shipped by the studio · fully trackable"],
        cta: "Enter Shop",
        href: "/preorder-step1.html",
      },
      check: {
        kicker: "04 / ORDER TRACKING",
        title: "Check",
        titleEn: "查询",
        desc: "Enter your order number and phone to track commission progress, messages and after-sales records anytime.",
        features: ["Real-time order tracking", "Messages & after-sales", "Attachments & reference review"],
        cta: "Track Order",
        href: "/order/query",
      },
      about: {
        kicker: "05 / ACCOUNT",
        title: "About",
        titleEn: "关于",
        desc: "Manage your profile, past commissions and notification settings.",
        features: ["Profile management", "Order history", "Notifications & security"],
        cta: "Go to Profile",
        href: "/profile",
      },
    },
    bubble: {
      signupEn: "Sign up",
      signupZh: "登录/注册",
      langLabel: "Language",
      notifLabel: "Inbox",
      notifEmpty: "No notifications yet",
      notifLoginHint: "Sign in to view your inbox",
      readAll: "Mark all read",
      viewOrder: "View order",
      markReadFail: "Failed, please retry",
      loadFail: "Failed to load",
      retry: "Retry",
      logout: "Sign out",
      loggingOut: "Signing out…",
      adminPanel: "Admin",
      profileBtn: "Profile",
    },
  },
};
