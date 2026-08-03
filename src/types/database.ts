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
  /** 发送时的目标群体：all=全体用户，admin=全体管理员，user=全体普通成员 */
  target_role: 'all' | 'admin' | 'user'
  title: string
  content: string
  is_read: boolean
  read_at: string | null
  created_at: string
}
