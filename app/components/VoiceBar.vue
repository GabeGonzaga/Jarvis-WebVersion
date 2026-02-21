<script setup lang="ts">
import { onMounted } from 'vue'
import { useVoiceWs } from '~/composables/useVoiceWs'

const v = useVoiceWs()

onMounted(async () => {
  await v.connect()
})

function onMicDown() {
  v.startVoice()
}

function onMicUp() {
  v.stopVoiceAndTranscribe()
}
</script>

<template>
  <div>
    <button
      @mousedown="onMicDown"
      @mouseup="onMicUp"
      @touchstart.prevent="onMicDown"
      @touchend.prevent="onMicUp"
    >
      Mic
    </button>

    <div>Transcript: {{ v.transcript }}</div>
    <div>Jarvis: {{ v.jarvisReply }}</div>
  </div>
</template>