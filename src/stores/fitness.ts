import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  initialData,
  localDate,
  validateData,
  type FitnessData,
  type Workout,
} from '@/domain/fitness'
import { createId } from '@/utils/id'

const KEY = 'fitness-log:v1'
export const useFitnessStore = defineStore('fitness', () => {
  const error = ref('')
  const unreadableBackup = ref<string | null>(null)
  let initial = initialData()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      unreadableBackup.value = raw
      initial = validateData(JSON.parse(raw))
      unreadableBackup.value = null
    }
  } catch {
    error.value = '本機資料無法讀取，已停止儲存。請先匯出，再匯入有效備份。'
  }
  const data = ref<FitnessData>(initial)
  const selectedDate = ref(localDate())
  const dayWorkouts = computed(() =>
    data.value.workouts.filter((w) => w.date === selectedDate.value),
  )
  const message = ref('')
  function commit(next: FitnessData, restoring = false): boolean {
    if (unreadableBackup.value !== null && !restoring) {
      error.value = '請先匯出原始資料，再匯入有效備份'
      return false
    }
    try {
      validateData(next)
      localStorage.setItem(KEY, JSON.stringify(next))
      data.value = next
      unreadableBackup.value = null
      error.value = ''
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '儲存失敗，請匯出備份'
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
    if (!copies.length) return false
    if (!mutate((d) => d.workouts.push(...copies))) return false
    selectedDate.value = target
    message.value = '已複製'
    return true
  }
  return {
    data,
    unreadableBackup,
    error,
    message,
    selectedDate,
    dayWorkouts,
    commit,
    mutate,
    saveWorkout,
    toggle,
    copyDay,
  }
})
