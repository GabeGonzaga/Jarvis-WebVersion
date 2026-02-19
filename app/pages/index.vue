<template>
  <div class="shell">
    <div class="hud">
      <header class="topbar">
        <div class="brand">
          <div class="logo" aria-hidden="true"></div>
          <div class="titles">
            <div class="title">JARVIS Mk2</div>
            <div class="subtitle">Local Assistant • Ollama</div>
          </div>
        </div>

        <div class="topbar-right">
          <button class="cam-toggle-btn" :class="{ active: showCamera }" @click="toggleCamera" title="Toggle Vision">
            <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
              <path d="M23 7l-7 5 7 5V7z" fill="currentColor"/>
              <rect x="1" y="5" width="15" height="14" rx="2" fill="currentColor" opacity="0.7"/>
            </svg>
            VISION
          </button>
          <div class="status">
            <span class="dot" :class="statusOnline ? 'ok' : 'bad'"></span>
            <span class="label">{{ statusOnline ? 'ONLINE' : 'OFFLINE' }}</span>
            <span class="pill">{{ statusOnline ? 'API' : 'NO LINK' }}</span>
          </div>
        </div>
      </header>

      <!-- Camera panel: click VISION to open/close -->
      <transition name="cam-slide">
        <div v-if="showCamera" class="camera-panel">
          <div class="camera-inner">
            <video ref="videoEl" class="camera-feed" autoplay playsinline muted />
            <canvas ref="canvasEl" class="landmark-canvas" />
            <transition name="gesture-pop">
              <div v-if="lastGesture" class="gesture-badge">
                <span class="gesture-icon">{{ gestureEmoji(lastGesture.name) }}</span>
                <span class="gesture-name">{{ lastGesture.name.replace(/_/g, ' ') }}</span>
                <span v-if="lastGesture.action" class="gesture-action">→ {{ lastGesture.action }}</span>
              </div>
            </transition>
          </div>
        </div>
      </transition>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">Conversation</div>
          <div class="panel-meta">
            <button v-for="b in quickButtons" :key="b.key" class="qbtn" type="button" @click="handleQuick(b)" :title="b.href || ''">
              <span class="qkey">{{ b.key }}</span>
              <span class="qname">{{ b.label }}</span>
            </button>
          </div>
        </div>

        <div class="messages" ref="messagesContainer">
          <!-- Confirmed messages -->
          <div v-for="msg in messages" :key="msg.id" class="msg" :class="[msg.sender, msg.via === 'voice' ? 'via-voice' : '']">
            <div class="frame">
              <div class="meta">
                <div class="who">
                  {{ msg.sender === 'user' ? 'YOU' : 'JARVIS' }}
                  <span v-if="msg.via === 'voice'" class="via-badge">
                    <svg viewBox="0 0 24 24" fill="none" width="10" height="10">
                      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
                      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    VOICE
                  </span>
                </div>
                <div class="time">{{ formatTime(msg.timestamp) }}</div>
              </div>
              <div class="body">{{ msg.text }}</div>
            </div>
          </div>

          <!-- Ghost bubble: live transcript while mic is open -->
          <transition name="ghost-fade">
            <div v-if="voiceState === 'listening' && liveTranscript" class="msg user">
              <div class="frame ghost-frame">
                <div class="meta">
                  <div class="who">YOU <span class="via-badge">LIVE</span></div>
                  <div class="time">now</div>
                </div>
                <div class="body">{{ liveTranscript }}<span class="cursor-blink">|</span></div>
              </div>
            </div>
          </transition>

          <!-- Pending bubble: editable + countdown -->
          <transition name="ghost-fade">
            <div v-if="voiceState === 'pending'" class="msg user">
              <div class="frame pending-frame">
                <div class="meta">
                  <div class="who">YOU <span class="via-badge">VOICE</span></div>
                  <div class="pending-actions">
                    <span class="countdown-text">{{ pendingCountdown }}s</span>
                    <button class="action-btn cancel" @click="cancelPending">✕ Cancel</button>
                    <button class="action-btn send-now" @click="sendPending">Send ↑</button>
                  </div>
                </div>
                <textarea
                  class="pending-edit"
                  v-model="pendingTranscript"
                  rows="2"
                  placeholder="Editing transcript…"
                  @keydown.enter.exact.prevent="sendPending"
                  @keydown.escape="cancelPending"
                  autofocus
                />
                <div class="pending-bar">
                  <div class="pending-progress" :style="{ width: `${(pendingCountdown / 20) * 100}%` }" />
                </div>
              </div>
            </div>
          </transition>

          <!-- Jarvis typing -->
          <div v-if="isTyping" class="msg jarvis">
            <div class="frame">
              <div class="meta"><div class="who">JARVIS</div><div class="time">…</div></div>
              <div class="typing"><span></span><span></span><span></span></div>
            </div>
          </div>
        </div>

        <footer class="composer">
          <div class="inputwrap">
            <span class="scan" aria-hidden="true"></span>
            <input
              v-model="inputMessage"
              @keyup.enter="handleSendMessage"
              placeholder="Ask Jarvis…"
              :disabled="isTyping || voiceState === 'processing'"
            />
          </div>

          <!-- Mic toggle button (click on / click off) -->
          <button
            class="voice-btn"
            :class="{ listening: voiceState === 'listening', pending: voiceState === 'pending', processing: voiceState === 'processing' }"
            :disabled="voiceState === 'processing'"
            @click="toggleMic"
            :title="micLabel"
          >
            <span class="vring vring-1" />
            <span class="vring vring-2" />
            <!-- Mic -->
            <svg v-if="voiceState === 'idle' || voiceState === 'listening'" class="v-ico" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
              <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <!-- X (pending = click to cancel) -->
            <svg v-else-if="voiceState === 'pending'" class="v-ico" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <!-- Spinner -->
            <svg v-else class="v-ico v-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="20 40"/>
            </svg>
            <!-- Wave bars while recording -->
            <div v-if="voiceState === 'listening'" class="wave-bars">
              <span v-for="i in 5" :key="i" :style="{ animationDelay: `${i * 80}ms` }" />
            </div>
          </button>

          <button class="send" @click="handleSendMessage" :disabled="!inputMessage.trim() || isTyping">
            <span class="send-ico" aria-hidden="true"></span>
            SEND
          </button>
        </footer>

        <!-- Voice status strip -->
        <transition name="strip-fade">
          <div v-if="voiceState !== 'idle'" class="voice-strip">
            <span class="strip-dot" :class="voiceState" />
            <span v-if="voiceState === 'listening'">Listening — click mic again to stop</span>
            <span v-else-if="voiceState === 'pending'">Review your message — edit or wait {{ pendingCountdown }}s to auto-send</span>
            <span v-else-if="voiceState === 'processing'">Processing…</span>
          </div>
        </transition>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useJarvis } from '~/composables/useJarvis'

