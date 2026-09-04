import https from 'node:https'
import crypto from 'node:crypto'
import { escapeSsmlText } from './voices'

/**
 * Edge Read Aloud TTS 客户端（服务端直连，免 Key、免费）
 *
 * 协议参考微软 Edge 朗读（speech.platform.bing.com readaloud v1）。
 * 基于 Node 内建 https 手动实现 WebSocket 握手/帧读写：
 * - 不依赖第三方 ws 库（避免其在 Next 路由打包/沙箱环境下行为不一致）
 * - 可与 Next 路由运行环境（Node）一致工作，dev/生产同栈
 *
 * 注意：该通道面向终端用户网页服务，适合灰度/自有小规模使用；若商业化大规模
 * 商用建议替换为 Azure Speech（同一批 neural voice，语义一致，需 Key）。
 */

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const SEC_MS_GEC_VERSION = '1-143.0.3650.96'
const WSS_HOST = 'speech.platform.bing.com'
const WSS_PATH =
  '/consumer/speech/synthesize/readaloud/edge/v1'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
const ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
const CRLF_CRLF = '\r\n\r\n'
const AUDIO_DELIM = Buffer.from('Path:audio\r\n')
const TURN_END = 'Path:turn.end'

const MAX_CONNECT_MS = 15_000
const MAX_TOTAL_MS = 30_000

// ---------- WebSocket 帧编解码 ----------

const OP_TEXT = 0x1
const OP_BINARY = 0x2
const OP_CLOSE = 0x8
const OP_PING = 0x9
const OP_PONG = 0xa

function encodeClientFrame(payload: Buffer, opcode: number): Buffer {
  const mask = crypto.randomBytes(4)
  const header = Buffer.alloc(10)
  let offset = 0
  header[offset++] = 0x80 | opcode // FIN + opcode
  const len = payload.length
  if (len < 126) {
    header[offset++] = 0x80 | len // MASK + len7
  } else if (len < 65536) {
    header[offset++] = 0x80 | 126
    header.writeUInt16BE(len, offset)
    offset += 2
  } else {
    header[offset++] = 0x80 | 127
    header.writeUInt32BE(0, offset)
    header.writeUInt32BE(len, offset + 4)
    offset += 8
  }
  header.set(mask, offset)
  offset += 4
  const masked = Buffer.allocUnsafe(len)
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3]
  return Buffer.concat([header.subarray(0, offset), masked])
}

/** 简易帧解析器：累加数据、按帧回调（支持分片合并、masked 解码、ping 自动 pong） */
class FrameParser {
  private buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  private fragments: { opcode: number; data: Buffer } | null = null
  onFrame: ((opcode: number, payload: Buffer) => void) | null = null
  onPong: (() => void) | null = null

