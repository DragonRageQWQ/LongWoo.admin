/**
 * Edge Read Aloud 合成核心（CJS 共享模块）
 *
 * 供两类宿主复用：
 *  - edge-worker.cjs：由 Next 路由 fork 的子进程（IPC 包装）
 *  - tts-daemon.cjs：开发环境文件桥守护进程（不监听端口，避开本地沙箱对
 *    监听进程出站大流量 ws 的限制）
 *
 * 协议要点：
 *  - 服务端把文本帧（含 turn.end）也以二进制帧下发
 *  - turn.end 到达后服务端不主动断连：以收到音块 + turn.end 判定完成
 *  - 需要 Edge UA + 扩展 Origin 头才能通过握手
 */
'use strict';

const WebSocket = require('ws');

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VERSION = '1-143.0.3650.96';
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';
const ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold';
const CRLFCRLF = '\r\n\r\n';
const AUDIO_DELIM = Buffer.from('Path:audio\r\n');
const TURN_END = 'Path:turn.end';
const MAX_TOTAL_MS = 25000;

// 诊断日志（写入 stderr，宿主自行决定是否采集）
const dbg = (...args) => process.stderr.write(`[edge-synth] ${args.join(' ')}\n`);

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function secMsGec() {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const data = new TextEncoder().encode(`${rounded * 10000000}${TOKEN}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function voiceLocale(voice) {
  const m = /\w{2}-\w{2}/.exec(voice);
  return m ? m[0] : 'zh-CN';
}

function escapeSsmlText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 合成一段语音。
 * @param {object} opts { voice, text, ratePct, pitchHz }
 * @returns {Promise<Buffer>} mp3 音频
 */
function synthEdgeAudio(opts) {
  const { voice, text, ratePct, pitchHz } = opts || {};
  dbg('start', voice, 'pid=' + process.pid);
  return new Promise(async (resolve, reject) => {
    const requestId = uuid();
    let sec;
    try {
      sec = await secMsGec();
    } catch (e) {
      return reject(new Error('Edge TTS 令牌生成失败: ' + String(e.message || e)));
    }
    const url = `${WSS}?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${sec}&Sec-MS-GEC-Version=${VERSION}&ConnectionId=${requestId}`;

    let ws;
    try {
      ws = new WebSocket(url, {
        headers: { 'User-Agent': UA, Origin: ORIGIN, Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      });
    } catch (e) {
      return reject(new Error('Edge TTS 连接创建失败: ' + String(e.message || e)));
    }

    const chunks = [];
    let turnEnded = false;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      dbg('timeout chunks=' + chunks.length + ' turnEnded=' + turnEnded);
      try { ws.close(); } catch (e) { /* 忽略 */ }
      reject(new Error('Edge TTS 合成超时'));
    }, MAX_TOTAL_MS);

    const fail = (msg) => {
      if (settled) return;
      settled = true;
      dbg('fail: ' + msg);
      clearTimeout(timer);
      try { ws.close(); } catch (e) { /* 忽略 */ }
      reject(new Error(msg));
    };

    ws.on('open', () => {
      dbg('ws open');
      const config =
        `X-RequestId:${requestId}\r\n` +
        'Content-Type:application/json; charset=utf-8\r\n' +
        `Path:speech.config${CRLFCRLF}` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        });
      ws.send(config, (err) => {
        if (err) return fail(`Edge TTS 连接失败: ${err.message}`);
        const ssml =
          `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voiceLocale(voice)}">` +
          `<voice name="${voice}"><prosody pitch="${pitchHz}" rate="${ratePct}" volume="100">` +
          `${escapeSsmlText(text)}</prosody></voice></speak>`;
        const request =
          `X-RequestId:${requestId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `Path:ssml${CRLFCRLF}` +
          ssml.trim();
        ws.send(request, (sendErr) => {
          if (sendErr) fail(`Edge TTS 发送失败: ${sendErr.message}`);
        });
      });
    });

    ws.on('message', (data) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
      if (buf.toString('utf8').includes(TURN_END)) {
        turnEnded = true;
        // 服务端偶发"拒绝合成"：直接回 turn.end 且不带任何音频块。
        // 此时继续等待只会耗到超时，立即快速失败以便上层重试。
        if (!settled && chunks.length === 0) return fail('Edge TTS 服务端未返回音频（可能临时限流），请重试')
      }
      const idx = buf.indexOf(AUDIO_DELIM);
      if (idx >= 0) {
        const audio = buf.subarray(idx + AUDIO_DELIM.length);
        if (audio.length > 0) chunks.push(audio);
      }
      // turn.end 在全部音频之后到达，出现即代表本段合成完成（服务端不主动断开）
      if (turnEnded && !settled && chunks.length > 0) {
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch (e) { /* 忽略 */ }
        resolve(Buffer.concat(chunks));
      }
    });

    ws.on('error', (e) => fail(`Edge TTS WebSocket 错误: ${e.message}`));
    ws.on('close', () => {
      if (settled) return;
      if (!turnEnded) return fail('Edge TTS 连接中断（未收到完整音频）');
      if (chunks.length === 0) return fail('Edge TTS 未返回音频数据');
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
  });
}

module.exports = { synthEdgeAudio, TOKEN, WSS };
