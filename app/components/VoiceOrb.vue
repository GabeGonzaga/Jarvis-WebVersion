<template>
  <div class="voice-orb-wrapper" :class="{ active: isListening, processing: isProcessing }">
    <!-- Outer pulse rings -->
    <div class="ring ring-1" />
    <div class="ring ring-2" />
    <div class="ring ring-3" />

    <!-- Main orb button -->
    <button
      class="orb"
      :disabled="isProcessing"
      @mousedown="startListening"
      @mouseup="stopListening"
      @touchstart.prevent="startListening"
      @touchend.prevent="stopListening"
      @keydown.space.prevent="startListening"
      @keyup.space.prevent="stopListening"
      aria-label="Hold to speak"
    >
      <!-- Mic icon -->
      <svg v-if="!isProcessing" class="icon-mic" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
        <path
          d="M5 10a7 7 0 0 0 14 0"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>

      <!-- Spinner when processing -->
      <svg v-else class="icon-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="20 40" />
      </svg>

      <!-- Waveform bars (shown while listening) -->
      <div v-if="isListening" class="waveform">
        <span v-for="i in 5" :key="i" class="wave-bar" :style="{ animationDelay: `${i * 80}ms` }" />
      </div>
    </button>

    <!-- State label -->
    <div class="orb-label">
      <span v-if="isListening">Listening…</span>
      <span v-else-if="isProcessing">Processing…</span>
      <span v-else>Hold to speak</span>
    </div>

    <!-- Last transcript -->
    <transition name="fade">
      <div v-if="transcript" class="transcript-bubble">
        <span class="transcript-you">You:</span> {{ transcript }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useVoice } from '~/composables/useVoice'

const { isListening, isProcessing, transcript, startListening, stopListening } = useVoice()
</script>

<style scoped>
.voice-orb-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  position: relative;
  user-select: none;
}

/* Pulse rings */
.ring {
  position: absolute;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 212, 255, 0.15);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: opacity 0.3s;
}
.ring-1 { width: 90px;  height: 90px; }
.ring-2 { width: 120px; height: 120px; }
.ring-3 { width: 150px; height: 150px; }

.active .ring {
  border-color: rgba(0, 212, 255, 0.4);
  animation: pulse-ring 1.2s ease-out infinite;
}
.active .ring-2 { animation-delay: 0.2s; }
.active .ring-3 { animation-delay: 0.4s; }

@keyframes pulse-ring {
  0%   { transform: translate(-50%, -50%) scale(0.95); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0; }
}

/* Orb button */
.orb {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background: radial-gradient(circle at 35% 35%, #1a3a4a, #0a1a22);
  box-shadow:
    0 0 0 2px rgba(0, 212, 255, 0.3),
    0 0 20px rgba(0, 212, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 212, 255, 0.8);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1;
}

.orb:hover:not(:disabled) {
  box-shadow:
    0 0 0 2px rgba(0, 212, 255, 0.6),
    0 0 30px rgba(0, 212, 255, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: #00d4ff;
  transform: scale(1.05);
}

.active .orb {
  background: radial-gradient(circle at 35% 35%, #003d52, #001a25);
  box-shadow:
    0 0 0 2px #00d4ff,
    0 0 40px rgba(0, 212, 255, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  color: #00d4ff;
  transform: scale(1.08);
}

.processing .orb {
  cursor: not-allowed;
  color: rgba(0, 212, 255, 0.5);
}

.icon-mic, .icon-spin {
  width: 26px;
  height: 26px;
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Waveform */
.waveform {
  position: absolute;
  bottom: -28px;
  display: flex;
  gap: 3px;
  align-items: flex-end;
}

.wave-bar {
  display: block;
  width: 3px;
  height: 12px;
  background: #00d4ff;
  border-radius: 2px;
  animation: wave 0.6s ease-in-out infinite alternate;
}

@keyframes wave {
  from { height: 4px;  opacity: 0.4; }
  to   { height: 18px; opacity: 1; }
}

/* Label */
.orb-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(0, 212, 255, 0.5);
  margin-top: 44px;
  transition: color 0.2s;
}
.active .orb-label,
.processing .orb-label {
  color: rgba(0, 212, 255, 0.8);
}

/* Transcript bubble */
.transcript-bubble {
  background: rgba(0, 212, 255, 0.06);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  max-width: 280px;
  text-align: center;
}
.transcript-you {
  color: #00d4ff;
  font-weight: 600;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>