// ── Types ──────────────────────────────────────────────────
interface Message {
  id: number; sender: 'user' | 'jarvis'; text: string; timestamp: Date; via?: 'voice' | 'text'
}
type QuickButton = { key: '1'|'2'|'3'|'4'|'5'; label: string; href?: string; action?: 'link'|'noop' }
type VoiceState = 'idle' | 'listening' | 'pending' | 'processing'

// ── Chat ───────────────────────────────────────────────────
const quickButtons = ref<QuickButton[]>([
  { key: '1', label: 'YOUTUBE',  href: 'https://youtube.com', action: 'link' },
  { key: '2', label: 'GITHUB',   href: 'https://github.com', action: 'link' },
  { key: '3', label: 'DOCS',     href: 'https://nuxt.com', action: 'link' },
  { key: '4', label: 'MOODLE',   href: 'https://moodle25.iscte-iul.pt/my/courses.php', action: 'link' },
  { key: '5', label: 'OKTA',     href: 'https://login.iscte-iul.pt/app/UserHome', action: 'link' },
])
const messages       = ref<Message[]>([{ id: 0, sender: 'jarvis', text: 'Good day, Sir. How may I assist you today?', timestamp: new Date() }])
const inputMessage   = ref('')
const isTyping       = ref(false)
const statusOnline   = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
let messageId = 1

// ── Voice ──────────────────────────────────────────────────
const voiceState       = ref<VoiceState>('idle')
const liveTranscript   = ref('')   // shown in ghost bubble while speaking
const pendingTranscript = ref('')  // editable in 20s window
const pendingCountdown  = ref(20)

const micLabel = computed(() => ({ idle:'Click to speak', listening:'Click to stop', pending:'Click to cancel', processing:'Processing…' }[voiceState.value]))

let voiceWs: WebSocket | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let audioCtx: AudioContext | null = null
let micStream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let vadInterval: number | null = null
let silenceStart: number | null = null
let countdownInterval: number | null = null

const SILENCE_THRESHOLD = 0.012  // RMS — tune lower if quiet mic
const SILENCE_MS        = 2000   // 2s silence → stop
const PENDING_SECONDS   = 20     // edit window

