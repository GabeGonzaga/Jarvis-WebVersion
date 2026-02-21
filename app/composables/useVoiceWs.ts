import { ref, onBeforeUnmount } from 'vue'

type WsMsg =
  | { type: 'listening_started'; rid?: string }
  | { type: 'listening_stopped'; rid?: string }
  | { type: 'transcript_ready'; text: string; rid?: string }
  | { type: 'transcript'; text: string; final?: boolean; rid?: string }
  | { type: 'jarvis_reply'; text: string }
  | { type: 'tts_audio'; audio: string; format: string; text?: string }  // Edge TTS MP3

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => {
      const s = String(r.result || '')
      resolve(s.split(',')[1] || '')
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function cleanTranscript(s: string): string {
  return (s || '')
    .replace(/^\s*(hey\s+)?jarvis[\s,]*/i, '')
    .trim()
    .replace(/[.?!]+$/g, '')
    .trim()
}

// ── Shared AudioContext for MP3 playback ─────────────────────────────────────

let _audioCtx: AudioContext | null = null
let _currentSource: AudioBufferSourceNode | null = null

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return _audioCtx
}

async function playTTSAudio(base64Audio: string): Promise<void> {
  try {
    // Stop anything currently playing
    if (_currentSource) {
      try { _currentSource.stop() } catch {}
      _currentSource = null
    }

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()

    // Decode base64 MP3 → AudioBuffer (AudioContext handles MP3 natively)
    const binary = atob(base64Audio)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0))
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    _currentSource = source

    await new Promise<void>((resolve) => {
      source.onended = () => {
        _currentSource = null
        resolve()
      }
      source.start(0)
    })
  } catch (err) {
    console.error('[VoiceWs] TTS playback error:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useVoiceWs() {
  const ws = ref<WebSocket | null>(null)
  const mediaRecorder = ref<MediaRecorder | null>(null)

  const isConnected = ref(false)
  const isRecording = ref(false)
  const isSpeaking = ref(false)          // true while JARVIS voice plays

  const rid = ref<string | null>(null)
  const transcript = ref('')
  const jarvisReply = ref('')

  let sendChain: Promise<void> = Promise.resolve()
  let pendingTranscribe = false

  const WS_URL =
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
    '127.0.0.1:8000/ws/voice/'

  function wsSend(obj: any) {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return
    ws.value.send(JSON.stringify(obj))
  }

  function queueSend(fn: () => Promise<void> | void) {
    sendChain = sendChain
      .then(async () => { await fn() })
      .catch(() => {})
  }

  async function connect() {
    if (
      ws.value &&
      (ws.value.readyState === WebSocket.OPEN ||
        ws.value.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    ws.value = new WebSocket(WS_URL)

    ws.value.onopen = () => { isConnected.value = true }

    ws.value.onclose = () => {
      isConnected.value = false
      isRecording.value = false
      isSpeaking.value = false
    }

    ws.value.onerror = () => { isConnected.value = false }

    ws.value.onmessage = (ev) => {
      let msg: WsMsg | null = null
      try { msg = JSON.parse(ev.data) } catch { return }
      if (!msg) return

      if (msg.type === 'transcript_ready') {
        const cleaned = cleanTranscript(msg.text || '')
        transcript.value = cleaned
        if (cleaned) wsSend({ type: 'execute_transcript', text: cleaned })
        return
      }

      if (msg.type === 'transcript') {
        transcript.value = cleanTranscript(msg.text || '')
        return
      }

      if (msg.type === 'jarvis_reply') {
        jarvisReply.value = msg.text || ''
        return
      }

      // Edge TTS MP3 audio from backend
      if (msg.type === 'tts_audio') {
        if (msg.audio) {
          isSpeaking.value = true
          playTTSAudio(msg.audio).finally(() => {
            isSpeaking.value = false
          })
        }
        return
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    mediaRecorder.value = mr

    mr.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return
      queueSend(async () => {
        const b64 = await blobToBase64(e.data)
        wsSend({ type: 'audio_chunk', rid: rid.value, data: b64 })
      })
    }

    mr.onstart = () => { isRecording.value = true }

    mr.onstop = () => {
      isRecording.value = false
      if (pendingTranscribe) {
        pendingTranscribe = false
        queueSend(async () => {
          wsSend({ type: 'transcribe_only', rid: rid.value })
        })
      }
    }
  }

  function startVoice() {
    if (!mediaRecorder.value) return
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return
    if (mediaRecorder.value.state === 'recording') return

    // Stop any playing TTS before mic opens (prevent self-recording)
    if (_currentSource) {
      try { _currentSource.stop() } catch {}
      _currentSource = null
      isSpeaking.value = false
    }

    rid.value = `${Date.now()}-${Math.random().toString().slice(2)}`
    transcript.value = ''
    jarvisReply.value = ''
    pendingTranscribe = false

    wsSend({ type: 'start_listening', rid: rid.value })
    mediaRecorder.value.start(250)
  }

  function stopVoiceAndTranscribe() {
    if (!mediaRecorder.value) return
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return
    if (mediaRecorder.value.state !== 'recording') return

    pendingTranscribe = true

    try { mediaRecorder.value.requestData() } catch {}

    mediaRecorder.value.stop()
    wsSend({ type: 'stop_listening', rid: rid.value })
  }

  onBeforeUnmount(() => {
    try { ws.value?.close() } catch {}
  })

  return {
    connect,
    startVoice,
    stopVoiceAndTranscribe,
    isConnected,
    isRecording,
    isSpeaking,
    transcript,
    jarvisReply,
  }
}