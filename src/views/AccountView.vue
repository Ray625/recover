<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useFitnessStore } from '@/stores/fitness'
import { isSupabaseConfigured } from '@/lib/supabase'
import { localDate } from '@/domain/fitness'
const auth = useAuthStore()
const fitness = useFitnessStore()
const mode = ref<'login' | 'signup' | 'reset'>('login')
const email = ref('')
const password = ref('')
const confirmation = ref<'import' | 'cloud' | 'logout'>()
watch(
  () => auth.user?.id,
  () => {
    confirmation.value = undefined
    password.value = ''
  },
)
const lastSyncedText = computed(() =>
  fitness.lastSynced
    ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(fitness.lastSynced),
      )
    : '',
)
const actionLabel = computed(() =>
  auth.recovering
    ? '更新密碼'
    : mode.value === 'signup'
      ? '註冊'
      : mode.value === 'reset'
        ? '寄送重設連結'
        : '登入',
)
async function submit() {
  const ok = await auth.submit(
    auth.recovering ? 'password' : mode.value,
    email.value,
    password.value,
  )
  if (ok) password.value = ''
}
function switchMode(next: typeof mode.value) {
  mode.value = next
  password.value = ''
  auth.error = ''
  auth.notice = ''
}
async function signOut() {
  await fitness.synchronize()
  if (fitness.dirty) confirmation.value = 'logout'
  else await auth.signOut()
}
async function confirm() {
  const action = confirmation.value
  confirmation.value = undefined
  if (action === 'import') {
    if (fitness.importGuest()) {
      await fitness.synchronize()
      fitness.message = fitness.dirty ? '已加入，待同步' : '已匯入'
    }
  }
  if (action === 'cloud') {
    if (await fitness.loadCloud()) fitness.message = '已載入雲端資料'
  }
  if (action === 'logout') await auth.signOut()
}
function exportRecovery() {
  if (!fitness.recoveryBackup) return
  const url = URL.createObjectURL(new Blob([fitness.recoveryBackup], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `fitness-recovery-${localDate()}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>
<template>
  <div class="stack account-page">
    <PageHeader title="帳戶" />
    <section v-if="!isSupabaseConfigured" class="card empty">雲端連線尚未設定</section>
    <section v-else-if="!auth.ready" class="card empty" role="status">載入中</section>
    <template v-else>
      <section v-if="auth.user && !auth.recovering" class="card stack">
        <p class="account-email">{{ auth.user.email }}</p>
        <div class="row between">
          <h2>資料同步</h2>
          <span class="muted">自動同步</span>
        </div>
        <div class="row between">
          <span class="muted" role="status" aria-live="polite">{{ fitness.syncStatus }}</span
          ><button
            type="button"
            class="ui-button ui-button--secondary"
            :disabled="fitness.syncing || fitness.loading || fitness.conflict || !fitness.online"
            @click="fitness.synchronize"
          >
            同步
          </button>
        </div>
        <p v-if="lastSyncedText" class="muted">最後同步：{{ lastSyncedText }}</p>
        <p v-if="fitness.syncError" class="error" role="alert">{{ fitness.syncError }}</p>
        <button
          v-if="fitness.hasGuestData"
          type="button"
          class="ui-button ui-button--secondary"
          :disabled="!fitness.canWrite || fitness.conflict"
          @click="confirmation = 'import'"
        >
          匯入本機紀錄
        </button>
        <button
          v-if="fitness.conflict || fitness.unreadableBackup"
          type="button"
          class="ui-button ui-button--secondary"
          :disabled="fitness.syncing"
          @click="confirmation = 'cloud'"
        >
          載入雲端版本
        </button>
        <button
          v-if="fitness.recoveryBackup"
          type="button"
          class="ui-button ui-button--secondary"
          @click="exportRecovery"
        >
          匯出同步前備份
        </button>
        <button
          type="button"
          class="ui-button ui-button--secondary"
          :disabled="auth.busy || fitness.syncing"
          @click="signOut"
        >
          登出
        </button>
      </section>
      <form v-else class="card stack" :aria-label="actionLabel" @submit.prevent="submit">
        <label v-if="!auth.recovering" class="field"
          >Email<input v-model="email" type="email" autocomplete="email" required
        /></label>
        <label v-if="auth.recovering || mode !== 'reset'" class="field"
          >密碼<input
            v-model="password"
            type="password"
            :autocomplete="
              mode === 'signup' || auth.recovering ? 'new-password' : 'current-password'
            "
            :minlength="mode === 'login' && !auth.recovering ? 1 : 8"
            required
        /></label>
        <button type="submit" class="ui-button ui-button--primary" :disabled="auth.busy">
          {{ auth.busy ? '處理中' : actionLabel }}
        </button>
        <div v-if="!auth.recovering" class="row between account-actions">
          <button type="button" @click="switchMode(mode === 'login' ? 'signup' : 'login')">
            {{ mode === 'login' ? '註冊帳戶' : '返回登入' }}
          </button>
          <button v-if="mode === 'login'" type="button" @click="switchMode('reset')">
            忘記密碼
          </button>
        </div>
      </form>
      <p v-if="auth.error" class="error" role="alert">{{ auth.error }}</p>
      <p v-if="auth.notice" class="muted" role="status">{{ auth.notice }}</p>
    </template>
    <ConfirmDialog
      v-if="confirmation"
      :title="
        confirmation === 'import'
          ? '匯入本機紀錄'
          : confirmation === 'cloud'
            ? '載入雲端版本'
            : '登出'
      "
      :message="
        confirmation === 'import'
          ? '將本機紀錄加入此帳戶？'
          : confirmation === 'cloud'
            ? '本機版本會先保留備份，再載入雲端資料。'
            : '尚有待同步資料，登出後會保留在此裝置。'
      "
      @cancel="confirmation = undefined"
      @confirm="confirm"
    />
  </div>
</template>
<style scoped>
.account-email {
  overflow-wrap: anywhere;
  font-weight: 600;
  font-size: 0.9rem;
}
.account-actions button {
  border: 0;
  padding: 6px 0;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.8rem;
}
</style>
