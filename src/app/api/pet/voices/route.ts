import { NextResponse } from 'next/server'
import { PET_BUILTIN_VOICES, petBuiltinVoiceURI } from '@/lib/pet/voices'

/**
 * GET /api/pet/voices
 *
 * 返回桌宠「内置音色」目录（服务端 Edge Read Aloud TTS，免安装、免 Key）。
 * 运行时在初始化时拉取，与浏览器系统语音合并展示。
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    success: true,
    voices: PET_BUILTIN_VOICES.map((v) => ({
      ...v,
      voiceURI: petBuiltinVoiceURI(v.id),
    })),
  })
}
