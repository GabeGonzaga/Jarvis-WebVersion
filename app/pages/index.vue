<template>
  <div>
    <div class="backdrop" />

    <div class="app" :class="{ collapsed, 'vision-open': showCamera }">
      <!-- ============ SIDEBAR ============ -->
      <aside class="sidebar">
        <div class="collapse-btn" title="Collapse" @click="collapsed = !collapsed">‹</div>

        <div class="brand">
          <div class="mini-reactor" />
          <div class="txt">
            <div class="nm">JARVIS <b>Mk2</b></div>
            <div class="sb">Local · Ollama</div>
          </div>
        </div>

        <div class="new-btn" @click="newSession"><span class="plus">+</span><span>New session</span></div>

        <div class="side-label">Sessions · max 3</div>
        <div class="sessions">
          <div
            v-for="(s, i) in sessions"
            :key="s.id"
            class="session"
            :class="{ active: s.active }"
            @click="selectSession(i)"
          >
            <span class="st">{{ s.title }}</span>
            <span class="sm">{{ s.time }}</span>
          </div>
        </div>

        <div class="side-foot">
          <div class="seg">
            <button v-for="m in themeModes" :key="m.v" :class="{ on: themeMode === m.v }" @click="themeMode = m.v">{{ m.label }}</button>
          </div>
          <div class="toggle-row" :class="{ on: showCamera }" @click="toggleCamera">
            <span class="tl">◨ Vision</span><span class="switch" />
          </div>
          <div class="status-line" :class="{ online: statusOnline }">
            <span class="d" /><span class="lt">{{ statusOnline ? 'ONLINE' : 'OFFLINE' }}</span><span class="model">{{ modelName }}</span>
          </div>
        </div>
      </aside>

      <!-- ============ STAGE ============ -->
      <main class="stage" :class="hasChat ? 'active' : 'rest'">
        <div class="reactor-zone">
          <div class="reactor" :class="{ listening: voiceState === 'listening' }">
            <div class="halo" /><div class="rng r1" /><div class="rng r2" /><div class="rng r3" /><div class="arc" />
            <div class="core"><span class="word">JARVIS</span></div>
          </div>
          <div class="hero-hint">
            <div class="big">Good day, Sir.</div>
            <div class="small">Ask me anything — or open a panel below</div>
          </div>
        </div>

        <div ref="streamEl" class="stream">
          <div v-for="msg in messages" :key="msg.id" class="msg" :class="msg.sender">
            <div class="bubble">
              <div class="who">
                <span v-if="msg.via === 'voice'" class="via">Voice</span>
                <span class="nm">{{ msg.sender === 'user' ? 'You' : 'Jarvis' }}</span>
                <span class="tm">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <div class="tx">{{ msg.text }}</div>
            </div>
          </div>
          <div v-if="isTyping" class="msg jarvis">
            <div class="bubble">
              <div class="who"><span class="nm">Jarvis</span><span class="tm">…</span></div>
              <div class="typing"><span /><span /><span /></div>
            </div>
          </div>
        </div>

        <div class="composer-wrap">
          <div class="composer">
            <div class="field" :class="{ listening: voiceState === 'listening' }">
              <input
                v-model="input"
                placeholder="Ask Jarvis…  (try: “open whales on pinterest”)"
                :disabled="isTyping || voiceState === 'processing'"
                @keyup.enter="handleSend"
              >
            </div>
            <button
              class="mic"
              :class="{ listening: voiceState === 'listening', processing: voiceState === 'processing' }"
              :disabled="voiceState === 'processing'"
              :title="micLabel"
              @click="toggleMic"
            >
              <span class="ripple r1" /><span class="ripple r2" />
              <svg v-if="voiceState !== 'processing'" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="20 40" /></svg>
            </button>
            <button class="send" :disabled="!input.trim() || isTyping" @click="handleSend">SEND</button>
          </div>

          <div class="dock">
            <button class="on" title="Chat">
              <svg viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z" stroke="currentColor" stroke-width="1.8" /></svg>
            </button>
            <button :class="{ on: launcherOpen }" title="Open a panel / link" @click.stop="launcherOpen = !launcherOpen">
              <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8" /></svg>
            </button>
            <button :class="{ on: showCamera }" title="Vision" @click="toggleCamera">
              <svg viewBox="0 0 24 24" fill="none"><path d="M23 7l-7 5 7 5V7z" fill="currentColor" /><rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="1.8" /></svg>
            </button>
            <button title="Voice" @click="toggleMic">
              <svg viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="1.8" /><path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
            </button>
          </div>

          <div v-if="voiceState !== 'idle'" class="voice-strip">
            <span class="d" />
            <span v-if="voiceState === 'listening'">Listening — click the mic again to stop</span>
            <span v-else>Processing…</span>
          </div>
        </div>
      </main>

      <!-- ============ VISION ============ -->
      <aside class="vision">
        <div class="vhead"><span class="t">Vision · Hands</span><span class="s">{{ showCamera ? 'TRACKING' : 'OFF' }}</span></div>
        <div class="vfeed">
          <video ref="videoEl" autoplay playsinline muted />
          <canvas ref="canvasEl" />
          <div v-if="showCamera" class="sl" />
          <div v-if="lastGesture" class="gbadge">
            <span class="em">{{ gestureEmoji(lastGesture.name) }}</span>
            <span class="gn">{{ lastGesture.name.replace(/_/g, ' ') }}</span>
          </div>
        </div>
        <div class="vcard">
          <div class="ct">System</div>
          <div class="vrow"><span class="k">GPU</span><span class="v">{{ gpu }}%</span></div>
          <div class="vbar"><i :style="{ width: gpu + '%' }" /></div>
          <div class="vrow" style="margin-top:9px"><span class="k">Latency</span><span class="v">{{ latency }} ms</span></div>
          <div class="vrow"><span class="k">Tokens/s</span><span class="v">{{ tps }}</span></div>
        </div>
      </aside>
    </div>

    <!-- ============ WINDOWS ============ -->
    <AppWindow
      v-for="w in windows"
      :key="w.id"
      :win="w"
      :focused="topWin?.id === w.id"
      @close="closeWindow"
      @minimise="minimise"
      @focus="bringFront"
    />

    <WindowLauncher :open="launcherOpen" @close="launcherOpen = false" @toast="showToast" />

    <div class="taskbar">
      <div v-for="w in minimised" :key="w.id" class="taskpill" @click="restore(w.id)">
        <span>{{ iconFor(w.type) }}</span> {{ w.title }}
      </div>
    </div>

    <div class="corner-orb" :class="{ listening: voiceState === 'listening' }" title="JARVIS — click to speak" @click="toggleMic">
      <span class="w">JARVIS</span>
    </div>

    <div class="toast" :class="{ show: toast.show }">{{ toast.msg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useJarvis } from '~/composables/useJarvis'
import { useWindows, parseIntent, buildUrl, type JWindow, type WindowType } from '~/composables/useWindows'

interface Message { id: number; sender: 'user' | 'jarvis'; text: string; timestamp: Date; via?: 'voice' | 'text' }
type VoiceState = 'idle' | 'listening' | 'processing'

// ── Theme + language ───────────────────────────────────────
const themeMode = useState<'system' | 'dark' | 'light'>('ui_theme_mode', () => 'system')
const language = useState<string>('ui_language', () => 'en-GB')
const themeModes = [
  { v: 'system' as const, label: 'SYS' },
  { v: 'dark' as const, label: 'DARK' },
  { v: 'light' as const, label: 'LIGHT' }
]

// ── Windows ────────────────────────────────────────────────
const { windows, openWindow, closeWindow, minimise, restore, bringFront } = useWindows()
const topWin = computed<JWindow | null>(() => windows.value.length ? windows.value.reduce((a, b) => (a.z >= b.z ? a : b)) : null)
const minimised = computed(() => windows.value.filter(w => w.min))
const ICONS: Record<string, string> = { pinterest: '📌', youtube: '▶️', music: '🎵', notes: '📝', google: '🔎' }
const iconFor = (t: string) => ICONS[t] || '🌐'

// ── Layout state ───────────────────────────────────────────
const collapsed = ref(false)
const launcherOpen = ref(false)
const toast = ref({ show: false, msg: '' })
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = { show: true, msg }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, 3600)
}

