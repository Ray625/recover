import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const ready = ref(!isSupabaseConfigured)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const recovering = ref(false)
  const user = computed(() => session.value?.user ?? null)
  let initialized = false
  function redirectUrl() {
    return `${window.location.origin}${window.location.pathname}#/account`
  }
  async function initialize() {
    if (initialized || !supabase) return
    initialized = true
    supabase.auth.onAuthStateChange((event, next) => {
      session.value = next
      ready.value = true
      if (event === 'PASSWORD_RECOVERY') recovering.value = true
      if (event === 'SIGNED_OUT') recovering.value = false
    })
    try {
      const result = await supabase.auth.getSession()
      if (result.error) throw result.error
      session.value = result.data.session
    } catch {
      error.value = '無法載入登入狀態，請重新登入'
    } finally {
      ready.value = true
    }
  }
  async function submit(
    mode: 'login' | 'signup' | 'reset' | 'password',
    email: string,
    password: string,
  ) {
    if (!supabase || busy.value) return false
    error.value = ''
    notice.value = ''
    busy.value = true
    try {
      if (mode === 'login') {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (result.error) throw result.error
      } else if (mode === 'signup') {
        const result = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUrl() },
        })
        if (result.error) throw result.error
        if (!result.data.session) notice.value = '請至信箱確認註冊'
      } else if (mode === 'reset') {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl(),
        })
        if (result.error) throw result.error
        notice.value = '若帳戶存在，將收到重設密碼信件'
      } else {
        const result = await supabase.auth.updateUser({ password })
        if (result.error) throw result.error
        recovering.value = false
        notice.value = '密碼已更新'
      }
      return true
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : ''
      error.value =
        code === 'invalid_credentials'
          ? 'Email 或密碼不正確'
          : code === 'email_not_confirmed'
            ? '請先確認 Email'
            : code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit'
              ? '操作過於頻繁，請稍後再試'
              : '操作失敗，請確認資料與網路後再試'
      return false
    } finally {
      busy.value = false
    }
  }
  async function signOut() {
    if (!supabase || busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const result = await supabase.auth.signOut({ scope: 'local' })
      if (result.error) throw result.error
      session.value = null
      return true
    } catch {
      error.value = '登出失敗，請稍後再試'
      return false
    } finally {
      busy.value = false
    }
  }
  return { session, user, ready, busy, error, notice, recovering, initialize, submit, signOut }
})
