import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { validateApiCsrf } from '@/lib/api-csrf'
import { edgeSynthesize } from '@/lib/pet/edge-tts'
import {
  findBuiltinVoice,
  isBuiltinEngineId,
  petBuiltinEngineId,
  petPitchToHz,
  petRateToPercent,
} from '@/lib/pet/voices'

export const dynamic = 'force-dynamic'
// Edge Read Aloud 为流式合成，给足超时余量
export const maxDuration = 30

/**
 * POST /api/pet/tts
 *
 * 桌宠内置音色语音合成代理。
 *
 * 安全设计：
 * 1. CSRF 校验（Origin/Referer 白名单），防止第三方站点滥用代理
 * 2. voice 白名单：仅允许内置音色目录中的 id，杜绝任意参数注入
 * 3. 文本长度限制（≤300 字符）+ 请求体大小限制，防滥用
 * 4. SSML 转义：文本中的 XML 特殊字符一律转义，防止 SSML 注入
 * 5. 轻量内存限流（按 IP 滑动窗口），防刷接口
 *
 * 请求体（JSON）：
 *   text:  要朗读的文本（≤300 字符）
 *   voice: 内置音色引擎 id 或 `edge:` 前缀标识（白名单校验）
 *   pitch: 可选，音调 0.5~2（1 = 原声）
 *   rate:  可选，语速倍率（1 = 原速）
 *
 * 返回：audio/mpeg 音频流
 */

const MAX_TEXT_LENGTH = 300
const MAX_BODY_SIZE = 4096

interface SynthOpts {
  voice: string
  text: string
  ratePct: string
  pitchHz: string
}

/**
 * 文件桥合成（本地开发守护进程通道）
 *
 * 说明：fork 子进程 worker 仅在本机沙箱调试时使用，无法通过生产构建
 * （Turbopack 会把 fork 的动态路径当作模块解析而失败，且 Serverless 环境
 * 不支持子进程）。因此线上只保留两条通道：
 *  - 生产 / 无守护进程：进程内合成（edgeSynthesize，直连微软 Read Aloud）
 *  - 本地开发有守护进程：tts-daemon.cjs 通过文件系统收发任务
 *    （本机沙箱限制监听进程的出站大流量 ws，非监听进程不受限）
 */
function petTtsSpoolDir(): string {
  return process.env.PET_TTS_SPOOL || path.join(os.tmpdir(), 'pet-tts-spool')
}

async function daemonAvailable(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false
  try {
    const pidFile = path.join(petTtsSpoolDir(), 'daemon.pid')
    const pid = parseInt((await fsp.readFile(pidFile, 'utf8')).trim(), 10)
    if (!pid) return false
    // 进程存活检查（Windows 下用 process.kill(pid, 0)）
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  } catch {
    return false
  }
}

async function synthViaDaemon(opts: SynthOpts): Promise<Buffer> {
  const spool = petTtsSpoolDir()
  await fsp.mkdir(spool, { recursive: true })
  const id = randomUUID()
  const jobFile = path.join(spool, `${id}.job`)
  const mp3File = path.join(spool, `${id}.mp3`)
  const doneFile = path.join(spool, `${id}.done`)
  await fsp.writeFile(jobFile, JSON.stringify({ id, ...opts }), 'utf8')

  const deadline = Date.now() + 28_000
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  try {
    while (Date.now() < deadline) {
      let raw: string | null = null
      try {
        raw = await fsp.readFile(doneFile, 'utf8')
      } catch {
        /* done 尚未出现，等待 */
      }
      if (raw != null) {
        let done: { ok?: boolean; len?: number; error?: string }
        try {
          done = JSON.parse(raw)
        } catch {
          // done 被守护进程半写入：短暂等待后重试
          await sleep(150)
          continue
        }
        if (done.ok && typeof done.len === 'number') {
          const audio = await fsp.readFile(mp3File)
          if (audio.length !== done.len) throw new Error('Edge TTS 守护进程返回不完整音频')
          return audio
        }
        throw new Error(done.error || 'Edge TTS 守护进程合成失败')
      }
      await sleep(150)
    }
    throw new Error('Edge TTS 守护进程处理超时')
  } finally {
    for (const f of [jobFile, mp3File, doneFile]) {
      fsp.unlink(f).catch(() => {})
    }
  }
}