// ── Camera ─────────────────────────────────────────────────
const showCamera  = ref(false)
const videoEl     = ref<HTMLVideoElement | null>(null)
const canvasEl    = ref<HTMLCanvasElement | null>(null)
const lastGesture = ref<{ name: string; action?: string } | null>(null)
let visionWs: WebSocket | null = null
let cameraStream: MediaStream | null = null
let frameLoop: number | null = null
let gestureClearTimer: ReturnType<typeof setTimeout> | null = null

// ── Lifecycle ──────────────────────────────────────────────
onMounted(async () => {
  try { const { getStatus } = useJarvis(); await getStatus(); statusOnline.value = true }
  catch { statusOnline.value = false }
})
onUnmounted(() => {
  _cleanupMic()
  if (frameLoop) clearInterval(frameLoop)
  cameraStream?.getTracks().forEach(t => t.stop())
  voiceWs?.close(); visionWs?.close()
})

// ── Helpers ────────────────────────────────────────────────
const scrollBottom = async () => {
  await nextTick()
  if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}
const formatTime = (d: Date) => new Intl.DateTimeFormat('en-US', { hour:'2-digit', minute:'2-digit', hour12:false }).format(d)
const handleQuick = (b: QuickButton) => { if (b.action === 'link' && b.href) window.open(b.href, '_blank', 'noopener,noreferrer') }

// ── Text chat ──────────────────────────────────────────────
const handleSendMessage = async () => {
  if (!inputMessage.value.trim() || isTyping.value) return
  const t = inputMessage.value.trim(); inputMessage.value = ''
  await _sendToJarvis(t, 'text')
}
async function _sendToJarvis(text: string, via: 'text'|'voice') {
  messages.value.push({ id: messageId++, sender: 'user', text, timestamp: new Date(), via })
  isTyping.value = true; await scrollBottom()
  try {
    const { sendMessage } = useJarvis()
    const res = await sendMessage(text)
    messages.value.push({ id: messageId++, sender: 'jarvis', text: res.response, timestamp: new Date(res.timestamp), via })
  } catch {
    messages.value.push({ id: messageId++, sender: 'jarvis', text: 'Backend not connected. Start Django on :8000.', timestamp: new Date() })
  } finally { isTyping.value = false; await scrollBottom() }
}

// ── Voice WebSocket ────────────────────────────────────────
function _getVoiceWs(): WebSocket {
  if (voiceWs && voiceWs.readyState === WebSocket.OPEN) return voiceWs
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  voiceWs = new WebSocket(`${proto}://${location.host}/ws/voice/`)
  voiceWs.onmessage = ev => { try { _onVoiceMsg(JSON.parse(ev.data)) } catch {} }
  voiceWs.onclose = () => { voiceWs = null }
  return voiceWs
}
function _onVoiceMsg(msg: Record<string, unknown>) {
  if (msg.type === 'transcript' && msg.text)
    liveTranscript.value = msg.text as string           // partial/live update ghost bubble
  if (msg.type === 'transcript_ready' && msg.text)
    pendingTranscript.value = msg.text as string        // backend confirms full transcript
  if (msg.type === 'jarvis_reply') {
    messages.value.push({ id: messageId++, sender: 'jarvis', text: msg.text as string, timestamp: new Date(), via: 'voice' })
    voiceState.value = 'idle'; liveTranscript.value = ''; pendingTranscript.value = ''
    scrollBottom()
  }
}

// ── Mic toggle: click ON → click OFF ──────────────────────
async function toggleMic() {
  if (voiceState.value === 'listening')  { _stopRecording(); return }
  if (voiceState.value === 'pending')    { cancelPending(); return }
  if (voiceState.value === 'processing') return

  try {
    micStream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    audioCtx    = new AudioContext({ sampleRate: 16000 })
    const src   = audioCtx.createMediaStreamSource(micStream)
    analyser    = audioCtx.createAnalyser(); analyser.fftSize = 512
    src.connect(analyser)

    audioChunks   = []
    mediaRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' })
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.start(100)
    voiceState.value    = 'listening'
    liveTranscript.value = ''

    const ws = _getVoiceWs()
    const go = () => ws.send(JSON.stringify({ type: 'start_listening' }))
    ws.readyState === WebSocket.OPEN ? go() : (ws.onopen = go)

    _startVAD()
  } catch (e) { console.error('[Voice] Mic denied', e) }
}

