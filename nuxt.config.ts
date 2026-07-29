export default defineNuxtConfig({
  srcDir: 'app/',

  // Registers @nuxt/eslint so `nuxt prepare` generates .nuxt/eslint.config.mjs,
  // which eslint.config.mjs imports. Without this, `pnpm lint` cannot resolve it.
  modules: ['@nuxt/eslint'],

  // Disable SSR — local desktop app, not a public website.
  // Prevents crashes when browser APIs are accessed during server render.
  ssr: false,

  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
    },
  },

  css: ['~/assets/css/main.css'],
  components: true,
  compatibilityDate: '2024-11-01',
})