/** 合成通道：本地开发有守护进程时走守护进程（沙箱出站限制的绕行方案），否则进程内合成 */
async function synthAudio(opts: SynthOpts): Promise<Buffer> {
  if (await daemonAvailable()) {
    return synthViaDaemon(opts)
  }
  return edgeSynthesize(opts)
}

// 轻量内存限流：IP -> 窗口内请求时间戳
const rateBuckets = new Map<string, number[]>()
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 60 // 每分钟 60 次（桌宠语音频率远低于此）
const CLEANUP_INTERVAL_MS = 10 * 60_000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  if (arr.length >= RATE_MAX) {
    rateBuckets.set(ip, arr)
    return true
  }
  arr.push(now)
  rateBuckets.set(ip, arr)
  return false
}

// 定期清理过期限流记录，防止内存膨胀
setInterval(() => {
  const now = Date.now()
  for (const [ip, arr] of rateBuckets) {
    const alive = arr.filter((t) => now - t < RATE_WINDOW_MS)
    if (alive.length === 0) rateBuckets.delete(ip)
    else rateBuckets.set(ip, alive)
  }
}, CLEANUP_INTERVAL_MS).unref?.()

export async function POST(request: NextRequest) {
  // ===== CSRF 校验 =====
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  // ===== 请求体大小限制 =====
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ success: false, error: '请求内容过大' }, { status: 413 })
  }

  // ===== 限流 =====
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ success: false, error: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  // ===== 参数解析与校验 =====
  let body: { text?: unknown; voice?: unknown; pitch?: unknown; rate?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '无效的请求体' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ success: false, error: '缺少文本内容' }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { success: false, error: `文本过长（最多 ${MAX_TEXT_LENGTH} 字符）` },
      { status: 400 }
    )
  }

  // voice：兼容带/不带 edge: 前缀；必须在内置目录白名单内
  const rawVoice = typeof body.voice === 'string' ? body.voice : ''
  const engineId = petBuiltinEngineId(rawVoice) ?? rawVoice
  if (!engineId || !isBuiltinEngineId(engineId)) {
    return NextResponse.json({ success: false, error: '音色不在内置目录中' }, { status: 400 })
  }
  const builtin = findBuiltinVoice(engineId)
  if (!builtin) {
    return NextResponse.json({ success: false, error: '音色不存在' }, { status: 400 })
  }

  const pitch = typeof body.pitch === 'number' && body.pitch >= 0.5 && body.pitch <= 2 ? body.pitch : 1
  const rate = typeof body.rate === 'number' && body.rate >= 0.5 && body.rate <= 2 ? body.rate : 1

  // ===== 服务端合成（Edge Read Aloud 免费通道，key 不暴露） =====
  const fail502 = (phase: string, err: unknown) => {
    // 诊断头仅限 ASCII，避免非拉丁字符触发 Headers 校验异常
    const asciiSafe = String((err as Error)?.stack || (err as Error)?.message || err).replace(/[^\x20-\x7E]/g, '?')
    const detail = `[${phase}] ${asciiSafe}`
    console.error('[pet:tts] 合成失败', engineId, asciiSafe.slice(0, 400))
    const res = NextResponse.json(
      { success: false, error: '语音服务暂不可用，请稍后再试' },
      { status: 502 }
    )
    if (process.env.NODE_ENV !== 'production') res.headers.set('X-Dbg-Err', detail.slice(0, 600))
    return res
  }
  try {
    const audio = await synthAudio({
      voice: engineId,
      text,
      ratePct: petRateToPercent(rate),
      pitchHz: petPitchToHz(pitch),
    })

    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.length),
        'Cache-Control': 'no-store',
        'X-Pet-Voice': engineId,
      },
    })
  } catch (e) {
    return fail502('synth', e)
  }
}
