export default defineNuxtConfig({
  srcDir: 'app/',

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