<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFitnessStore } from '@/stores/fitness'
import { localDate, type Workout } from '@/domain/fitness'
import ActionMenu from '@/components/common/ActionMenu.vue'
import FixedModal from '@/components/common/FixedModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import WorkoutEditor from '@/components/fitness/WorkoutEditor.vue'
const store = useFitnessStore()
const month = ref(store.selectedDate.slice(0, 7))
watch(
  () => store.selectedDate,
  (v) => (month.value = v.slice(0, 7)),
)
const monthTitle = computed(
  () => `${Number(month.value.slice(0, 4))} 年 ${Number(month.value.slice(5))} 月`,
)
const days = computed(() => {
  const first = new Date(`${month.value}-01T12:00:00`)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return localDate(d)
  })
})
const marked = computed(() => new Set(store.data.workouts.map((w) => w.date)))
const completed = computed(() => store.dayWorkouts.filter((w) => w.completed).length)
const editing = ref<Workout>()
const copying = ref(false)
const deleting = ref<Workout>()
const copyOpen = ref(false)
const copyTarget = ref(localDate())
const copySource = ref('')
function goToday() {
  store.selectedDate = localDate()
  month.value = localDate().slice(0, 7)
}
function moveMonth(delta: number) {
  const d = new Date(`${month.value}-01T12:00:00`)
  d.setMonth(d.getMonth() + delta)
  month.value = localDate(d).slice(0, 7)
}
function openCopy() {
  copySource.value = store.selectedDate
  copyTarget.value = localDate()
  copyOpen.value = true
}
function copyDay() {
  if (store.copyDay(copySource.value, copyTarget.value)) copyOpen.value = false
}
function edit(w: Workout, copy = false) {
  editing.value = w
  copying.value = copy
}
function remove() {
  if (
    store.mutate((d) => {
      d.workouts = d.workouts.filter((w) => w.id !== deleting.value?.id)
    })
  ) {
    deleting.value = undefined
    store.message = '已刪除'
  }
}
</script>
<template>
  <div class="stack calendar-page">
    <header class="row between">
      <div>
        <p class="eyebrow">TRAINING JOURNAL</p>
        <h1>訓練日誌</h1>
      </div>
      <button class="today" type="button" @click="goToday">今日</button>
    </header>
    <section class="calendar card" aria-label="訓練日曆">
      <div class="row between month-header">
        <h2>{{ monthTitle }}</h2>
        <div class="row">
          <button type="button" class="icon-button" aria-label="上個月" @click="moveMonth(-1)">
            ‹</button
          ><button type="button" class="icon-button" aria-label="下個月" @click="moveMonth(1)">
            ›
          </button>
        </div>
      </div>
      <div class="calendar-grid weekdays">
        <span v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day">{{ day }}</span>
      </div>
      <div class="calendar-grid">
        <button
          v-for="day in days"
          :key="day"
          type="button"
          class="day"
          :class="{
            selected: day === store.selectedDate,
            other: !day.startsWith(month),
            today: day === localDate(),
          }"
          :aria-label="day"
          :aria-pressed="day === store.selectedDate"
          :aria-current="day === localDate() ? 'date' : undefined"
          @click="store.selectedDate = day"
        >
          <span>{{ Number(day.slice(-2)) }}</span
          ><i v-if="marked.has(day)" aria-label="有紀錄"></i>
        </button>
      </div>
    </section>
    <section class="stack" aria-label="當日紀錄">
      <div class="row between">
        <div>
          <h2>
            {{ Number(store.selectedDate.slice(5, 7)) }} 月
            {{ Number(store.selectedDate.slice(8)) }} 日
            <span class="muted">{{ store.selectedDate === localDate() ? '・今天' : '' }}</span>
          </h2>
          <p class="muted progress">{{ completed }} / {{ store.dayWorkouts.length }} 項完成</p>
        </div>
        <ActionMenu
          label="當日選單"
          :items="[{ label: '複製課表', action: openCopy, disabled: !store.dayWorkouts.length }]"
        />
      </div>
      <div v-if="!store.dayWorkouts.length" class="card empty">
        <span class="empty-mark" aria-hidden="true">＋</span>
        <p>這天還沒有紀錄</p>
        <p class="muted">點選下方 ＋ 開始記錄</p>
      </div>
      <article
        v-for="w in store.dayWorkouts"
        :key="w.id"
        class="card workout"
        :class="{ 'workout--done': w.completed }"
        data-testid="workout-card"
      >
        <div class="row">
          <input
            type="checkbox"
            :checked="w.completed"
            :aria-label="`完成 ${w.exerciseName}`"
            @change="store.toggle(w)"
          />
          <div class="workout-title">
            <span class="category-label"
              ><i :style="{ background: w.categoryColor }"></i>{{ w.categoryName }}</span
            >
            <h3>{{ w.exerciseName }}</h3>
          </div>
          <ActionMenu
            :label="`${w.exerciseName}選單`"
            :items="[
              { label: '複製', action: () => edit(w, true) },
              { label: '編輯', action: () => edit(w) },
              { label: '刪除', action: () => (deleting = w), danger: true },
            ]"
          />
        </div>
        <div class="workout-details">
          <p v-if="w.mode === 'simple'">
            {{ w.weightMode === 'each' ? '左右各' : '總重' }} {{ w.weight }} kg
            <span class="detail-separator">/</span> {{ w.count }} 組
          </p>
          <template v-else
            ><p class="muted">
              {{ w.weightMode === 'each' ? '左右各重' : '總重' }} · {{ w.count }} 組
            </p>
            <div class="set-chips">
              <span v-for="(set, i) in w.sets" :key="i">{{ set.weight }} kg × {{ set.reps }}</span>
            </div></template
          >
        </div>
      </article>
    </section>
    <WorkoutEditor v-if="editing" :source="editing" :copy="copying" @close="editing = undefined" />
    <FixedModal
      v-if="copyOpen"
      panel-tag="form"
      label="複製課表"
      @close="copyOpen = false"
      @submit="copyDay"
      ><template #header
        ><h2>複製課表</h2>
        <button type="button" class="icon-button" aria-label="關閉" @click="copyOpen = false">
          ×
        </button></template
      ><template #body
        ><label class="field"
          >日期<input
            v-model="copyTarget"
            type="date"
            required
            min="1900-01-01"
            max="9999-12-31" /></label></template
      ><template #footer
        ><button type="submit" class="ui-button ui-button--primary">複製</button></template
      ></FixedModal
    >
    <ConfirmDialog
      v-if="deleting"
      title="刪除紀錄"
      :message="deleting.exerciseName"
      tone="danger"
      confirm-label="刪除"
      @cancel="deleting = undefined"
      @confirm="remove"
    />
  </div>