// ── Sessions (max 3) ───────────────────────────────────────
let sessionId = 3
const sessions = ref([
  { id: 1, title: 'Morning brief', time: 'just now', active: true },
  { id: 2, title: 'Schedule tomorrow', time: '2h ago', active: false },
  { id: 3, title: 'Refactor vision WS', time: 'Yesterday', active: false }
])
function selectSession(i: number) { sessions.value.forEach((s, k) => (s.active = k === i)) }
function newSession() {
  messages.value = []
  sessions.value.forEach(s => (s.active = false))
  sessions.value.unshift({ id: ++sessionId, title: 'New session', time: 'now', active: true })
  sessions.value = sessions.value.slice(0, 3)
}

// ── Chat ───────────────────────────────────────────────────
const messages = ref<Message[]>([])
const input = ref('')
const isTyping = ref(false)
const statusOnline = ref(false)
const modelName = ref('llama3:8b')
const streamEl = ref<HTMLElement | null>(null)
let messageId = 1
const hasChat = computed(() => messages.value.length > 0 || isTyping.value)

const scrollBottom = async () => { await nextTick(); if (streamEl.value) streamEl.value.scrollTop = streamEl.value.scrollHeight }
const formatTime = (d: Date) => new Intl.DateTimeFormat(language.value || 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function addMsg(sender: 'user' | 'jarvis', text: string, via: 'voice' | 'text') {
  messages.value.push({ id: messageId++, sender, text, timestamp: new Date(), via })
  scrollBottom()
}

/** Open a window locally when the text is an "open/search" command. Returns true if handled. */
function handleIntent(text: string, via: 'voice' | 'text'): boolean {
  const it = parseIntent(text)
  if (!it) return false
  openWindow({ type: it.type as WindowType, title: cap(it.query) || 'Window', query: it.query, url: buildUrl(it.type, it.query) })
  addMsg('jarvis', `Opening “${it.query}”${it.site ? ` on ${it.site}` : ''}, Sir.`, via)
  return true
}

async function handleSend() {
  const t = input.value.trim()
  if (!t || isTyping.value) return
  input.value = ''
  addMsg('user', t, 'text')
  if (handleIntent(t, 'text')) return
  await askJarvis(t, 'text')
}

async function askJarvis(text: string, via: 'voice' | 'text') {
  isTyping.value = true
  await scrollBottom()
  try {
    const { sendMessage } = useJarvis()
    const res = await sendMessage(text)
    addMsg('jarvis', res.response, via)
  } catch {
    addMsg('jarvis', 'Backend not connected.', via)
  } finally {
    isTyping.value = false
  }
}

// ── Voice (WebSocket → backend STT/TTS) ────────────────────
const voiceState = ref<VoiceState>('idle')
const micLabel = computed(() => ({ idle: 'Click to speak', listening: 'Click to stop', processing: 'Processing…' }[voiceState.value]))

const WS_BASE = import.meta.client
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
  : 'ws://localhost:3000'

let voiceWs: WebSocket | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let audioCtx: AudioContext | null = null
let micStream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let vadInterval: number | null = null
let silenceStart: number | null = null

function getVoiceWs(): WebSocket {
  if (voiceWs && voiceWs.readyState === WebSocket.OPEN) return voiceWs
  voiceWs = new WebSocket(`${WS_BASE}/ws/voice/`)
  voiceWs.onmessage = (ev) => { try { onVoiceMsg(JSON.parse(ev.data)) } catch { /* ignore */ } }
  voiceWs.onclose = () => { voiceWs = null }
  return voiceWs
}

function onVoiceMsg(msg: Record<string, unknown>) {
  if (msg.type === 'transcript_ready') {
    const text = ((msg.text as string) || '').trim()
    if (!text) { voiceState.value = 'idle'; return }
    addMsg('user', text, 'voice')
    // Voice commands open windows locally; otherwise run through Jarvis.
    if (handleIntent(text, 'voice')) { voiceState.value = 'idle'; return }
    const ws = getVoiceWs()
    ws.send(JSON.stringify({ type: 'execute_transcript', text }))
  }
  if (msg.type === 'jarvis_reply') {
    addMsg('jarvis', msg.text as string, 'voice')
    voiceState.value = 'idle'
  }
  if (msg.type === 'tts_audio' && typeof msg.audio === 'string') playTTS(msg.audio)
}

async function playTTS(base64: string) {
  try {
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const buffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0))
    const src = audioCtx.createBufferSource()
    src.buffer = buffer
    src.connect(audioCtx.destination)
    src.start(0)
  } catch { /* playback best-effort */ }
}

