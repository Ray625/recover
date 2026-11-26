<script setup lang="ts">
import { computed, ref } from 'vue'
import FixedModal from '@/components/common/FixedModal.vue'
import { useFitnessStore } from '@/stores/fitness'
import { localDate, type Workout } from '@/domain/fitness'
import { createId } from '@/utils/id'
const props = defineProps<{ source?: Workout; copy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useFitnessStore()
const source = props.source
const date = ref(props.copy ? localDate() : (source?.date ?? store.selectedDate))
const exerciseId = ref(source?.exerciseId ?? store.data.exercises[0]?.id ?? '')
const originalExercise = store.data.exercises.find((e) => e.id === exerciseId.value)
const categoryId = ref(originalExercise?.categoryId ?? store.data.categories[0]?.id ?? '')
const detail = ref(source?.mode === 'detailed')
const weightMode = ref<'each' | 'total'>(source?.weightMode ?? 'each')
const weight = ref<number | string>(source?.weight ?? 10)
const count = ref<number | string>(source?.count ?? 3)
const sets = ref<{ weight: number | string; reps: number | string }[]>(
  source?.sets.map((s) => ({ ...s })) ?? [],
)
const exercises = computed(() =>
  store.data.exercises.filter((e) => e.categoryId === categoryId.value),
)
const historical = computed(
  () => !!source && !store.data.exercises.some((e) => e.id === source.exerciseId),
)
const unchanged = computed(() => !!source && source.exerciseId === exerciseId.value)
const error = ref('')
const adding = ref<'category' | 'exercise' | null>(null)
const newName = ref('')
function switchDetail(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  if (checked && !sets.value.length)
    sets.value = Array.from(
      { length: Math.min(1000, Math.max(1, Number(count.value) || 1)) },
      () => ({ weight: weight.value, reps: '' }),
    )
  if (!checked && sets.value.length) {
    weight.value = sets.value[0]!.weight
    count.value = sets.value.length
  }
  detail.value = checked
}
function addInline() {
  const name = newName.value.trim()
  if (!name) return
  const id = createId()
  if (adding.value === 'category') {
    if (!store.mutate((d) => d.categories.push({ id, name, color: '#c88c68' }))) return
    categoryId.value = id
    exerciseId.value = ''
  } else {
    if (!categoryId.value) {
      error.value = '請先新增分類'
      return
    }
    if (!store.mutate((d) => d.exercises.push({ id, name, categoryId: categoryId.value }))) return
    exerciseId.value = id
  }
  adding.value = null
  newName.value = ''
}
function save() {
  error.value = ''
  const exercise = store.data.exercises.find((e) => e.id === exerciseId.value)
  const category = store.data.categories.find((c) => c.id === exercise?.categoryId)
  if (!exercise && !unchanged.value) {
    error.value = '請選擇動作'
    return
  }
  const now = new Date().toISOString()
  // Existing records and their copies retain historical names until a different exercise is selected.
  const snapshot = unchanged.value
    ? {
        exerciseName: source!.exerciseName,
        categoryName: source!.categoryName,
        categoryColor: source!.categoryColor,
      }
    : { exerciseName: exercise!.name, categoryName: category!.name, categoryColor: category!.color }
  const rows = detail.value
    ? sets.value.map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
    : []
  const workout: Workout = {
    id: source && !props.copy ? source.id : createId(),
    date: date.value,
    exerciseId: exerciseId.value,
    ...snapshot,
    mode: detail.value ? 'detailed' : 'simple',
    weightMode: weightMode.value,
    weight: detail.value ? (rows[0]?.weight ?? 0) : Number(weight.value),
    count: detail.value ? rows.length : Number(count.value),
    sets: rows,
    completed: source && !props.copy ? source.completed : true,
    createdAt: source && !props.copy ? source.createdAt : now,
    updatedAt: now,
  }
  if (!store.saveWorkout(workout)) {
    error.value = store.error
    return
  }
  store.selectedDate = date.value
  store.message = '已儲存'
  emit('close')
}
</script>
<template>
  <FixedModal
    panel-tag="form"
    :label="source && !copy ? '編輯紀錄' : '新增紀錄'"
    :close-on-backdrop="false"
    @close="emit('close')"
    @submit="save"
  >
    <template #header
      ><h2>{{ source && !copy ? '編輯紀錄' : '新增紀錄' }}</h2>
      <button type="button" class="icon-button" aria-label="關閉" @click="emit('close')">
        ×
      </button></template
    >
    <template #body>
      <label class="field"
        >日期<input v-model="date" type="date" required min="1900-01-01" max="9999-12-31"
      /></label>
      <div class="field">
        <div class="row between">
          <label for="workout-category">分類</label
          ><button type="button" class="text-button" @click="adding = 'category'">新增分類</button>
        </div>
        <select
          id="workout-category"
          v-model="categoryId"
          @change="exerciseId = exercises[0]?.id ?? ''"
        >
          <option v-for="c in store.data.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="field">
        <div class="row between">
          <label for="workout-exercise">動作</label
          ><button type="button" class="text-button" @click="adding = 'exercise'">新增動作</button>
        </div>
        <select id="workout-exercise" v-model="exerciseId" required>
          <option v-if="historical" :value="source!.exerciseId">{{ source!.exerciseName }}</option>
          <option v-for="e in exercises" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
      </div>
      <div v-if="adding" class="card stack">
        <label class="field"
          >{{ adding === 'category' ? '分類名稱' : '動作名稱'
          }}<input v-model="newName" maxlength="80"
        /></label>
        <div class="row">
          <button type="button" class="ui-button ui-button--primary" @click="addInline">新增</button
          ><button type="button" class="ui-button ui-button--secondary" @click="adding = null">
            取消
          </button>
        </div>
      </div>
      <label class="row detail-toggle"
        ><input type="checkbox" :checked="detail" @change="switchDetail" />逐組詳細紀錄</label
      >
      <div class="weight-heading">
        <div class="weight-label-group">
          <label v-if="!detail" for="workout-weight">重量(kg)</label>
          <span v-else>重量(kg)</span>
          <div class="weight-mode-toggle" role="group" aria-label="重量方式">
            <button
              type="button"
              :aria-pressed="weightMode === 'total'"
              @click="weightMode = 'total'"
            >
              總重
            </button>
            <button
              type="button"
              :aria-pressed="weightMode === 'each'"
              @click="weightMode = 'each'"
            >
              各重
            </button>
          </div>
        </div>
        <label v-if="!detail" for="workout-count">組數</label>
        <span v-else>次數</span>
      </div>
      <div v-if="!detail" class="two-fields">
        <input
          id="workout-weight"
          v-model="weight"
          type="number"
          min="0"
          max="10000"
          step="any"
          required
          inputmode="decimal"
        />
        <input
          id="workout-count"
          v-model="count"
          type="number"
          min="1"
          max="1000"
          required
          inputmode="numeric"
        />
      </div>
      <div v-else class="stack">
        <div v-for="(set, i) in sets" :key="i" class="set-row">
          <label class="field"
            ><span class="sr-only">重量(kg)</span
            ><input
              v-model="set.weight"
              :aria-label="`第 ${i + 1} 組重量`"
              type="number"
              min="0"
              max="10000"
              step="any"
              required
              inputmode="decimal"
          /></label>
          <label class="field"
            ><span class="sr-only">次數</span
            ><input
              v-model="set.reps"
              :aria-label="`第 ${i + 1} 組次數`"
              type="number"
              min="1"
              max="1000"
              required
              inputmode="numeric"
          /></label>
          <button
            type="button"
            class="icon-button"
            :aria-label="`刪除第 ${i + 1} 組`"
            :disabled="sets.length === 1"
            @click="sets.splice(i, 1)"
          >
            ×
          </button>
        </div>
        <button
          type="button"
          class="ui-button ui-button--secondary"
          :disabled="sets.length >= 1000"
          @click="sets.push({ ...sets[sets.length - 1]! })"
        >
          ＋ 新增一組
        </button>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
    </template>
    <template #footer
      ><button type="submit" class="ui-button ui-button--primary">儲存</button></template
    >
  </FixedModal>
</template>
<style scoped>
.text-button {
  border: 0;
  background: none;
  color: var(--color-primary);
  padding: 6px 0;
  font-size: 0.8rem;
}
.detail-toggle {
  padding: 4px 0;
  font-size: 0.9rem;
}
.weight-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}
.weight-label-group {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.weight-mode-toggle {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-border);
}
.weight-mode-toggle button {
  border: 0;
  padding: 4px 9px;
  border-radius: 5px;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: 0.75rem;
  white-space: nowrap;
}
.weight-mode-toggle button[aria-pressed='true'] {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.set-row {
  display: grid;
  grid-template-columns: minmax(0, calc(50% - 6px)) minmax(0, 1fr) 32px;
  gap: 12px;
  align-items: end;
}
.set-row .icon-button {
  width: 32px;
  height: 46px;
}
</style>
