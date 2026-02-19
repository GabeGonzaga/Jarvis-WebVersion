<template>
  <div class="camera-wrapper" :class="{ active: isTracking }">
    <!-- Camera feed -->
    <video
      ref="videoEl"
      class="camera-feed"
      autoplay
      playsinline
      muted
    />

    <!-- Canvas overlay for landmarks -->
    <canvas ref="canvasEl" class="landmark-canvas" />

    <!-- Gesture badge -->
    <transition name="gesture-pop">
      <div v-if="lastGesture" class="gesture-badge">
        <span class="gesture-icon">{{ gestureEmoji(lastGesture.name) }}</span>
        <span class="gesture-name">{{ lastGesture.name.replace(/_/g, ' ') }}</span>
        <span class="gesture-action">{{ lastGesture.action }}</span>
      </div>
    </transition>

    <!-- Controls -->
    <div class="camera-controls">
      <button class="ctrl-btn" @click="toggleTracking">
        <span v-if="!isTracking">Start Vision</span>
        <span v-else>Stop Vision</span>
      </button>
    </div>

    <!-- Status -->
    <div class="camera-status">
      <span class="status-dot" :class="{ on: isTracking }" />
      {{ isTracking ? 'Hand tracking active' : 'Vision off' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useCamera } from '~/composables/useCamera'

const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const {
  isTracking,
  lastGesture,
  startTracking,
  stopTracking,
  setVideoElement,
  setCanvasElement,
} = useCamera()

function toggleTracking() {
  if (isTracking.value) {
    stopTracking()
  } else {
    if (videoEl.value) setVideoElement(videoEl.value)
    if (canvasEl.value) setCanvasElement(canvasEl.value)
    startTracking()
  }
}

function gestureEmoji(name: string): string {
  const map: Record<string, string> = {
    fist: '✊',
    open_hand: '🖐',
    point_up: '☝️',
    peace: '✌️',
    ok: '👌',
    pinch: '🤏',
    thumbs_up: '👍',
    swipe_left: '👈',
    swipe_right: '👉',
    swipe_up: '👆',
    swipe_down: '👇',
  }
  return map[name] || '🤚'
}

onUnmounted(() => {
  stopTracking()
})
</script>

<style scoped>
.camera-wrapper {
  position: relative;
  width: 320px;
  height: 240px;
  border-radius: 14px;
  overflow: hidden;
  background: #060e14;
  border: 1.5px solid rgba(0, 212, 255, 0.15);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  transition: border-color 0.3s;
}
.camera-wrapper.active {
  border-color: rgba(0, 212, 255, 0.4);
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.08);
}

.camera-feed {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* mirror */
  opacity: 0.92;
}

.landmark-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: scaleX(-1); /* mirror to match video */
  pointer-events: none;
}

/* Gesture badge */
.gesture-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(0, 10, 16, 0.85);
  border: 1px solid rgba(0, 212, 255, 0.4);
  border-radius: 8px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(8px);
}
.gesture-icon { font-size: 18px; }
.gesture-name {
  font-size: 12px;
  font-weight: 600;
  color: #00d4ff;
  text-transform: capitalize;
}
.gesture-action {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.gesture-pop-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.gesture-pop-leave-active { transition: all 0.2s ease; }
.gesture-pop-enter-from { opacity: 0; transform: scale(0.8) translateY(-4px); }
.gesture-pop-leave-to   { opacity: 0; transform: translateY(-4px); }

/* Controls */
.camera-controls {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
}
.ctrl-btn {
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: #00d4ff;
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.ctrl-btn:hover {
  background: rgba(0, 212, 255, 0.2);
  border-color: #00d4ff;
}

/* Status */
.camera-status {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.05em;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: background 0.3s;
}
.status-dot.on {
  background: #00d4ff;
  box-shadow: 0 0 6px #00d4ff;
  animation: blink 2s ease-in-out infinite;
}
@keyframes blink {
  50% { opacity: 0.4; }
}
</style>