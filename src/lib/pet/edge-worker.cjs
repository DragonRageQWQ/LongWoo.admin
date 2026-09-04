/**
 * 桌宠内置音色合成 worker（Node 子进程）
 *
 * 由 Next 路由（/api/pet/tts）在需要时 fork；合成逻辑见 edge-synth-core.cjs。
 *
 * 通信协议（stdio IPC）：
 *   parent -> worker: { id, opts: { voice, text, ratePct, pitchHz } }
 *   worker -> parent: { id, ok: true, audio: <base64> } | { id, ok: false, error: string }
 */
'use strict';

const { synthEdgeAudio } = require('./edge-synth-core.cjs');

process.on('message', async (msg) => {
  if (!msg || typeof msg !== 'object' || !msg.id) return;
  try {
    const audio = await synthEdgeAudio(msg.opts || {});
    process.send({ id: msg.id, ok: true, audio: audio.toString('base64') });
  } catch (e) {
    process.send({ id: msg.id, ok: false, error: String((e && e.message) || e) });
  }
});