// ── VAD: silence detection ─────────────────────────────────
function _startVAD() {
  if (!analyser) return
  const buf = new Float32Array(analyser.fftSize); silenceStart = null
  vadInterval = window.setInterval(() => {
    if (!analyser || voiceState.value !== 'listening') { clearInterval(vadInterval!); vadInterval = null; return }
    analyser.getFloatTimeDomainData(buf)
    const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length)
    if (rms < SILENCE_THRESHOLD) {
      if (silenceStart === null) silenceStart = Date.now()
      else if (Date.now() - silenceStart > SILENCE_MS) _stopRecording()
    } else { silenceStart = null }
  }, 80)
}

// ── Stop recording → enter 20s edit window ────────────────
function _stopRecording() {
  if (vadInterval !== null) { clearInterval(vadInterval); vadInterval = null }
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  mediaRecorder.stop()
  micStream?.getTracks().forEach(t => t.stop())
  mediaRecorder.onstop = async () => {
    if (audioChunks.length === 0) { voiceState.value = 'idle'; return }
    const blob = new Blob(audioChunks, { type: 'audio/webm' }); audioChunks = []
    try {
      const buf     = await blob.arrayBuffer()
      const decoded = await audioCtx!.decodeAudioData(buf)
      const pcm     = decoded.getChannelData(0)
      const bytes   = new Uint8Array(pcm.buffer)
      const ws      = _getVoiceWs(); const CHUNK = 32768
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const b64 = btoa(String.fromCharCode(...bytes.slice(i, i + CHUNK)))
        ws.send(JSON.stringify({ type: 'audio_chunk', data: b64 }))
      }
      ws.send(JSON.stringify({ type: 'transcribe_only' }))  // backend returns transcript_ready
      // Enter pending — prepopulate with whatever live transcript we had
      pendingTranscript.value = liveTranscript.value || ''
      voiceState.value = 'pending'
      _startCountdown(); scrollBottom()
    } catch (e) { console.error('[Voice] decode error', e); voiceState.value = 'idle' }
  }
}

// ── 20s countdown ─────────────────────────────────────────
function _startCountdown() {
  pendingCountdown.value = PENDING_SECONDS
  if (countdownInterval !== null) clearInterval(countdownInterval)
  countdownInterval = window.setInterval(() => {
    pendingCountdown.value--
    if (pendingCountdown.value <= 0) { clearInterval(countdownInterval!); countdownInterval = null; sendPending() }
  }, 1000)
}

function sendPending() {
  if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null }
  const text = pendingTranscript.value.trim()
  if (!text) { voiceState.value = 'idle'; return }
  voiceState.value = 'processing'
  // Show in chat immediately
  messages.value.push({ id: messageId++, sender: 'user', text, timestamp: new Date(), via: 'voice' })
  pendingTranscript.value = ''; liveTranscript.value = ''; scrollBottom()
  // Execute via WS + TTS
  _getVoiceWs().send(JSON.stringify({ type: 'execute_transcript', text }))
}

function cancelPending() {
  if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null }
  pendingTranscript.value = ''; liveTranscript.value = ''; voiceState.value = 'idle'
}

function _cleanupMic() {
  if (vadInterval !== null)       { clearInterval(vadInterval);       vadInterval = null }
  if (countdownInterval !== null) { clearInterval(countdownInterval); countdownInterval = null }
  micStream?.getTracks().forEach(t => t.stop()); micStream = null; mediaRecorder = null; analyser = null
}

// ── Camera: open / close ───────────────────────────────────
async function toggleCamera() {
  if (showCamera.value) {
    showCamera.value = false
    if (frameLoop !== null) { clearInterval(frameLoop); frameLoop = null }
    cameraStream?.getTracks().forEach(t => t.stop()); cameraStream = null
    if (videoEl.value)  videoEl.value.srcObject = null
    if (canvasEl.value) canvasEl.value.getContext('2d')?.clearRect(0, 0, 9999, 9999)
    visionWs?.send(JSON.stringify({ type: 'stop_tracking' }))
  } else {
    showCamera.value = true; await nextTick()
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      if (videoEl.value) { videoEl.value.srcObject = cameraStream; await videoEl.value.play() }
      const ws = _getVisionWs()
      const go = () => ws.send(JSON.stringify({ type: 'start_tracking' }))
      ws.readyState === WebSocket.OPEN ? go() : (ws.onopen = go)
      frameLoop = window.setInterval(_captureAndSend, 67)
    } catch (e) { console.error('[Camera] denied', e); showCamera.value = false }
  }
}

