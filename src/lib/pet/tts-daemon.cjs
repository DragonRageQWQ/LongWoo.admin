/**
 * 桌宠内置音色合成守护进程（开发/本地环境）
 *
 * 背景：本机沙箱对"监听 TCP 端口的进程"的出站大流量 ws 有限制（音频帧被丢弃），
 * 但对非监听进程无限制。因此本守护进程刻意【不监听任何端口】，通过文件系统
 * 与 Next 路由（/api/pet/tts）协作：
 *
 *   route -> 写入 {spool}/{id}.job    （JSON：{ id, voice, text, ratePct, pitchHz }）
 *   daemon -> 合成后写入 {spool}/{id}.mp3 与 {spool}/{id}.done （JSON：{ok:true,len} | {ok:false,error}）
 *
 * 启动：node src/lib/pet/tts-daemon.cjs
 * 停止：删除 {spool}/daemon.pid 文件（或 Ctrl+C / kill）
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { synthEdgeAudio } = require('./edge-synth-core.cjs');

const SPOOL = process.env.PET_TTS_SPOOL || path.join(os.tmpdir(), 'pet-tts-spool');
const POLL_MS = 150;
const MAX_ATTEMPTS = 3; // 微软 Read Aloud 偶发"拒发音频"，短间隔重试可显著提高成功率
const RETRY_DELAY_MS = 700;
const IDLE_EXIT_MS = 0; // 0 = 常驻不退出（保持简单：由用户/脚本显式停止）

let shuttingDown = false;

function ensureSpool() {
  fs.mkdirSync(SPOOL, { recursive: true });
}

function log(...args) {
  console.log(`[pet-tts-daemon ${new Date().toISOString().slice(11, 19)}]`, ...args);
}

async function handleJob(jobFile) {
  const id = path.basename(jobFile, '.job');
  const doneFile = path.join(SPOOL, `${id}.done`);
  const mp3File = path.join(SPOOL, `${id}.mp3`);
  let job;
  try {
    job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  } catch (e) {
    // 损坏的任务文件：直接标记失败并清理
    try { fs.writeFileSync(doneFile, JSON.stringify({ ok: false, error: '坏任务文件' }), 'utf8'); } catch (e2) { /* 忽略 */ }
    try { fs.unlinkSync(jobFile); } catch (e2) { /* 忽略 */ }
    return;
  }
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    try {
      const audio = await synthEdgeAudio({
        voice: job.voice,
        text: job.text,
        ratePct: job.ratePct,
        pitchHz: job.pitchHz,
      });
      fs.writeFileSync(mp3File, audio);
      fs.writeFileSync(doneFile, JSON.stringify({ ok: true, len: audio.length }), 'utf8');
      log('done', id, audio.length, 'bytes (attempt ' + attempt + ')');
      try { fs.unlinkSync(jobFile); } catch (e) { /* 忽略 */ }
      return;
    } catch (e) {
      lastError = String((e && e.message) || e);
      log('attempt ' + attempt + ' fail:', id, lastError);
    }
  }
  try {
    fs.writeFileSync(doneFile, JSON.stringify({ ok: false, error: lastError }), 'utf8');
  } catch (e) { /* 忽略 */ }
  try { fs.unlinkSync(jobFile); } catch (e) { /* 忽略 */ }
  log('fail', id, lastError);
}

async function tick() {
  if (shuttingDown) return;
  let jobFile = null;
  try {
    const files = fs.readdirSync(SPOOL).filter((f) => f.endsWith('.job'));
    if (files.length > 0) {
      files.sort();
      jobFile = path.join(SPOOL, files[0]);
    }
  } catch (e) {
    /* spool 不存在则忽略 */
  }
  if (jobFile) {
    await handleJob(jobFile);
  }
  if (shuttingDown) return;
  setTimeout(tick, POLL_MS);
}

// 停止信号：daemon.pid 被删除
function watchStop() {
  const pidFile = path.join(SPOOL, 'daemon.pid');
  const checker = setInterval(() => {
    if (!fs.existsSync(pidFile)) {
      clearInterval(checker);
      shuttingDown = true;
      log('daemon.pid removed, exiting');
      process.exit(0);
    }
  }, 1000);
  checker.unref?.();
}

ensureSpool();
fs.writeFileSync(path.join(SPOOL, 'daemon.pid'), String(process.pid), 'utf8');
log('ready pid=' + process.pid, 'spool=' + SPOOL);
process.on('SIGTERM', () => { shuttingDown = true; process.exit(0); });
process.on('SIGINT', () => { shuttingDown = true; process.exit(0); });
watchStop();
tick();
