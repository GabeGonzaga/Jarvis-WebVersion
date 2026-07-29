<template>
  <div class="launcher" :class="{ open }">
    <div class="lhead">
      <span class="lh">Open a panel</span>
      <div class="open-mode">
        <span class="oml">Open as</span>
        <div class="seg2">
          <button :class="{ on: mode === 'window' }" @click="mode = 'window'">Window</button>
          <button :class="{ on: mode === 'redirect' }" @click="mode = 'redirect'">Website ↗</button>
        </div>
      </div>
    </div>

    <div class="apps">
      <div v-for="a in presets" :key="a.name" class="appt" @click="chooseApp(a)">
        <span class="ic">{{ a.icon }}</span>
        <span class="nm">{{ a.name }}</span>
      </div>
    </div>

    <div class="add-link">
      <input
        ref="inputEl"
        v-model="linkText"
        placeholder="Paste a link or type a search…  e.g. whales on pinterest"
        @keydown.enter="goLink"
      >
      <button @click="goLink">OPEN</button>
    </div>
    <div class="add-hint">↳ A URL opens the site · plain text becomes a search · “x on pinterest / youtube” targets that site</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useWindows, buildUrl, openExternal, parseIntent, type WindowType } from '~/composables/useWindows'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; toast: [msg: string] }>()

const { openWindow } = useWindows()
const mode = ref<'window' | 'redirect'>('window')
const linkText = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

watch(() => props.open, (v) => { if (v) nextTick(() => inputEl.value?.focus()) })

interface Preset { type: WindowType; name: string; icon: string; host: string }
const presets: Preset[] = [
  { type: 'google', name: 'Google', icon: '🔎', host: 'google.com' },
  { type: 'youtube', name: 'YouTube', icon: '▶️', host: 'youtube.com' },
  { type: 'pinterest', name: 'Pinterest', icon: '📌', host: 'pinterest.com' },
  { type: 'music', name: 'Music', icon: '🎵', host: 'open.spotify.com' },
  { type: 'notes', name: 'Notes', icon: '📝', host: 'jarvis://notes' },
  { type: 'google', name: 'GitHub', icon: '🐙', host: 'github.com' },
  { type: 'google', name: 'Moodle', icon: '🎓', host: 'moodle25.iscte-iul.pt' },
  { type: 'google', name: 'Okta', icon: '🔐', host: 'login.iscte-iul.pt' }
]

function chooseApp(a: Preset) {
  if (mode.value === 'redirect' && a.type !== 'notes') {
    openExternal(a.host)
    emit('toast', `↗ Opening ${a.host} in your browser…`)
  } else {
    openWindow({
      type: a.type,
      title: a.name,
      query: a.name === 'Google' || a.type === 'notes' ? '' : a.name,
      url: a.host
    })
  }
  emit('close')
}

function goLink() {
  const v = linkText.value.trim()
  if (!v) return
  linkText.value = ''

  const isUrl = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v)
  if (isUrl) {
    const host = v.replace(/^https?:\/\//, '')
    if (mode.value === 'redirect') { openExternal(v); emit('toast', `↗ Opening ${host.split('/')[0]}…`) }
    else openWindow({ type: 'browser', title: host.split('/')[0], url: host })
  } else {
    const intent = parseIntent(`open ${v}`)
    const type = intent?.type || 'google'
    const query = intent?.query || v
    const url = buildUrl(type, query)
    if (mode.value === 'redirect') { openExternal(url); emit('toast', `↗ Searching “${query}”…`) }
    else openWindow({ type, title: query, query, url })
  }
  emit('close')
}
</script>