function _getVisionWs(): WebSocket {
  if (visionWs && visionWs.readyState === WebSocket.OPEN) return visionWs
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  visionWs = new WebSocket(`${proto}://${location.host}/ws/vision/`)
  visionWs.onmessage = ev => { try { _onVisionMsg(JSON.parse(ev.data)) } catch {} }
  visionWs.onclose = () => { visionWs = null }
  return visionWs
}
function _onVisionMsg(msg: Record<string, unknown>) {
  if (msg.type === 'landmarks') _drawLandmarks((msg.hands as any[]) || [])
  if (msg.type === 'gesture') lastGesture.value = { name: msg.name as string }
  if (msg.type === 'action_triggered') {
    if (lastGesture.value) lastGesture.value = { ...lastGesture.value, action: msg.action as string }
    if (gestureClearTimer) clearTimeout(gestureClearTimer)
    gestureClearTimer = setTimeout(() => { lastGesture.value = null }, 2000)
  }
}

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]

function _drawLandmarks(hands: { landmarks: { x: number; y: number; z: number }[] }[]) {
  const canvas = canvasEl.value; const video = videoEl.value; if (!canvas || !video) return
  const ctx = canvas.getContext('2d'); if (!ctx) return
  canvas.width = video.videoWidth || 320; canvas.height = video.videoHeight || 240
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const hand of hands) {
    const pts = hand.landmarks; const W = canvas.width; const H = canvas.height
    ctx.strokeStyle = 'rgba(0,212,255,0.7)'; ctx.lineWidth = 1.5
    for (const [a, b] of HAND_CONNECTIONS) { ctx.beginPath(); ctx.moveTo(pts[a].x*W, pts[a].y*H); ctx.lineTo(pts[b].x*W, pts[b].y*H); ctx.stroke() }
    for (let i = 0; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i].x*W, pts[i].y*H, i===0?5:3, 0, Math.PI*2); ctx.fillStyle = i===0?'#00d4ff':'rgba(0,212,255,0.85)'; ctx.fill() }
  }
}
function _captureAndSend() {
  const video = videoEl.value
  if (!video || !visionWs || visionWs.readyState !== WebSocket.OPEN || video.readyState < 2) return
  const tmp = document.createElement('canvas'); tmp.width = 320; tmp.height = 240
  tmp.getContext('2d')!.drawImage(video, 0, 0, 320, 240)
  visionWs.send(JSON.stringify({ type: 'frame', data: tmp.toDataURL('image/jpeg', 0.7).split(',')[1], width: 320, height: 240 }))
}
function gestureEmoji(name: string): string {
  return ({ fist:'✊',open_hand:'🖐',point_up:'☝️',peace:'✌️',ok:'👌',pinch:'🤏',thumbs_up:'👍',swipe_left:'👈',swipe_right:'👉',swipe_up:'👆',swipe_down:'👇' } as Record<string,string>)[name] || '🤚'
}
</script>