async function toggleMic() {
  if (voiceState.value === 'listening') { stopRecording(); return }
  if (voiceState.value === 'processing') return
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    audioCtx = new AudioContext({ sampleRate: 16000 })
    const src = audioCtx.createMediaStreamSource(micStream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    src.connect(analyser)
    audioChunks = []
    mediaRecorder = new MediaRecorder(micStream)
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.start(250)
    voiceState.value = 'listening'
    startVAD()
  } catch {
    voiceState.value = 'idle'
    showToast('🎙️ Microphone unavailable — check permissions.')
  }
}

function startVAD() {
  if (!analyser) return
  const buf = new Float32Array(analyser.frequencyBinCount)
  silenceStart = null
  vadInterval = window.setInterval(() => {
    if (!analyser || voiceState.value !== 'listening') return
    analyser.getFloatTimeDomainData(buf)
    const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length)
    if (rms < 0.01) {
      if (silenceStart === null) silenceStart = Date.now()
      else if (Date.now() - silenceStart > 3000) stopRecording()
    } else silenceStart = null
  }, 100)
}

function stopRecording() {
  if (vadInterval !== null) { clearInterval(vadInterval); vadInterval = null }
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  mediaRecorder.stop()
  micStream?.getTracks().forEach(t => t.stop())
  micStream = null
  mediaRecorder.onstop = async () => {
    if (audioChunks.length === 0) { voiceState.value = 'idle'; return }
    voiceState.value = 'processing'
    try {
      const blob = new Blob(audioChunks, { type: mediaRecorder!.mimeType || 'audio/webm' })
      audioChunks = []
      const decoded = await audioCtx!.decodeAudioData(await blob.arrayBuffer())
      const pcm = decoded.getChannelData(0)
      const bytes = new Uint8Array(pcm.buffer)
      const ws = getVoiceWs()
      const CHUNK = 32768
      const send = () => {
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const b64 = btoa(String.fromCharCode(...bytes.slice(i, i + CHUNK)))
          ws.send(JSON.stringify({ type: 'audio_chunk', data: b64 }))
        }
        ws.send(JSON.stringify({ type: 'transcribe_only' }))
      }
      if (ws.readyState === WebSocket.OPEN) send()
      else ws.onopen = send
    } catch {
      voiceState.value = 'idle'
    }
  }
}

