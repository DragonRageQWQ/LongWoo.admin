export type UserRole = 'user' | 'admin'

export type Profile = {
  id: string
  uid: number | null
  email: string
  role: UserRole
  phone: string | null
  display_name: string
  avatar_url: string | null
  is_active: boolean
  has_password: boolean
  created_at: string
  updated_at: string
}

export type ServiceType = {
  id: string
  name: string
  description: string | null
  process_steps: string | null
  price_range: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export type OrderStatus = 'pending' | 'estimated' | 'accepted' | 'rejected' | 'processing' | 'delivered' | 'completed'

export type Order = {
  id: string
  order_no: string
  service_type_id: string | null
  status: OrderStatus
  customer_name: string
  customer_phone: string
  customer_email: string
  requirements: string
  estimated_price: number | null
  estimate_notes: string | null
  reject_reason: string | null
  studio_user_id: string | null
  delivery_url: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
  service_types?: ServiceType
  profiles?: Profile
}

export type OrderAttachment = {
  id: string
  order_id: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string | null
  created_at: string
}

export type ReplyType = 'site' | 'email' | 'sms'

export type OrderReply = {
  id: string
  order_id: string
  reply_type: ReplyType
  content: string
  sender_id: string
  sent_at: string
  profiles?: Profile
}

export type OperationLog = {
  id: string
  order_id: string
  user_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

export type CaseItem = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  service_type_id: string | null
  is_featured: boolean
  sort_order: number
  created_at: string
}

/** 作品（我们的作品展示） */
export type Work = {
  id: string
  /** 图片编码序号（'01','02'...，增删后自动重排） */
  code: string
  title: string
  tag: string
  description: string
  work_type: string
  delivery: string
  craft: string
  image_url: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 作品创建/更新入参 */
export type WorkInput = {
  title: string
  tag: string
  description: string
  work_type: string
  delivery: string
  craft: string
  image_url: string
}

// ===== 购买掉落：预设兽装掉落管理 =====

/** 掉落状态：on_sale 发售（可购买）/ preparing 准备（仅查看）/ adopted 领养（交付中） */
export type DropItemStatus = 'on_sale' | 'preparing' | 'adopted'

/** 掉落状态中文标签（前端展示用） */
export const DROP_STATUS_LABELS: Record<DropItemStatus, string> = {
  on_sale: '发售',
  preparing: '准备',
  adopted: '领养',
}

/** 掉落状态说明（管理后台提示用） */
export const DROP_STATUS_DESCRIPTIONS: Record<DropItemStatus, string> = {
  on_sale: '发售：用户可以购买',
  preparing: '准备：只能查看，不能购买',
  adopted: '领养：已被其他用户购买，交付中',
}

/**
 * 掉落条目（drop_items 表）
 * title      - 掉落标题
 * description- 介绍信息
 * image_url  - 介绍图片
 * price      - 价格（RMB）
 * status     - 掉落状态（on_sale / preparing / adopted）
 * copyright  - 版权说明
 * delivery   - 交付说明
 * includes   - 包含内容
 */
export type DropItem = {
  id: string
  title: string
  description: string
  image_url: string
  price: number
  status: DropItemStatus
  copyright: string
  delivery: string
  includes: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 掉落创建/更新入参 */
export type DropItemInput = {
  title: string
  description: string
  image_url: string
  price: number
  status: DropItemStatus
  copyright: string
  delivery: string
  includes: string
}

// ===== 龙灵工坊：AI 角色扮演对话 =====

/**
 * AI 角色（用户的 OC，按账号保存）
 * name           - AI 角色昵称（AI 的名字）
 * avatar_url     - AI 头像
 * persona        - 人设（角色性格、背景、说话风格）
 * tone           - 语气风格（温柔/活泼/傲娇/高冷等，可随时调整）
 * greeting       - 开场白（进入对话时的问候语）
 * user_nickname  - 称呼（AI 对用户的称呼，如"主人""朋友"）
 */
export type AiCharacter = {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  persona: string | null
  tone: string | null
  greeting: string | null
  user_nickname: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** AI 对话消息 */
export type AiChatMessage = {
  id: string
  character_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

/** 通知/站内信（单表 + 每用户一条记录） */
export type Notification = {
  id: string
  /** 收件人 */
  user_id: string
  /** 发送人（管理员），null 表示系统 */
  sender_user_id: string | null
  /** 群发批次标识：同批次所有收件人记录共享，供超管按批次修改/删除 */
  batch_id: string | null
  /** 发送时的目标群体：all=全体用户，admin=全体管理员，user=全体普通成员 */
  target_role: 'all' | 'admin' | 'user'
  title: string
  content: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

// ===== 建议与反馈 =====

/** 反馈类别：bug=问题反馈 suggestion=建议 other=其他 */
export type FeedbackCategory = 'bug' | 'suggestion' | 'other'

/** 反馈状态：pending=待处理 replied=已回复 adopted=已采纳 */
export type FeedbackStatus = 'pending' | 'replied' | 'adopted'

/** 用户反馈（user_feedback 表） */
export type UserFeedback = {
  id: string
  /** 提交人 */
  user_id: string
  category: FeedbackCategory
  /** 简短标题 */
  title: string
  /** 详细内容 */
  content: string
  status: FeedbackStatus
  /** 管理员回复内容（未回复时为空） */
  reply: string | null
  replied_by: string | null
  replied_at: string | null
  /** 用户是否已读管理员回复（红标统计依据） */
  reply_read: boolean
  created_at: string
  updated_at: string
  /** 关联提交人信息（管理员列表用） */
  profiles?: Pick<Profile, 'id' | 'uid' | 'email' | 'display_name' | 'avatar_url'> | null
}