<style scoped>
.shell {
  min-height: 100vh;
  background: radial-gradient(900px 500px at 20% 10%,rgba(0,217,255,0.18),transparent 60%), radial-gradient(800px 450px at 85% 20%,rgba(0,120,255,0.16),transparent 60%), radial-gradient(700px 400px at 50% 90%,rgba(0,255,170,0.08),transparent 60%), linear-gradient(180deg,#050814 0%,#070b1b 40%,#050814 100%);
  color: rgba(235,245,255,0.92); position: relative; overflow: hidden;
}
.shell::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(rgba(0,217,255,0.10) 1px,transparent 1px), linear-gradient(90deg,rgba(0,217,255,0.10) 1px,transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(circle at 50% 40%,rgba(0,0,0,1) 0%,rgba(0,0,0,0.15) 55%,rgba(0,0,0,0) 80%);
  pointer-events: none;
}
.hud { position: relative; max-width: 1200px; margin: 0 auto; padding: 24px 18px; }

.topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 16px; border: 1px solid rgba(0,217,255,0.25); background: rgba(7,14,36,0.65); backdrop-filter: blur(10px); box-shadow: 0 0 0 1px rgba(0,217,255,0.08) inset, 0 18px 55px rgba(0,0,0,0.35); border-radius: 14px; }
.topbar-right { display: flex; align-items: center; gap: 14px; }
.brand { display: flex; align-items: center; gap: 12px; }
.logo { width: 38px; height: 38px; border-radius: 10px; border: 1px solid rgba(0,217,255,0.35); background: radial-gradient(circle at 30% 30%,rgba(0,217,255,0.8),rgba(0,217,255,0.05) 60%), linear-gradient(135deg,rgba(0,217,255,0.15),rgba(0,140,255,0.05)); box-shadow: 0 0 22px rgba(0,217,255,0.25); }
.titles .title { font-weight: 800; letter-spacing: 0.08em; color: rgba(150,240,255,0.95); text-transform: uppercase; font-size: 16px; }
.titles .subtitle { font-size: 13px; letter-spacing: 0.12em; opacity: 0.75; text-transform: uppercase; }
.status { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: 0.12em; }
.dot { width: 10px; height: 10px; border-radius: 999px; background: rgba(255,80,80,0.9); box-shadow: 0 0 14px rgba(255,80,80,0.35); }
.dot.ok { background: rgba(0,255,170,0.95); box-shadow: 0 0 16px rgba(0,255,170,0.35); }
.label { font-size: 12px; opacity: 0.9; }
.pill { font-size: 11px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(0,217,255,0.25); background: rgba(0,217,255,0.08); }
.cam-toggle-btn { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(0,217,255,0.22); background: rgba(0,217,255,0.06); color: rgba(0,212,255,0.6); font-size: 11px; font-weight: 800; letter-spacing: 0.1em; cursor: pointer; transition: all 0.2s; }
.cam-toggle-btn:hover { background: rgba(0,217,255,0.12); color: #00d4ff; }
.cam-toggle-btn.active { background: rgba(0,217,255,0.14); border-color: rgba(0,212,255,0.5); color: #00d4ff; box-shadow: 0 0 14px rgba(0,212,255,0.15); }

.camera-panel { margin-top: 12px; border-radius: 14px; border: 1px solid rgba(0,217,255,0.22); background: rgba(6,12,30,0.75); backdrop-filter: blur(10px); padding: 12px; overflow: hidden; }
.camera-inner { position: relative; width: 320px; height: 240px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(0,217,255,0.18); }
.camera-feed { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.landmark-canvas { position: absolute; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none; }
.gesture-badge { position: absolute; top: 8px; left: 8px; background: rgba(0,8,14,0.88); border: 1px solid rgba(0,212,255,0.4); border-radius: 7px; padding: 5px 10px; display: flex; align-items: center; gap: 7px; backdrop-filter: blur(6px); }
.gesture-icon { font-size: 16px; }
.gesture-name { font-size: 11px; font-weight: 700; color: #00d4ff; text-transform: capitalize; }
.gesture-action { font-size: 10px; color: rgba(255,255,255,0.4); }
.cam-slide-enter-active, .cam-slide-leave-active { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); overflow: hidden; }
.cam-slide-enter-from, .cam-slide-leave-to { opacity: 0; transform: translateY(-8px); max-height: 0; padding: 0; }
.cam-slide-enter-to, .cam-slide-leave-from { opacity: 1; transform: translateY(0); max-height: 400px; }
.gesture-pop-enter-active { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
.gesture-pop-leave-active { transition: all 0.15s ease; }
.gesture-pop-enter-from { opacity: 0; transform: scale(0.8); }
.gesture-pop-leave-to { opacity: 0; }

.panel { margin-top: 16px; border-radius: 18px; border: 1px solid rgba(0,217,255,0.22); background: rgba(6,12,30,0.62); backdrop-filter: blur(10px); box-shadow: 0 0 0 1px rgba(0,217,255,0.06) inset, 0 18px 60px rgba(0,0,0,0.38); overflow: hidden; }
.panel-head { padding: 14px 16px; display: flex; justify-content: space-between; gap: 12px; align-items: baseline; border-bottom: 1px solid rgba(0,217,255,0.14); background: linear-gradient(180deg,rgba(0,217,255,0.06),transparent); }
.panel-title { font-weight: 800; letter-spacing: 0.10em; text-transform: uppercase; color: rgba(170,245,255,0.95); }
.panel-meta { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.qbtn { display: inline-flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 999px; border: 1px solid rgba(0,217,255,0.22); background: rgba(0,217,255,0.06); color: rgba(200,250,255,0.92); cursor: pointer; transition: transform 0.12s,box-shadow 0.12s,background 0.12s; user-select: none; }
.qbtn:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(0,217,255,0.12); background: rgba(0,217,255,0.10); }
.qkey { width: 18px; height: 18px; display: inline-grid; place-items: center; border-radius: 6px; border: 1px solid rgba(0,217,255,0.35); background: rgba(0,217,255,0.08); font-size: 11px; font-weight: 900; }
.qname { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; }

.messages { height: calc(100vh - 260px); overflow-y: auto; padding: 18px 16px 10px; display: flex; flex-direction: column; gap: 14px; }
.messages::-webkit-scrollbar { width: 10px; }
.messages::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
.messages::-webkit-scrollbar-thumb { background: rgba(0,217,255,0.18); border: 1px solid rgba(0,217,255,0.22); border-radius: 999px; }

.msg { display: flex; }
.msg.user { justify-content: flex-end; }
.msg.jarvis { justify-content: flex-start; }
.frame { width: min(760px,92%); border-radius: 16px; padding: 12px 14px; border: 1px solid rgba(0,217,255,0.18); background: rgba(8,16,40,0.65); box-shadow: 0 0 0 1px rgba(0,217,255,0.05) inset, 0 10px 28px rgba(0,0,0,0.25); }
.msg.user .frame { border-color: rgba(0,217,255,0.26); background: linear-gradient(135deg,rgba(0,217,255,0.24),rgba(0,140,255,0.10)); }
.msg.via-voice.jarvis .frame { border-color: rgba(0,217,255,0.32); box-shadow: 0 0 0 1px rgba(0,217,255,0.08) inset, 0 10px 28px rgba(0,0,0,0.25), 0 0 20px rgba(0,212,255,0.06); }

.meta { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
.who { color: rgba(170,245,255,0.95); display: flex; align-items: center; gap: 6px; }
.time { opacity: 0.75; }
.via-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 4px; background: rgba(0,212,255,0.12); border: 1px solid rgba(0,212,255,0.25); color: rgba(0,212,255,0.8); font-size: 9px; letter-spacing: 0.08em; }
.body { font-size: 16px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }

/* Ghost bubble */
.ghost-frame { border-color: rgba(0,212,255,0.15) !important; background: rgba(0,212,255,0.05) !important; opacity: 0.72; }
.cursor-blink { color: #00d4ff; animation: cur 1s step-end infinite; margin-left: 1px; }
@keyframes cur { 50% { opacity: 0; } }

/* Pending bubble */
.pending-frame { border-color: rgba(0,212,255,0.4) !important; background: rgba(0,18,30,0.88) !important; box-shadow: 0 0 24px rgba(0,212,255,0.08) !important; }
.pending-actions { display: flex; align-items: center; gap: 8px; }
.countdown-text { color: rgba(0,212,255,0.5); font-size: 11px; min-width: 28px; }
.action-btn { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; cursor: pointer; border: 1px solid; transition: all 0.15s; }
.action-btn.cancel { border-color: rgba(255,80,80,0.4); background: rgba(255,80,80,0.08); color: rgba(255,100,100,0.8); }
.action-btn.cancel:hover { background: rgba(255,80,80,0.18); }
.action-btn.send-now { border-color: rgba(0,212,255,0.4); background: rgba(0,212,255,0.1); color: #00d4ff; }
.action-btn.send-now:hover { background: rgba(0,212,255,0.2); }
.pending-edit { width: 100%; margin-top: 8px; background: rgba(0,212,255,0.04); border: 1px solid rgba(0,212,255,0.18); border-radius: 8px; color: rgba(235,245,255,0.92); font-size: 15px; line-height: 1.5; padding: 8px 10px; resize: none; outline: none; font-family: inherit; }
.pending-edit:focus { border-color: rgba(0,212,255,0.45); box-shadow: 0 0 10px rgba(0,212,255,0.06); }
.pending-bar { height: 2px; background: rgba(0,212,255,0.1); border-radius: 1px; margin-top: 8px; overflow: hidden; }
.pending-progress { height: 100%; background: rgba(0,212,255,0.45); transition: width 1s linear; border-radius: 1px; }

.ghost-fade-enter-active, .ghost-fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.ghost-fade-enter-from, .ghost-fade-leave-to { opacity: 0; transform: translateY(6px); }

.typing { display: flex; gap: 8px; padding: 6px 0 2px; }
.typing span { width: 8px; height: 8px; border-radius: 999px; background: rgba(0,217,255,0.9); box-shadow: 0 0 14px rgba(0,217,255,0.25); animation: pulse 1.2s infinite ease-in-out; }
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes pulse { 0%,80%,100% { transform: scale(0.6); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }

.composer { display: flex; gap: 10px; padding: 14px 16px; align-items: center; border-top: 1px solid rgba(0,217,255,0.14); background: linear-gradient(180deg,transparent,rgba(0,217,255,0.05)); }
.inputwrap { flex: 1; position: relative; border-radius: 14px; border: 1px solid rgba(0,217,255,0.22); background: rgba(6,12,30,0.65); box-shadow: 0 0 0 1px rgba(0,217,255,0.05) inset; }
.scan { position: absolute; inset: 0; border-radius: 14px; pointer-events: none; background: linear-gradient(90deg,transparent,rgba(0,217,255,0.10),transparent); transform: translateX(-100%); animation: scan 3.2s linear infinite; opacity: 0.55; }
@keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
.inputwrap input { width: 100%; padding: 14px; background: transparent; border: none; outline: none; color: rgba(235,245,255,0.92); font-size: 16px; }
.inputwrap input::placeholder { color: rgba(155,185,210,0.65); letter-spacing: 0.02em; }

.voice-btn { position: relative; width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; border: 1.5px solid rgba(0,212,255,0.3); background: rgba(0,16,26,0.8); color: rgba(0,212,255,0.7); cursor: pointer; display: grid; place-items: center; transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
.voice-btn:hover:not(:disabled) { border-color: rgba(0,212,255,0.7); color: #00d4ff; box-shadow: 0 0 20px rgba(0,212,255,0.15); transform: scale(1.05); }
.voice-btn.listening { border-color: #00d4ff; color: #00d4ff; background: rgba(0,30,46,0.9); box-shadow: 0 0 30px rgba(0,212,255,0.3); transform: scale(1.1); }
.voice-btn.pending { border-color: rgba(255,160,60,0.7); color: rgba(255,160,60,0.9); background: rgba(30,16,0,0.9); box-shadow: 0 0 20px rgba(255,160,60,0.12); }
.voice-btn.processing { border-color: rgba(0,212,255,0.35); color: rgba(0,212,255,0.45); cursor: not-allowed; }
.voice-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.v-ico { width: 20px; height: 20px; }
.v-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.vring { position: absolute; border-radius: 50%; border: 1px solid rgba(0,212,255,0.25); pointer-events: none; opacity: 0; }
.vring-1 { inset: -8px; }
.vring-2 { inset: -16px; }
.listening .vring-1 { animation: vring 1.2s ease-out infinite; }
.listening .vring-2 { animation: vring 1.2s ease-out 0.3s infinite; }
@keyframes vring { 0% { opacity: 0.7; transform: scale(0.95); } 100% { opacity: 0; transform: scale(1.1); } }
.wave-bars { position: absolute; bottom: -22px; display: flex; gap: 2px; align-items: flex-end; }
.wave-bars span { display: block; width: 3px; height: 10px; background: #00d4ff; border-radius: 2px; animation: wavebar 0.5s ease-in-out infinite alternate; }
@keyframes wavebar { from { height: 3px; opacity: 0.4; } to { height: 14px; opacity: 1; } }

.voice-strip { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-top: 1px solid rgba(0,212,255,0.1); background: rgba(0,212,255,0.04); font-size: 12px; color: rgba(0,212,255,0.7); letter-spacing: 0.06em; }
.strip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: rgba(0,212,255,0.3); }
.strip-dot.listening { background: #00d4ff; box-shadow: 0 0 8px #00d4ff; animation: blink 0.8s infinite; }
.strip-dot.pending { background: rgba(255,160,60,0.8); box-shadow: 0 0 8px rgba(255,160,60,0.5); }
.strip-dot.processing { background: rgba(0,212,255,0.5); animation: blink 1.4s infinite; }
@keyframes blink { 50% { opacity: 0.2; } }
.strip-fade-enter-active, .strip-fade-leave-active { transition: all 0.25s ease; }
.strip-fade-enter-from, .strip-fade-leave-to { opacity: 0; transform: translateY(4px); }

.send { width: 110px; flex-shrink: 0; height: 52px; border-radius: 14px; border: 1px solid rgba(0,217,255,0.35); background: linear-gradient(135deg,rgba(0,217,255,0.25),rgba(0,140,255,0.10)); color: rgba(200,250,255,0.95); font-weight: 900; letter-spacing: 0.16em; cursor: pointer; transition: transform 0.12s,box-shadow 0.12s,opacity 0.12s; }
.send:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,217,255,0.18); }
.send:disabled { opacity: 0.45; cursor: not-allowed; }
.send-ico { display: inline-block; width: 10px; height: 10px; margin-right: 10px; border-radius: 2px; border: 1px solid rgba(0,217,255,0.55); box-shadow: 0 0 12px rgba(0,217,255,0.22); }
</style>