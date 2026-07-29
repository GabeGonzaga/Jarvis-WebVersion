<template>
  <div
    class="win"
    :class="{ focused }"
    :style="{ left: win.x + 'px', top: win.y + 'px', width: win.w + 'px', height: win.h + 'px', zIndex: win.z, display: win.min ? 'none' : 'flex' }"
    @pointerdown="$emit('focus', win.id)"
  >
    <div class="win-bar" @pointerdown="startDrag" @pointermove="onDrag" @pointerup="endDrag">
      <div class="lights">
        <i class="c" title="Close" @click.stop="$emit('close', win.id)" />
        <i class="m" title="Minimise" @click.stop="$emit('minimise', win.id)" />
        <i class="f" />
      </div>
      <div class="win-title">
        <span class="ico">{{ icon }}</span>
        <span class="t">{{ win.title }}</span>
      </div>
      <div class="win-addr"><span class="lock">🔒</span><span class="u">{{ win.url }}</span></div>
      <button class="win-ext" title="Open in browser" @click.stop="openExternal(win.url)">↗</button>
    </div>

    <div class="win-body">
      <!-- Pinterest -->
      <div v-if="win.type === 'pinterest'" class="mock">
        <div class="mock-search">🔍 {{ win.query }} · Pinterest</div>
        <div class="pin-grid">
          <div v-for="(p, i) in pins" :key="i" class="p" :style="{ height: p.h + 'px', background: p.bg }">{{ win.query }}</div>
        </div>
      </div>

      <!-- YouTube -->
      <div v-else-if="win.type === 'youtube'" class="mock">
        <div class="mock-search">🔍 {{ win.query }} · YouTube</div>
        <div class="yt-grid">
          <div v-for="j in 4" :key="j" class="v">
            <div class="th">▶</div>
            <div class="tt">{{ win.query }} — clip {{ j }}</div>
            <div class="m">{{ 120 - j * 17 }}K views · {{ j }}d ago</div>
          </div>
        </div>
      </div>

      <!-- Music -->
      <div v-else-if="win.type === 'music'" class="music">
        <div class="now">
          <div class="art" />
          <div><div class="tk">{{ win.query || 'Focus Flow' }}</div><div class="ar">JARVIS Radio · lo-fi</div></div>
        </div>
        <div class="prog"><i /></div>
        <div class="ctrl"><span>⏮</span><span>⏸</span><span>⏭</span></div>
        <div class="list">
          <div v-for="t in tracks" :key="t.n" class="li"><span>{{ t.n }}</span><span class="d">{{ t.d }}</span></div>
        </div>
      </div>

      <!-- Notes -->
      <textarea v-else-if="win.type === 'notes'" class="notes-ta" placeholder="Notes…" />

      <!-- Google -->
      <div v-else-if="win.type === 'google'" class="mock">
        <div class="mock-search">🔍 {{ win.query }}</div>
        <div class="mock-res">
          <div v-for="k in 4" :key="k" class="r">
            <div class="u">{{ slug }}.com › result{{ k }}</div>
            <div class="h">{{ win.query }} — result {{ k }}</div>
            <div class="s">A concise summary of result {{ k }} for “{{ win.query }}”, shown inside the JARVIS window.</div>
          </div>
        </div>
      </div>

      <!-- Real site (iframe with fallback) -->
      <iframe v-else :src="httpUrl" referrerpolicy="no-referrer" />

      <div class="win-resize" @pointerdown="startResize" @pointermove="onResize" @pointerup="endResize" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { openExternal, useWindows, type JWindow } from '~/composables/useWindows'

const props = defineProps<{ win: JWindow; focused: boolean }>()
defineEmits<{ close: [id: number]; minimise: [id: number]; focus: [id: number] }>()

const { setBounds } = useWindows()

const ICONS: Record<string, string> = { pinterest: '📌', youtube: '▶️', music: '🎵', notes: '📝', google: '🔎' }
const icon = computed(() => ICONS[props.win.type] || '🌐')
const httpUrl = computed(() => (/^https?:\/\//i.test(props.win.url) ? props.win.url : `https://${props.win.url}`))
const slug = computed(() => props.win.query.replace(/\s+/g, '') || 'result')

const PIN_COLORS = ['#3a6ea5', '#5a4b8a', '#2f7d6b', '#8a5a3a', '#6a3a5a', '#3a8a7a', '#4a5a8a', '#7a6a3a']
const pins = Array.from({ length: 9 }, (_, i) => ({
  h: 70 + ((i * 13) % 80),
  bg: `linear-gradient(160deg, ${PIN_COLORS[i % PIN_COLORS.length]}, #0a1330)`
}))
const tracks = [
  { n: 'Deep Work', d: '3:12' }, { n: 'Midnight Circuit', d: '4:05' },
  { n: 'Arc Reactor', d: '2:48' }, { n: 'Blue Hour', d: '3:39' }
]

// ── Drag ──────────────────────────────────────────────────
let dragging = false, ox = 0, oy = 0
function startDrag(e: PointerEvent) {
  const el = e.target as HTMLElement
  if (el.closest('.lights') || el.closest('.win-ext')) return
  dragging = true; ox = e.clientX - props.win.x; oy = e.clientY - props.win.y
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onDrag(e: PointerEvent) {
  if (!dragging) return
  setBounds(props.win.id, {
    x: Math.max(0, Math.min(window.innerWidth - 80, e.clientX - ox)),
    y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - oy))
  })
}
function endDrag() { dragging = false }

// ── Resize ────────────────────────────────────────────────
let rzing = false, sx = 0, sy = 0, sw = 0, sh = 0
function startResize(e: PointerEvent) {
  e.stopPropagation(); rzing = true
  sx = e.clientX; sy = e.clientY; sw = props.win.w; sh = props.win.h
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onResize(e: PointerEvent) {
  if (!rzing) return
  setBounds(props.win.id, {
    w: Math.max(280, sw + e.clientX - sx),
    h: Math.max(200, sh + e.clientY - sy)
  })
}
function endResize() { rzing = false }
</script>
