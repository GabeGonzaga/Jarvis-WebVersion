<script setup lang="ts">
import { onMounted, watch } from 'vue'

const themeMode = useState<'system' | 'dark' | 'light'>('ui_theme_mode', () => 'system')
const language = useState<string>('ui_language', () => 'en-GB')

useHead({ htmlAttrs: { lang: language } })

function resolveTheme(mode: 'system' | 'dark' | 'light'): 'dark' | 'light' {
  if (!import.meta.client) return 'dark'
  if (mode === 'dark' || mode === 'light') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme() {
  if (!import.meta.client) return
  document.documentElement.dataset.theme = resolveTheme(themeMode.value)
}

function applyLanguage() {
  if (!import.meta.client) return
  document.documentElement.lang = language.value
}

// Watch OUTSIDE onMounted — this is the fix.
// Previously the watch was inside onMounted which caused a timing
// issue: the watcher wasn't registered until after mount, so
// changes from the <select> could fire before it was alive.
// { immediate: true } also applies the theme on first render.
watch(themeMode, (v) => {
  if (!import.meta.client) return
  localStorage.setItem('jarvis_theme', v)
  applyTheme()
}, { immediate: true })

watch(language, (v) => {
  if (!import.meta.client) return
  localStorage.setItem('jarvis_lang', v)
  applyLanguage()
}, { immediate: true })

onMounted(() => {
  // Restore saved preferences from localStorage on first load
  const savedTheme = localStorage.getItem('jarvis_theme')
  if (savedTheme === 'system' || savedTheme === 'dark' || savedTheme === 'light') {
    themeMode.value = savedTheme  // this triggers the watch above
  }

  const savedLang = localStorage.getItem('jarvis_lang')
  if (savedLang) language.value = savedLang

  // React to OS-level dark/light changes when in "system" mode
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => { if (themeMode.value === 'system') applyTheme() }
  mq.addEventListener('change', onChange)
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>