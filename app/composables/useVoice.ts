/**
 * useVoice.ts — Voice I/O composable
 * Path: frontend/app/composables/useVoice.ts
 *
 * Manages:
 *  - WebSocket connection to /ws/voice/
 *  - MediaRecorder audio capture
 *  - STT transcript & TTS reply state
 *  - Emits jarvis reply event for chat display
 *  - Plays Edge TTS MP3 audio received from backend via tts_audio message
 */
import { ref, onUnmounted } from 'vue'

type ListeningState = 'idle' | 'listening' | 'processing' | 'speaking'

// Singleton state (shared across components)
const isListening = ref(false)
const isProcessing = ref(false)
const isSpeaking = ref(false)           // true while JARVIS audio plays
const transcript = ref('')
const jarvisReply = ref('')
const state = ref<ListeningState>('idle')

let ws: WebSocket | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let audioContext: AudioContext | null = null
let stream: MediaStream | null = null
let currentSource: AudioBufferSourceNode | null = null  // track active playback

const WS_URL = `ws://${window.location.host}/ws/voice/`

function getWs(): WebSocket {
  if (ws && ws.readyState === WebSocket.OPEN) return ws

  ws = new WebSocket(WS_URL)

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      handleServerMessage(msg)
    } catch {}
  }

  ws.onclose = () => {
    ws = null
    isListening.value = false
    isProcessing.value = false
    isSpeaking.value = false
    state.value = 'idle'
  }

  ws.onerror = (e) => {
    console.error('[VoiceWS] error', e)
  }

  return ws
}

// ── Play MP3 bytes received from Edge TTS backend ────────────────────────────

async function playTTSAudio(base64Audio: string): Promise<void> {
  isSpeaking.value = true
  state.value = 'speaking'

  try {
    // Stop any currently playing TTS first
    if (currentSource) {
      try { currentSource.stop() } catch {}
      currentSource = null
    }

    // Lazy-create AudioContext (requires prior user gesture)
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    // Decode base64 → ArrayBuffer → AudioBuffer (supports MP3 natively)
    const binary = atob(base64Audio)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0))

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)
    currentSource = source

    await new Promise<void>((resolve) => {
      source.onended = () => {
        currentSource = null
        resolve()
      }
      source.start(0)
    })

  } catch (err) {
    console.error('[Voice] TTS playback error:', err)
  } finally {
    isSpeaking.value = false
    state.value = 'idle'
    window.dispatchEvent(new CustomEvent('jarvis:tts_done'))
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function handleServerMessage(msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'listening_state':
      state.value = msg.state as ListeningState
      isListening.value = msg.state === 'listening'
      isProcessing.value = msg.state === 'processing'
      break

    case 'transcript':
      if (msg.final) transcript.value = msg.text as string
      break

    case 'jarvis_reply':
      jarvisReply.value = msg.text as string
      window.dispatchEvent(new CustomEvent('jarvis:reply', { detail: msg.text }))
      break

    // Edge TTS MP3 audio streamed from backend
    case 'tts_audio':
      if (msg.audio && typeof msg.audio === 'string') {
        playTTSAudio(msg.audio)
      }
      break

    case 'tts_done':
      window.dispatchEvent(new CustomEvent('jarvis:tts_done'))
      break
  }
}

async function startListening() {
  if (isListening.value || isProcessing.value) return

  // Stop any playing TTS so JARVIS doesn't record itself
  if (currentSource) {
    try { currentSource.stop() } catch {}
    currentSource = null
    isSpeaking.value = false
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    audioContext = new AudioContext({ sampleRate: 16000 })

    audioChunks = []
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.start(100)

    const socket = getWs()
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'start_listening' }))
    } else {
      socket.onopen = () => socket.send(JSON.stringify({ type: 'start_listening' }))
    }

    isListening.value = true
    state.value = 'listening'
  } catch (e) {
    console.error('[Voice] Mic access denied', e)
  }
}

async function stopListening() {
  if (!isListening.value || !mediaRecorder) return

  mediaRecorder.stop()
  stream?.getTracks().forEach(t => t.stop())
  isListening.value = false
  isProcessing.value = true
  state.value = 'processing'

  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm' })
    const arrayBuffer = await blob.arrayBuffer()

    const decoded = await audioContext!.decodeAudioData(arrayBuffer)
    const pcm = decoded.getChannelData(0)
    const pcmBytes = new Uint8Array(pcm.buffer)

    const b64 = btoa(String.fromCharCode(...pcmBytes))
    const socket = getWs()
    socket.send(JSON.stringify({ type: 'audio_chunk', data: b64 }))
    socket.send(JSON.stringify({ type: 'stop_listening' }))

    isProcessing.value = false
    audioChunks = []
  }
}

function stopTTS() {
  if (currentSource) {
    try { currentSource.stop() } catch {}
    currentSource = null
  }
  isSpeaking.value = false
  state.value = 'idle'
  getWs().send(JSON.stringify({ type: 'tts_stop' }))
}

onUnmounted(() => {
  stream?.getTracks().forEach(t => t.stop())
})

export function useVoice() {
  return {
    isListening,
    isProcessing,
    isSpeaking,
    transcript,
    jarvisReply,
    state,
    startListening,
    stopListening,
    stopTTS,
    playTTSAudio,
  }
}