// ── Vision (camera + gesture WebSocket) ────────────────────
const showCamera = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const lastGesture = ref<{ name: string } | null>(null)
let cameraStream: MediaStream | null = null
let frameLoop: number | null = null
let visionWs: WebSocket | null = null
let gestureClearTimer: ReturnType<typeof setTimeout> | null = null

const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
]

async function toggleCamera() {
  if (showCamera.value) { closeCamera(); return }
  showCamera.value = true
  await nextTick()
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
    const video = videoEl.value
    if (!video) return
    video.srcObject = cameraStream
    await video.play()
    frameLoop = window.setInterval(() => sendFrame(video), 100)
    connectVisionWs()
  } catch {
    showCamera.value = false
    showToast('📷 Camera unavailable — check permissions.')
  }
}

function closeCamera() {
  showCamera.value = false
  if (frameLoop !== null) { clearInterval(frameLoop); frameLoop = null }
  cameraStream?.getTracks().forEach(t => t.stop())
  cameraStream = null
  if (videoEl.value) videoEl.value.srcObject = null
  if (canvasEl.value) canvasEl.value.getContext('2d')?.clearRect(0, 0, 9999, 9999)
  lastGesture.value = null
  visionWs?.close()
  visionWs = null
}

function sendFrame(video: HTMLVideoElement) {
  if (!visionWs || visionWs.readyState !== WebSocket.OPEN || video.readyState < 2) return
  try {
    const tmp = document.createElement('canvas')
    tmp.width = 320; tmp.height = 240
    tmp.getContext('2d')!.drawImage(video, 0, 0, 320, 240)
    const b64 = tmp.toDataURL('image/jpeg', 0.6).split(',')[1] ?? ''
    if (b64) visionWs.send(JSON.stringify({ type: 'frame', data: b64, width: 320, height: 240 }))
  } catch { /* ignore */ }
}

