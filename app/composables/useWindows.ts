/**
 * useWindows.ts — floating window manager for the JARVIS desktop
 * Path: frontend/app/composables/useWindows.ts
 *
 * Holds the list of open windows plus open/close/minimise/focus actions,
 * and the helpers that turn a link or a natural-language command
 * ("open whales on pinterest") into a window (or an external redirect).
 */
import { ref } from 'vue'

export type WindowType = 'google' | 'youtube' | 'pinterest' | 'music' | 'notes' | 'browser'

export interface JWindow {
  id: number
  type: WindowType
  title: string
  query: string
  url: string          // host-relative url shown in the address bar (no scheme)
  x: number
  y: number
  w: number
  h: number
  z: number
  min: boolean
}

export interface ParsedIntent {
  type: WindowType
  query: string
  site: string | null
}

// ── Singleton state (shared across components) ──────────────
const windows = ref<JWindow[]>([])
let nextId = 1
let topZ = 60

const KNOWN_SITES = ['pinterest', 'youtube', 'google', 'github', 'spotify', 'music', 'musica', 'música']

export function buildUrl(type: WindowType, q: string): string {
  const e = encodeURIComponent(q)
  switch (type) {
    case 'pinterest': return `pinterest.com/search/pins/?q=${e}`
    case 'youtube':   return `youtube.com/results?search_query=${e}`
    case 'music':     return `open.spotify.com/search/${e}`
    case 'notes':     return 'jarvis://notes'
    default:          return `google.com/search?q=${e}`
  }
}

/** Turn free text into an intent, or null when it isn't an "open/search" command. */
export function parseIntent(text: string): ParsedIntent | null {
  const m = text.match(
    /\b(?:open|show|pull up|search(?:\s+for)?|find|play|abre|abrir|mostra|procura|pesquisa(?:r)?|toca|reproduz)\b\s+(.*)/i
  )
  if (!m) return null

  let q = (m[1] ?? '').trim()
  let site: string | null = null
  const siteMatch = q.match(/(.*)\s+(?:on|in|no|na|em)\s+([a-zçãáéíóú]+)\s*$/i)
  const siteWord = siteMatch?.[2]?.toLowerCase()
  if (siteMatch && siteWord && KNOWN_SITES.includes(siteWord)) {
    q = (siteMatch[1] ?? '').trim()
    site = siteWord
  }

  const playing = /\b(play|toca|reproduz)\b/i.test(text)
  let type: WindowType = 'google'
  if (site === 'pinterest') type = 'pinterest'
  else if (site === 'youtube') type = 'youtube'
  else if (site === 'spotify' || site === 'music' || site === 'musica' || site === 'música' || playing) type = 'music'
  else if (site === 'github') type = 'google'

  return { type, query: q, site }
}

/** Open a URL (or host) in the user's real browser. */
export function openExternal(url: string): void {
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try { window.open(full, '_blank', 'noopener') } catch { /* popup blocked */ }
}

export function useWindows() {
  function bringFront(id: number) {
    const w = windows.value.find(x => x.id === id)
    if (w) w.z = ++topZ
  }

  function openWindow(opts: Partial<JWindow> & { type: WindowType }): JWindow {
    const count = windows.value.length
    const music = opts.type === 'music'
    const vw = import.meta.client ? window.innerWidth : 1280
    const vh = import.meta.client ? window.innerHeight : 800
    const w: JWindow = {
      id: nextId++,
      type: opts.type,
      title: opts.title || 'Window',
      query: opts.query || '',
      url: opts.url || '',
      x: Math.max(70, Math.min(vw - 500, 120 + count * 34)),
      y: Math.min(vh - 260, 70 + count * 30),
      w: opts.w || (music ? 340 : 460),
      h: opts.h || (music ? 400 : 340),
      z: ++topZ,
      min: false
    }
    windows.value.push(w)
    return w
  }

  function closeWindow(id: number) {
    windows.value = windows.value.filter(w => w.id !== id)
  }

  function minimise(id: number) {
    const w = windows.value.find(x => x.id === id)
    if (w) w.min = true
  }

  function restore(id: number) {
    const w = windows.value.find(x => x.id === id)
    if (w) { w.min = false; bringFront(id) }
  }

  return { windows, openWindow, closeWindow, minimise, restore, bringFront }
}
