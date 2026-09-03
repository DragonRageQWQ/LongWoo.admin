/**
 * LW-I18N 动态页（App Router）语言字典
 * key 与静态页字典（public/js/i18n/en.js）共用同一套语义，按 <页面>.<语义> 组织。
 * zh 为默认；en 提供英文翻译。运行时（错误提示等）文案后续逐步接入。
 */
import { ZH_EXTRA } from './zh-extra'
import { EN_EXTRA } from './en-extra'
import { ZH_ADMIN } from './zh-admin'
import { EN_ADMIN } from './en-admin'

export type Lang = 'zh' | 'en'

/**
 * 全站受支持语言列表（语言菜单 / 地球下拉展示用）
 * 新增全站语言时：1) 扩展 Lang 联合类型  2) 在 I18N_DICTS 补充字典
 * 3) 在此追加一条 meta（label 为该语言的本地化名称）即可，菜单自动展示。
 */
export const LANG_META: { code: Lang; label: string }[] = [
  { code: 'zh', label: '简体中文' },
  { code: 'en', label: 'English' },
]

/** 由语言代码取展示名（兜底返回代码本身） */
export function langLabel(code: Lang): string {
  return LANG_META.find((m) => m.code === code)?.label ?? code
}

export const I18N_DICTS: Record<Lang, Record<string, string>> = {
  zh: {
    // 通用
    'nav.signIn': '立即登录',
    'nav.buyFursuit': '购买兽装',
    'nav.lingWork': '龙灵工坊',
    'nav.buyDrop': '购买掉落',
    'nav.progress': '进度&售后',
    'nav.profile': '个人中心',
    'nav.home': '首页',
    'nav.services': '服务项目',
    'nav.about': '工作室介绍',
    'lang.switchHint': '切换语言',

    // 顶部导航
    'header.submitOrder': '提交委托',
    'header.signIn': '登录',
    'header.logout': '退出登录',
    'header.loggingOut': '退出中...',
    'header.enter': '进入',
    'header.enterAdmin': '管理后台',
    'header.enterProfile': '个人中心',

    // 订单查询页
    'query.title': '查询委托',
    'query.subtitle': '输入委托单号和邮箱查询您的委托进度',
    'query.orderNoLabel': '委托单号',
    'query.emailLabel': '邮箱',
    'query.emailPh': '请输入提交委托时填写的邮箱',
    'query.btn': '查询委托',
    'query.loading': '查询中...',
    'query.customerName': '客户姓名',
    'query.phone': '联系电话',
    'query.email': '邮箱',
    'query.serviceType': '服务类型',
    'query.notSpecified': '未指定',
    'query.desc': '需求描述',
    'query.estimateAmount': '估价金额',
    'query.note': '备注：',
    'query.deliveryLink': '交付链接',
    'query.replies': '回复记录',
    'query.designImage': '设定图',
    'query.designImageMissing': '设定图上传未成功，如有疑问请联系客服',

    // 登录页
    'login.title': '欢迎回来',
    'login.subtitle': '请选择登录方式进入您的工作台',
    'login.tab.email': '邮箱验证码',
    'login.tab.password': '密码登录',
    'login.tab.qq': 'QQ登录',
    'login.email.placeholder': '请输入邮箱',
    'login.password.placeholder': '请输入密码',
    'login.code.placeholder': '请输入6位验证码',
    'login.email.label': '邮箱地址',
    'login.code.label': '验证码',
    'login.password.label': '密码',
    'login.btn.email': '发送验证码',
    'login.btn.login': '登录',
    'login.btn.qq': 'QQ 一键登录',
    'login.forgot': '忘记密码？',
    'login.noAccount': '还没有账户？',
    'login.brand.title1': '专业兽装定制',
    'login.brand.title2': '匠心铸造每一件作品',
    'login.brand.desc': '专注于高品质定制服务，从设计到交付，每一处细节都倾注我们的热忱与专业。',
  },
  en: {
    'nav.signIn': 'Sign In',
    'nav.buyFursuit': 'Commission',
    'nav.lingWork': 'Studio AI',
    'nav.buyDrop': 'Drops',
    'nav.progress': 'Orders & Support',
    'nav.profile': 'Account',
    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.about': 'About the Studio',
    'lang.switchHint': 'Switch language',

    // 顶部导航
    'header.submitOrder': 'Submit Commission',
    'header.signIn': 'Sign In',
    'header.logout': 'Sign Out',
    'header.loggingOut': 'Signing out...',
    'header.enter': 'Go to ',
    'header.enterAdmin': 'Admin',
    'header.enterProfile': 'Account',

    // 订单查询页
    'query.title': 'Order Inquiry',
    'query.subtitle': 'Enter your order number and email to check progress',
    'query.orderNoLabel': 'Order Number',
    'query.emailLabel': 'Email',
    'query.emailPh': 'Enter the email used when submitting the order',
    'query.btn': 'Search',
    'query.loading': 'Searching...',
    'query.customerName': 'Customer Name',
    'query.phone': 'Contact Phone',
    'query.email': 'Email',
    'query.serviceType': 'Service Type',
    'query.notSpecified': 'Not specified',
    'query.desc': 'Requirements',
    'query.estimateAmount': 'Estimated Amount',
    'query.note': 'Note: ',
    'query.deliveryLink': 'Delivery Link',
    'query.replies': 'Replies',
    'query.designImage': 'Design Image',
    'query.designImageMissing': 'Design image failed to upload. Please contact support if needed.',

    'login.title': 'Welcome Back',
    'login.subtitle': 'Choose a sign-in method to enter your dashboard',
    'login.tab.email': 'Email Code',
    'login.tab.password': 'Password',
    'login.tab.qq': 'QQ',
    'login.email.placeholder': 'Enter your email',
    'login.password.placeholder': 'Enter your password',
    'login.code.placeholder': 'Enter the 6-digit code',
    'login.email.label': 'Email Address',
    'login.code.label': 'Verification Code',
    'login.password.label': 'Password',
    'login.btn.email': 'Send Code',
    'login.btn.login': 'Sign In',
    'login.btn.qq': 'Sign in with QQ',
    'login.forgot': 'Forgot password?',
    'login.noAccount': 'No account yet?',
    'login.brand.title1': 'Professional Fursuit Craft',
    'login.brand.title2': 'Every piece, crafted with care',
    'login.brand.desc': 'Focused on high-quality custom service, from design to delivery, every detail carries our passion and expertise.',
  },
}

// 合并补充字典（profile / ai / admin 页面）
const MERGED_ZH = { ...I18N_DICTS.zh, ...ZH_EXTRA, ...ZH_ADMIN }
const MERGED_EN = { ...I18N_DICTS.en, ...EN_EXTRA, ...EN_ADMIN }

export function translate(lang: Lang, key: string): string {
  const dict = (lang === 'en' ? MERGED_EN : MERGED_ZH)
  return dict[key] !== undefined ? dict[key] : key
}
