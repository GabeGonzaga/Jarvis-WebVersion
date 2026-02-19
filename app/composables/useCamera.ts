/**
 * useCamera.ts — Camera + gesture tracking composable
 * Path: frontend/app/composables/useCamera.ts
 *
 * Manages:
 *  - Camera stream → video element
 *  - Frame capture → WebSocket → backend MediaPipe
 *  - Landmark overlay drawing on canvas
 *  - Gesture event display
 */
import { ref, onUnmounted } from 'vue'

interface Landmark { x: number; y: number; z: number }
interface GestureEvent { name: string; confidence: number; hand: string; action?: string }

const isTracking = ref(false)
const lastGesture = ref<GestureEvent | null>(null)

let ws: WebSocket | null = null
let videoEl: HTMLVideoElement | null = null
let canvasEl: HTMLCanvasElement | null = null
let frameLoop: number | null = null
let cameraStream: MediaStream | null = null
let gestureTimeout: ReturnType<typeof setTimeout> | null = null

const WS_URL = `ws://${window.location.host}/ws/vision/`

// MediaPipe hand connections for drawing skeleton
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],       // thumb
  [0,5],[5,6],[6,7],[7,8],       // index
  [5,9],[9,10],[10,11],[11,12],  // middle
  [9,13],[13,14],[14,15],[15,16],// ring
  [13,17],[17,18],[18,19],[19,20],// pinky
  [0,17],                        // palm base
]

function getWs(): WebSocket {
  if (ws && ws.readyState === WebSocket.OPEN) return ws
  ws = new WebSocket(WS_URL)

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      handleMessage(msg)
    } catch {}
  }
  ws.onclose = () => { ws = null }
  return ws
}

function handleMessage(msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'landmarks':
      drawLandmarks((msg.hands as { landmarks: Landmark[] }[]) || [])
      break

    case 'gesture':
      // Will be enriched by action_triggered if it fires
      lastGesture.value = {
        name: msg.name as string,
        confidence: msg.confidence as number,
        hand: msg.hand as string,
      }
      break

    case 'action_triggered':
      if (lastGesture.value) {
        lastGesture.value = { ...lastGesture.value, action: msg.action as string }
      }
      // Auto-clear badge after 2s
      if (gestureTimeout) clearTimeout(gestureTimeout)
      gestureTimeout = setTimeout(() => { lastGesture.value = null }, 2000)
      break
  }
}

function drawLandmarks(hands: { landmarks: Landmark[] }[]) {
  if (!canvasEl || !videoEl) return
  const ctx = canvasEl.getContext('2d')
  if (!ctx) return

  canvasEl.width = videoEl.videoWidth || 640
  canvasEl.height = videoEl.videoHeight || 480
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

  for (const hand of hands) {
    const pts = hand.landmarks
    const W = canvasEl.width
    const H = canvasEl.height

    // Draw connections
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)'
    ctx.lineWidth = 1.5
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = pts[a], pb = pts[b]
      ctx.beginPath()
      ctx.moveTo(pa.x * W, pa.y * H)
      ctx.lineTo(pb.x * W, pb.y * H)
      ctx.stroke()
    }

    // Draw landmark dots
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      ctx.beginPath()
      ctx.arc(p.x * W, p.y * H, i === 0 ? 5 : 3, 0, Math.PI * 2)
      ctx.fillStyle = i === 0 ? '#00d4ff' : 'rgba(0, 212, 255, 0.8)'
      ctx.fill()
    }
  }
}

function captureAndSend() {
  if (!videoEl || !ws || ws.readyState !== WebSocket.OPEN) return
  if (videoEl.readyState < 2) return // not ready

  const tmpCanvas = document.createElement('canvas')
  tmpCanvas.width = 320   // downsample for speed
  tmpCanvas.height = 240
  const ctx = tmpCanvas.getContext('2d')!
  ctx.drawImage(videoEl, 0, 0, 320, 240)
  const b64 = tmpCanvas.toDataURL('image/jpeg', 0.7).split(',')[1]

  ws.send(JSON.stringify({
    type: 'frame',
    data: b64,
    width: 320,
    height: 240,
  }))
}

async function startTracking() {
  if (isTracking.value) return

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    })

    if (videoEl) {
      videoEl.srcObject = cameraStream
      await videoEl.play()
    }

    const socket = getWs()
    const send = () => socket.send(JSON.stringify({ type: 'start_tracking' }))
    if (socket.readyState === WebSocket.OPEN) send()
    else socket.onopen = send

    isTracking.value = true

    // Capture + send frames at ~15fps
    frameLoop = window.setInterval(captureAndSend, 67)

  } catch (e) {
    console.error('[Camera] Access denied or error:', e)
  }
}

function stopTracking() {
  isTracking.value = false

  if (frameLoop !== null) { clearInterval(frameLoop); frameLoop = null }
  cameraStream?.getTracks().forEach(t => t.stop())
  cameraStream = null

  if (videoEl) { videoEl.srcObject = null }
  if (canvasEl) {
    const ctx = canvasEl.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
  }

  ws?.send(JSON.stringify({ type: 'stop_tracking' }))
}

function setVideoElement(el: HTMLVideoElement) { videoEl = el }
function setCanvasElement(el: HTMLCanvasElement) { canvasEl = el }

onUnmounted(stopTracking)

export function useCamera() {
  return {
    isTracking,
    lastGesture,
    startTracking,
    stopTracking,
    setVideoElement,
    setCanvasElement,
  }
}