function connectVisionWs() {
  if (visionWs && visionWs.readyState <= WebSocket.OPEN) return
  visionWs = new WebSocket(`${WS_BASE}/ws/vision/`)
  visionWs.onopen = () => visionWs!.send(JSON.stringify({ type: 'start_tracking' }))
  visionWs.onmessage = (ev) => { try { onVisionMsg(JSON.parse(ev.data)) } catch { /* ignore */ } }
  visionWs.onclose = () => { visionWs = null }
  visionWs.onerror = () => { visionWs = null }
}

function onVisionMsg(msg: Record<string, unknown>) {
  if (msg.type === 'landmarks') drawLandmarks((msg.hands as { landmarks: { x: number; y: number }[] }[]) || [])
  if (msg.type === 'gesture') {
    lastGesture.value = { name: msg.name as string }
    if (gestureClearTimer) clearTimeout(gestureClearTimer)
    gestureClearTimer = setTimeout(() => { lastGesture.value = null }, 2500)
  }
}

function drawLandmarks(hands: { landmarks: { x: number; y: number }[] }[]) {
  const canvas = canvasEl.value
  const video = videoEl.value
  if (!canvas || !video) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = video.videoWidth || 320
  canvas.height = video.videoHeight || 240
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4d9bff'
  for (const hand of hands) {
    const pts = hand.landmarks
    const W = canvas.width, H = canvas.height
    ctx.strokeStyle = accent
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 1.5
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = pts[a], pb = pts[b]
      if (!pa || !pb) continue
      ctx.beginPath(); ctx.moveTo(pa.x * W, pa.y * H); ctx.lineTo(pb.x * W, pb.y * H); ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; if (!p) continue
      ctx.beginPath(); ctx.arc(p.x * W, p.y * H, i === 0 ? 5 : 3, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
    }
  }
}

function gestureEmoji(name: string): string {
  return ({ fist: '✊', open_hand: '🖐', point_up: '☝️', peace: '✌️', ok: '👌', pinch: '🤏', thumbs_up: '👍', swipe_left: '👈', swipe_right: '👉', swipe_up: '👆', swipe_down: '👇' } as Record<string, string>)[name] || '🤚'
}

// ── Telemetry (placeholder HUD readouts) ───────────────────
const gpu = ref(34)
const latency = ref(312)
const tps = ref('58.4')
let teleInterval: number | null = null
const jit = (b: number, s: number) => b + (Math.random() - 0.5) * s

// ── Lifecycle ──────────────────────────────────────────────
function onDocClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (launcherOpen.value && !el.closest('.launcher') && !el.closest('.dock')) launcherOpen.value = false
}

onMounted(async () => {
  try {
    const { getStatus } = useJarvis()
    const s = await getStatus()
    statusOnline.value = true
    if (s?.model) modelName.value = s.model
  } catch { statusOnline.value = false }

  teleInterval = window.setInterval(() => {
    gpu.value = Math.round(jit(34, 16))
    latency.value = Math.round(jit(312, 50))
    tps.value = jit(58, 6).toFixed(1)
  }, 1500)

  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  if (vadInterval !== null) clearInterval(vadInterval)
  if (teleInterval !== null) clearInterval(teleInterval)
  micStream?.getTracks().forEach(t => t.stop())
  closeCamera()
  voiceWs?.close()
  document.removeEventListener('click', onDocClick)
})
</script>