</template>
<style scoped>
.calendar-page {
  gap: 24px;
}
.eyebrow {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 7px;
}
.today {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 9px 14px;
  font-size: 0.8rem;
}
.calendar {
  padding: 14px 10px;
}
.month-header {
  padding: 0 4px 12px;
}
.month-header h2 {
  font-size: 1rem;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.weekdays {
  color: var(--color-muted);
  font-size: 0.7rem;
  text-align: center;
  margin-bottom: 8px;
}
.day {
  position: relative;
  min-width: 0;
  aspect-ratio: 1;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.85rem;
  display: grid;
  place-items: center;
}
.day.other {
  opacity: 0.35;
}
.day.today {
  font-weight: 800;
  color: var(--color-primary);
}
.day.selected {
  background: var(--color-primary);
  color: var(--color-on-primary);
  opacity: 1;
}
.day i {
  position: absolute;
  bottom: 5px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}
.progress {
  margin-top: 5px;
  font-size: 0.75rem;
}
.empty-mark {
  display: block;
  font-size: 2.2rem;
  opacity: 0.5;
  margin-bottom: 12px;
}
.empty p + p {
  margin-top: 7px;
  font-size: 0.75rem;
}
.workout {
  padding: 14px 12px;
}
.workout-title {
  flex: 1;
  min-width: 0;
}
.workout-title h3 {
  overflow-wrap: anywhere;
  font-size: 0.95rem;
}
.category-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.65rem;
  color: var(--color-muted);
  margin-bottom: 4px;
}
.category-label i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.workout-details {
  padding-left: 31px;
  margin-top: 12px;
  font-size: 0.85rem;
}
.detail-separator {
  color: var(--color-border-strong);
  padding: 0 8px;
}
.set-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.set-chips span {
  padding: 5px 8px;
  border-radius: 7px;
  background: var(--color-primary-light);
  font-size: 0.75rem;
}
.workout--done {
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
}
</style>
