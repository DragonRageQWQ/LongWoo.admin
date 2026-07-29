export type Profile = {
  id: string
  uid: number | null
  email: string
  role: 'studio' | 'admin'
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
