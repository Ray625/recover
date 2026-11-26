import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  initialData,
  localDate,
  validateData,
  type FitnessData,
  type Workout,
} from '@/domain/fitness'
import { sameFitnessData, validatePendingWrite, type PendingWrite } from '@/domain/fitnessSync'
import { mergeGuestData } from '@/domain/mergeFitness'
import { createId } from '@/utils/id'
import { useAuthStore } from './auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cloudRepository, SyncConflict } from '@/services/fitnessCloud'

const KEY = 'fitness-log:v1'
interface Cache {
  data: FitnessData
  revision: number
  dirty: boolean
  pendingWrite?: PendingWrite | null
  lastSynced?: string
}
export const useFitnessStore = defineStore('fitness', () => {
  const auth = useAuthStore()
  const error = ref('')
  const syncError = ref('')
  const unreadableBackup = ref<string | null>(null)
  const recoveryBackup = ref<string | null>(null)
  const data = ref<FitnessData>(initialData())
  const ownerId = ref<string | null>(null)
  const dirty = ref(false)
  const syncing = ref(false)
  const loading = ref(false)
  const conflict = ref(false)
  const lastSynced = ref('')
  const online = ref(navigator.onLine)
  const accountLoaded = ref(false)
  const restoringCloud = ref(false)
  const selectedDate = ref(localDate())
  const message = ref('')
  const dayWorkouts = computed(() =>
    data.value.workouts.filter((w) => w.date === selectedDate.value),
  )
  let revision = 0
  let generation = 0
  let running: Promise<void> | null = null
  let debounce: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retryCount = 0
  let pendingWrite: PendingWrite | null = null
  const storageKey = () => (ownerId.value ? `${KEY}:account:${ownerId.value}` : KEY)
  const scopeReady = computed(
    () =>
      (!isSupabaseConfigured || auth.ready) &&
      !loading.value &&
      !restoringCloud.value &&
      (!ownerId.value || accountLoaded.value),
  )
  const canWrite = computed(() => scopeReady.value && unreadableBackup.value === null)
  const syncStatus = computed(() => {
    if (!ownerId.value) return '本機模式'
    if (unreadableBackup.value !== null) return '本機資料異常'
    if (conflict.value) return '版本衝突'
    if (!online.value) return dirty.value ? '離線，待同步' : '離線'
    if (syncing.value || loading.value) return '同步中'
    if (syncError.value) return dirty.value ? '同步失敗，變更已保留' : '同步失敗'
    if (dirty.value) return '待同步'
    return lastSynced.value ? '已同步' : '尚無雲端紀錄'
  })
  function persist(
    next: FitnessData,
    nextRevision: number,
    nextDirty: boolean,
    nextPending = pendingWrite,
    syncedAt = lastSynced.value,
  ) {
    localStorage.setItem(
      storageKey(),
      JSON.stringify(
        ownerId.value
          ? {
              data: next,
              revision: nextRevision,
              dirty: nextDirty,
              pendingWrite: nextPending,
              lastSynced: syncedAt,
            }
          : next,
      ),
    )
  }
  function hydrate() {
    unreadableBackup.value = null
    recoveryBackup.value = null
    data.value = initialData()
    revision = 0
    dirty.value = false
    pendingWrite = null
    lastSynced.value = ''
    let found = false
    try {
      const raw = localStorage.getItem(storageKey())
      if (raw) {
        unreadableBackup.value = raw
        if (ownerId.value) {
          const cache = JSON.parse(raw) as Cache
          if (
            !Number.isSafeInteger(cache.revision) ||
            cache.revision < 0 ||
            typeof cache.dirty !== 'boolean'
          )
            throw new Error('快取格式錯誤')
          data.value = validateData(cache.data)
          revision = cache.revision
          dirty.value = cache.dirty
          pendingWrite = validatePendingWrite(cache.pendingWrite)
          if (pendingWrite && (!cache.dirty || pendingWrite.baseRevision !== cache.revision))
            throw new Error('待同步版本不一致')
          lastSynced.value =
            typeof cache.lastSynced === 'string' && !Number.isNaN(Date.parse(cache.lastSynced))
              ? cache.lastSynced
              : ''
        } else data.value = validateData(JSON.parse(raw))
        unreadableBackup.value = null
        found = true
      }
      if (ownerId.value) recoveryBackup.value = localStorage.getItem(`${storageKey()}:recovery`)
    } catch {
      error.value = '本機資料無法讀取，已停止儲存。請先匯出，再匯入有效備份。'
    }
    return found
  }
  hydrate()
  function queueSync() {
    clearTimeout(debounce)
    if (ownerId.value && !conflict.value)
      debounce = setTimeout(() => {
        void synchronize()
      }, 300)
  }
  function commit(next: FitnessData, restoring = false): boolean {
    if (!scopeReady.value) {
      error.value = '正在載入帳戶資料，請稍候'
      return false
    }
    if (unreadableBackup.value !== null && !restoring) {
      error.value = '請先匯出原始資料，再匯入有效備份'
      return false
    }
    try {
      validateData(next)
      if (restoring && ownerId.value) preserveRecovery()
      persist(next, revision, Boolean(ownerId.value))
      data.value = next
      unreadableBackup.value = null
      error.value = ''
      if (ownerId.value) {
        dirty.value = true
        queueSync()
      }
      return true
    } catch {
      error.value = '儲存失敗，請確認資料或匯出備份'
      return false
    }
  }
  function mutate(action: (draft: FitnessData) => void): boolean {
    const next = JSON.parse(JSON.stringify(data.value)) as FitnessData
    action(next)
    return commit(next)
  }
  function saveWorkout(workout: Workout): boolean {
    return mutate((d) => {
      const i = d.workouts.findIndex((w) => w.id === workout.id)
      if (i < 0) d.workouts.push(workout)
      else d.workouts[i] = workout
    })
  }
  function toggle(workout: Workout) {
    saveWorkout({ ...workout, completed: !workout.completed, updatedAt: new Date().toISOString() })
  }
  function copyDay(source: string, target: string): boolean {
    const now = new Date().toISOString()
    const copies = data.value.workouts
      .filter((w) => w.date === source)
      .map((w) => ({
        ...JSON.parse(JSON.stringify(w)),
        id: createId(),
        date: target,
        completed: false,
        createdAt: now,
        updatedAt: now,
      })) as Workout[]
    if (!copies.length || !mutate((d) => d.workouts.push(...copies))) return false
    selectedDate.value = target
    message.value = '已複製'
    return true
  }
  function scheduleRetry(epoch: number) {
    clearTimeout(retryTimer)
    if (
      epoch !== generation ||
      !ownerId.value ||
      conflict.value ||
      unreadableBackup.value !== null ||
      !online.value ||
      document.hidden
    )
      return
    const delay = Math.min(30000, 1000 * 2 ** Math.min(retryCount++, 5))
    retryTimer = setTimeout(() => {
      void synchronize()
    }, delay)
  }
  function acceptSaved(remote: { data: FitnessData; revision: number }) {
    const nextDirty = !sameFitnessData(data.value, remote.data)
    const syncedAt = new Date().toISOString()
    // Persist the acknowledgement before clearing dirty state in memory.
    persist(data.value, remote.revision, nextDirty, null, syncedAt)
    revision = remote.revision
    pendingWrite = null
    accountLoaded.value = true
    dirty.value = nextDirty
    lastSynced.value = syncedAt
  }
  async function performSync(epoch: number) {
    const owner = ownerId.value
    const token = auth.session?.access_token
    if (
      !owner ||
      auth.user?.id !== owner ||
      !token ||
      unreadableBackup.value !== null ||
      conflict.value ||
      restoringCloud.value
    )
      return
    if (!online.value) {
      loading.value = false
      return
    }
    syncing.value = true
    syncError.value = ''
    const repository = cloudRepository(token, owner)
    let needsRetry = false
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const remote = await repository.load()
        if (epoch !== generation) return
        if (
          pendingWrite &&
          remote &&
          remote.revision === pendingWrite.baseRevision + 1 &&
          sameFitnessData(remote.data, pendingWrite.data)
        ) {
          // The server saved a previous request whose response was lost.
          acceptSaved(remote)
          if (dirty.value) continue
          break
        }
        if (dirty.value) {
          if ((remote?.revision ?? 0) !== revision) throw new SyncConflict()
          if (!pendingWrite) {
            const pending: PendingWrite = {
              baseRevision: revision,
              data: JSON.parse(JSON.stringify(data.value)) as FitnessData,
            }
            persist(data.value, revision, true, pending)
            pendingWrite = pending
          }
          let saved
          try {
            saved = await repository.save(pendingWrite.data, pendingWrite.baseRevision)
          } catch (e) {
            // Reload once more to distinguish a lost acknowledgement from a real competing write.
            if (e instanceof SyncConflict) continue
            throw e
          }
          if (epoch !== generation) return
          acceptSaved(saved)
          if (dirty.value) continue
        } else if (remote) {
          const syncedAt = new Date().toISOString()
          persist(remote.data, remote.revision, false, null, syncedAt)
          data.value = remote.data
          accountLoaded.value = true
          revision = remote.revision
          pendingWrite = null
          lastSynced.value = syncedAt
        } else if (revision > 0) {
          throw new SyncConflict('雲端資料已不存在，本機副本已保留')
        } else {
          persist(data.value, 0, false, null)
          accountLoaded.value = true
        }
        break
      }
      retryCount = 0
      needsRetry = dirty.value
    } catch (e) {
      if (epoch !== generation) return
      if (e instanceof SyncConflict) {
        conflict.value = true
        syncError.value = e.message || '雲端已有新版本，本機變更已保留'
      } else {
        const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : ''
        syncError.value = ['42P01', 'PGRST202', 'PGRST205'].includes(code)
          ? '尚未建立 Supabase 資料表或同步函式'
          : '同步失敗，本機變更已保留，將自動重試'
        needsRetry = true
      }
    } finally {
      if (epoch === generation) {
        syncing.value = false
        loading.value = false
        if (needsRetry) scheduleRetry(epoch)
      }
    }
  }
  function synchronize(): Promise<void> {
    if (running) return running
    clearTimeout(retryTimer)
    const task = performSync(generation)
    running = task
    void task.finally(() => {
      if (running === task) running = null
    })
    return task
  }
  watch(
    [() => auth.ready, () => auth.user?.id ?? null] as const,
    ([ready, id]) => {
      if (!ready) return
      generation++
      clearTimeout(debounce)
      clearTimeout(retryTimer)
      retryCount = 0
      running = null
      ownerId.value = id
      error.value = ''
      syncError.value = ''
      conflict.value = false
      syncing.value = false
      restoringCloud.value = false
      lastSynced.value = ''
      const cached = hydrate()
      accountLoaded.value = !id || cached
      loading.value = Boolean(id && !cached && unreadableBackup.value === null)
      if (id) void synchronize()
    },
    { immediate: true },
  )
  function readGuest(): FitnessData | null {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? validateData(JSON.parse(raw)) : null
    } catch {
      return null
    }
  }
  const hasGuestData = computed(() => {
    // Owner changes invalidate this computed; guest storage itself remains untouched by account sync.
    if (!ownerId.value) return false
    const guest = readGuest()
    return Boolean(guest && JSON.stringify(guest) !== JSON.stringify(initialData()))
  })
  function importGuest() {
    if (!ownerId.value || loading.value || conflict.value) return false
    const guest = readGuest()
    if (!guest) {
      error.value = '沒有可匯入的本機資料'
      return false
    }
    try {
      return commit(mergeGuestData(data.value, guest))
    } catch {
      error.value = '無法合併本機紀錄'
      return false
    }
  }
  function preserveRecovery() {
    const backup = unreadableBackup.value ?? JSON.stringify(data.value)
    localStorage.setItem(`${storageKey()}:recovery:${Date.now()}`, backup)
    localStorage.setItem(`${storageKey()}:recovery`, backup)
    recoveryBackup.value = backup
    return backup
  }
  async function loadCloud() {
    const owner = ownerId.value
    const token = auth.session?.access_token
    if (!owner || !token || syncing.value) return false
    const epoch = generation
    syncing.value = true
    restoringCloud.value = true
    syncError.value = ''
    try {
      const remote = await cloudRepository(token, owner).load()
      if (epoch !== generation) return false
      if (!remote) throw new Error('尚無雲端資料')
      const backup = preserveRecovery()
      const syncedAt = new Date().toISOString()
      persist(remote.data, remote.revision, false, null, syncedAt)
      pendingWrite = null
      accountLoaded.value = true
      recoveryBackup.value = backup
      data.value = remote.data
      revision = remote.revision
      dirty.value = false
      conflict.value = false
      unreadableBackup.value = null
      error.value = ''
      lastSynced.value = new Date().toISOString()
      return true
    } catch {
      if (epoch === generation) syncError.value = '無法載入雲端資料，本機資料未變更'
      return false
    } finally {
      if (epoch === generation) {
        syncing.value = false
        restoringCloud.value = false
      }
    }
  }
  const syncWhenVisible = () => {
    if (!document.hidden && ownerId.value) void synchronize()
  }
  const onOnline = () => {
    online.value = true
    retryCount = 0
    syncWhenVisible()
  }
  const onOffline = () => {
    online.value = false
    clearTimeout(retryTimer)
  }
  const protectPendingChanges = (event: BeforeUnloadEvent) => {
    if (ownerId.value && dirty.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  window.addEventListener('focus', syncWhenVisible)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('beforeunload', protectPendingChanges)
  document.addEventListener('visibilitychange', syncWhenVisible)
  const refreshTimer = setInterval(syncWhenVisible, 30000)
  onScopeDispose(() => {
    generation++
    clearTimeout(debounce)
    clearTimeout(retryTimer)
    clearInterval(refreshTimer)
    window.removeEventListener('focus', syncWhenVisible)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('beforeunload', protectPendingChanges)
    document.removeEventListener('visibilitychange', syncWhenVisible)
  })
  return {
    data,
    unreadableBackup,
    recoveryBackup,
    error,
    message,
    selectedDate,
    dayWorkouts,
    commit,
    mutate,
    saveWorkout,
    toggle,
    copyDay,
    ownerId,
    dirty,
    syncing,
    loading,
    canWrite,
    syncStatus,
    syncError,
    conflict,
    lastSynced,
    online,
    hasGuestData,
    synchronize,
    importGuest,
    loadCloud,
  }
})