  push(chunk: Buffer): void {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk])
    this.tryParse()
  }

  private tryParse(): void {
    for (;;) {
      const buf = this.buffer
      if (buf.length < 2) return
      const b0 = buf[0]
      const b1 = buf[1]
      const fin = (b0 & 0x80) !== 0
      const opcode = b0 & 0x0f
      const masked = (b1 & 0x80) !== 0
      let len = b1 & 0x7f
      let offset = 2
      if (len === 126) {
        if (buf.length < 4) return
        len = buf.readUInt16BE(2)
        offset = 4
      } else if (len === 127) {
        if (buf.length < 10) return
        const hi = buf.readUInt32BE(2)
        const lo = buf.readUInt32BE(6)
        if (hi !== 0 || lo > 0x7fffffff) {
          this.buffer = Buffer.alloc(0)
          return // 超大帧，直接丢弃
        }
        len = lo
        offset = 10
      }
      if (masked) {
        if (buf.length < offset + 4) return
        offset += 4
      }
      if (buf.length < offset + len) return
      let payload = buf.subarray(offset, offset + len)
      if (masked) {
        const mask = buf.subarray(masked ? offset - 4 : offset, masked ? offset : offset)
        const unmasked = Buffer.allocUnsafe(len)
        for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ mask[i & 3]
        payload = unmasked
      }
      this.buffer = buf.subarray(offset + len)

      if (opcode === OP_PING) {
        this.onFrame?.(OP_PING, payload)
        continue
      }
      if (opcode === OP_PONG) {
        this.onPong?.()
        continue
      }
      if (opcode === OP_CLOSE) {
        this.onFrame?.(OP_CLOSE, payload)
        return
      }
      if (opcode === OP_TEXT || opcode === OP_BINARY) {
        if (fin) {
          this.onFrame?.(opcode, payload)
        } else {
          this.fragments = { opcode, data: payload }
        }
        continue
      }
      // continuation (opcode 0)
      if (this.fragments) {
        this.fragments.data = Buffer.concat([this.fragments.data, payload])
        if (fin) {
          const frag = this.fragments
          this.fragments = null
          this.onFrame?.(frag.opcode, frag.data)
        }
      }
    }
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

async function generateSecMsGec(): Promise<string> {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600
  const rounded = ticks - (ticks % 300)
  const windowsTicks = rounded * 10000000
  const data = new TextEncoder().encode(`${windowsTicks}${TRUSTED_CLIENT_TOKEN}`)
  const hash = await crypto.webcrypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/** 由引擎音色 id 推导 BCP-47 语言（zh-CN-liaoning-XiaobeiNeural -> zh-CN） */
function voiceLocale(voice: string): string {
  const m = /\w{2}-\w{2}/.exec(voice)
  return m ? m[0] : 'zh-CN'
}

export interface EdgeTtsOptions {
  /** 引擎音色 id，如 zh-CN-XiaoxiaoNeural */
  voice: string
  /** 朗读文本（调用方已做长度/白名单校验） */
  text: string
  /** 语速相对基准的百分比，如 +5% / -10% */
  ratePct: string
  /** 音高偏移，如 +0Hz / +60Hz / -80Hz */
  pitchHz: string
}

/**
 * 合成并返回完整 MP3 音频（Buffer）。
 * 失败时抛出带原因的 Error。
 */
export async function edgeSynthesize(opts: EdgeTtsOptions): Promise<Buffer> {
  const { voice, text, ratePct, pitchHz } = opts
  const requestId = generateUUID()
  const secMsGec = await generateSecMsGec()
  const query =
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}` +
    `&ConnectionId=${requestId}`

  const chunks: Buffer[] = []
  const parser = new FrameParser()

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false
    let turnEnded = false
    let handshakeStatus = 0
    let connectTimer: NodeJS.Timeout | null = null
    let totalTimer: NodeJS.Timeout | null = null
    let socket: import('node:http').ClientRequest | null = null
    let rawSock: import('node:net').Socket | null = null
    let pongSink: ((payload: Buffer) => void) | null = null

    const cleanup = () => {
      if (connectTimer) clearTimeout(connectTimer)
      if (totalTimer) clearTimeout(totalTimer)
      try { rawSock?.destroy() } catch { /* 忽略 */ }
      try { if (!rawSock) socket?.destroy() } catch { /* 忽略 */ }
    }

    const fail = (message: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(`${message}${handshakeStatus ? ` (http ${handshakeStatus})` : ''}`))
    }

    const succeed = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve(Buffer.concat(chunks))
    }

    parser.onFrame = (opcode, payload) => {
      if (opcode === OP_TEXT) {
        const textFrame = payload.toString('utf8')
        if (textFrame.includes(TURN_END)) turnEnded = true
        // turn.end 在全部音频之后到达，出现即代表本段合成完成（服务端不主动断开）
        if (turnEnded && chunks.length > 0) succeed()
        return
      }
      if (opcode === OP_BINARY) {
        // 注意：服务端将文本帧（含 turn.end）也以二进制帧下发，需统一按内容检测
        if (payload.toString('utf8').includes(TURN_END)) turnEnded = true
        const audioIdx = payload.indexOf(AUDIO_DELIM)
        if (audioIdx >= 0) {
          const audio = payload.subarray(audioIdx + AUDIO_DELIM.length)
          if (audio.length > 0) chunks.push(audio)
        }
        if (turnEnded && chunks.length > 0) succeed()
        return
      }
      if (opcode === OP_CLOSE) {
        fail('Edge TTS 连接被服务端关闭')
        return
      }
      if (opcode === OP_PING) {
        pongSink?.(payload)
      }
    }

    connectTimer = setTimeout(() => fail('Edge TTS 连接超时'), MAX_CONNECT_MS)
    totalTimer = setTimeout(() => fail('Edge TTS 合成超时'), MAX_TOTAL_MS)

    const req = https.request({
      host: WSS_HOST,
      path: `${WSS_PATH}${query}`,
      method: 'GET',
      headers: {
        Host: WSS_HOST,
        Upgrade: 'websocket',
        Connection: 'Upgrade',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
        'User-Agent': USER_AGENT,
        Origin: ORIGIN,
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
    })
    socket = req
    req.on('upgrade', (_res, rawSocket, head) => {
      if (connectTimer) clearTimeout(connectTimer)
      const wsSocket = rawSocket as import('node:net').Socket
      rawSock = wsSocket
      if (head && head.length > 0) parser.push(head)

      wsSocket.on('data', (chunk: Buffer) => parser.push(chunk))
      wsSocket.on('error', (err) => fail(`Edge TTS WebSocket 错误: ${err.message}`))
      wsSocket.on('close', () => {
        if (settled) return
        if (!turnEnded) {
          fail('Edge TTS 连接中断（未收到完整音频）')
          return
        }
        if (chunks.length === 0) {
          fail('Edge TTS 未返回音频数据')
          return
        }
        succeed()
      })

      wsSocket.setTimeout(MAX_TOTAL_MS, () => fail('Edge TTS 合成超时'))

      const sendText = (data: string) => {
        if (!wsSocket.writable) return false
        wsSocket.write(encodeClientFrame(Buffer.from(data, 'utf8'), OP_TEXT))
        return true
      }
      pongSink = (payload) => {
        if (wsSocket.writable) {
          try { wsSocket.write(encodeClientFrame(payload, OP_PONG)) } catch { /* 忽略 */ }
        }
      }

      const config =
        `X-RequestId:${requestId}\r\n` +
        'Content-Type:application/json; charset=utf-8\r\n' +
        `Path:speech.config${CRLF_CRLF}` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: false,
                  wordBoundaryEnabled: false,
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        })
      sendText(config)

      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"` +
        ` xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voiceLocale(voice)}">` +
        `<voice name="${voice}">` +
        `<prosody pitch="${pitchHz}" rate="${ratePct}" volume="100">` +
        `${escapeSsmlText(text)}` +
        `</prosody></voice></speak>`
      const request =
        `X-RequestId:${requestId}\r\n` +
        'Content-Type:application/ssml+xml\r\n' +
        `Path:ssml${CRLF_CRLF}` +
        ssml.trim()
      sendText(request)
    })

    req.on('response', (res) => {
      handshakeStatus = res.statusCode || 0
      res.resume()
      fail('Edge TTS 握手被拒绝')
    })

    req.on('error', (err) => {
      fail(`Edge TTS 连接失败: ${err.message}`)
    })

    req.setTimeout(MAX_CONNECT_MS, () => {
      fail('Edge TTS 连接超时')
    })
    req.end()
  })
}
