export default defineNuxtConfig({
  srcDir: 'app/',

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
