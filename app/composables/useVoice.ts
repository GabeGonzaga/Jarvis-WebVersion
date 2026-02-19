/**
 * useVoice.ts — Voice I/O composable
 * Path: frontend/app/composables/useVoice.ts
 *
 * Manages:
 *  - WebSocket connection to /ws/voice/
 *  - MediaRecorder audio capture
 *  - STT transcript & TTS reply state
 *  - Emits jarvis reply event for chat display
 */
import { ref, onUnmounted } from 'vue'

type ListeningState = 'idle' | 'listening' | 'processing'

// Singleton state (shared across components)
const isListening = ref(false)
const isProcessing = ref(false)
const transcript = ref('')
const jarvisReply = ref('')
const state = ref<ListeningState>('idle')

let ws: WebSocket | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let audioContext: AudioContext | null = null
let stream: MediaStream | null = null

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
    state.value = 'idle'
  }

  ws.onerror = (e) => {
    console.error('[VoiceWS] error', e)
  }

  return ws
}

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
      // Dispatch a global event so chat UI can display it
      window.dispatchEvent(new CustomEvent('jarvis:reply', { detail: msg.text }))
      break

    case 'tts_done':
      // TTS finished speaking
      window.dispatchEvent(new CustomEvent('jarvis:tts_done'))
      break
  }
}

async function startListening() {
  if (isListening.value || isProcessing.value) return

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    audioContext = new AudioContext({ sampleRate: 16000 })

    audioChunks = []
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.start(100) // collect chunks every 100ms

    const socket = getWs()
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'start_listening' }))
    } else {
      socket.onopen = () => socket.send(JSON.stringify({ type: 'start_listening' }))
    }
  } catch (e) {
    console.error('[Voice] Mic access denied', e)
  }
}

async function stopListening() {
  if (!isListening.value || !mediaRecorder) return

  mediaRecorder.stop()
  stream?.getTracks().forEach(t => t.stop())

  mediaRecorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm' })
    const arrayBuffer = await blob.arrayBuffer()

    // Decode to PCM float32 at 16kHz
    const decoded = await audioContext!.decodeAudioData(arrayBuffer)
    const pcm = decoded.getChannelData(0) // mono float32
    const pcmBytes = new Uint8Array(pcm.buffer)

    // Send as base64 chunk then stop signal
    const b64 = btoa(String.fromCharCode(...pcmBytes))
    const socket = getWs()
    socket.send(JSON.stringify({ type: 'audio_chunk', data: b64 }))
    socket.send(JSON.stringify({ type: 'stop_listening' }))

    audioChunks = []
  }
}

function stopTTS() {
  getWs().send(JSON.stringify({ type: 'tts_stop' }))
}

onUnmounted(() => {
  stream?.getTracks().forEach(t => t.stop())
})

export function useVoice() {
  return {
    isListening,
    isProcessing,
    transcript,
    jarvisReply,
    state,
    startListening,
    stopListening,
    stopTTS,
  }
}