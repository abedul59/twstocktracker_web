export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],
  supabase: {
    redirect: false // 停用預設的身份驗證重導向
  }
})