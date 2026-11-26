<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'
import { useFitnessStore } from '@/stores/fitness'
import { localDate, type Workout } from '@/domain/fitness'
import ActionMenu from '@/components/common/ActionMenu.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import HeaderButton from '@/components/common/HeaderButton.vue'
import FixedModal from '@/components/common/FixedModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import WorkoutEditor from '@/components/fitness/WorkoutEditor.vue'
const store = useFitnessStore()
const month = ref(store.selectedDate.slice(0, 7))
const recordsExpanded = ref(false)
const expandButton = ref<HTMLButtonElement>()
const recordsList = ref<HTMLElement>()
const recordsPanel = ref<HTMLElement>()
const recordsAnchor = ref<HTMLElement>()
const recordsAnimating = ref(false)
const placeholderHeight = ref(0)
let panelAnimation: Animation | undefined
let disposed = false
useBodyScrollLock(recordsExpanded)
onBeforeUnmount(() => {
  disposed = true
  panelAnimation?.cancel()
})
async function toggleRecords() {
  if (recordsAnimating.value || !recordsPanel.value || !recordsAnchor.value) return
  recordsAnimating.value = true
  const opening = !recordsExpanded.value
  if (opening) {
    placeholderHeight.value = recordsPanel.value.getBoundingClientRect().height
    recordsExpanded.value = true
    await nextTick()
    if (recordsList.value) recordsList.value.scrollTop = 0
  }
  if (disposed || !recordsPanel.value || !recordsAnchor.value) return
  const padding = parseFloat(getComputedStyle(recordsPanel.value).paddingTop) || 0
  const distance = recordsAnchor.value.getBoundingClientRect().top - padding
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320
  panelAnimation = recordsPanel.value.animate(
    opening
      ? [{ translate: `0 ${distance}px` }, { translate: '0 0' }]
      : [{ translate: '0 0' }, { translate: `0 ${distance}px` }],
    { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
  )
  try {
    await panelAnimation.finished
  } catch {
    /* Page navigation cancels the animation. */
  }
  if (disposed) return
  if (!opening) recordsExpanded.value = false
  await nextTick()
  panelAnimation?.cancel()
  panelAnimation = undefined
  recordsAnimating.value = false
  expandButton.value?.focus({ preventScroll: true })
}
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
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const cellCount = Math.ceil((first.getDay() + last.getDate()) / 7) * 7
  return Array.from({ length: cellCount }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return localDate(d)
  })
})
const marked = computed(() => new Set(store.data.workouts.map((w) => w.date)))
const completed = computed(() => store.dayWorkouts.filter((w) => w.completed).length)
const recordedParts = computed(() => {
  const parts = new Map<string, string>()
  for (const workout of store.dayWorkouts) {
    if (!parts.has(workout.categoryName)) parts.set(workout.categoryName, workout.categoryColor)
  }
  return [...parts].map(([name, color]) => ({ name, color }))
})
const editing = ref<Workout>()
const copying = ref(false)
const deleting = ref<Workout>()
const copyOpen = ref(false)
const copyTarget = ref(localDate())
const copySource = ref('')
const monthPickerOpen = ref(false)
const pickerYear = ref(Number(month.value.slice(0, 4)))
const pickerMonth = ref(Number(month.value.slice(5)))
function openMonthPicker() {
  pickerYear.value = Number(month.value.slice(0, 4))
  pickerMonth.value = Number(month.value.slice(5))
  monthPickerOpen.value = true
}
function selectMonth() {
  const year = Number(pickerYear.value)
  const selectedMonth = Number(pickerMonth.value)
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 9999 ||
    selectedMonth < 1 ||
    selectedMonth > 12
  )
    return
  const lastDay = new Date(year, selectedMonth, 0).getDate()
  const day = Math.min(Number(store.selectedDate.slice(8)), lastDay)
  store.selectedDate = `${year}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  monthPickerOpen.value = false
}
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
    <PageHeader
      title="訓練日誌"
      :inert="recordsExpanded"
      :aria-hidden="recordsExpanded || undefined"
    >
      <template #actions><HeaderButton @click="goToday">今日</HeaderButton></template>
    </PageHeader>
    <section
      class="calendar card"
      aria-label="訓練日曆"
      :inert="recordsExpanded"
      :aria-hidden="recordsExpanded || undefined"
    >
      <div class="row between month-header">
        <button type="button" class="month-trigger" aria-label="切換年月" @click="openMonthPicker">
          {{ monthTitle }} <span aria-hidden="true">⌄</span>
        </button>
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
    <div
      ref="recordsAnchor"
      :style="recordsExpanded ? { height: `${placeholderHeight}px` } : undefined"
    >
      <section
        ref="recordsPanel"
        class="stack daily-records"
        :class="{ 'daily-records--expanded': recordsExpanded }"
        aria-label="當日紀錄"
        @keydown.esc="recordsExpanded && toggleRecords()"
      >
        <div class="records-summary-row">
          <div class="day-summary">
            <h2>
              {{ Number(store.selectedDate.slice(5, 7)) }} 月
              {{ Number(store.selectedDate.slice(8)) }} 日
            </h2>
            <div v-if="recordedParts.length" class="day-parts" role="group" aria-label="紀錄部位">
              <span
                v-for="part in recordedParts"
                :key="part.name"
                class="day-part"
                :style="{ '--part-color': part.color }"
                >{{ part.name }}</span
              >
            </div>
          </div>
          <button
            ref="expandButton"
            type="button"
            class="records-handle"
            :aria-label="recordsExpanded ? '收回紀錄' : '展開紀錄'"
            :disabled="recordsAnimating"
            :aria-expanded="recordsExpanded"
            aria-controls="daily-records-list"
            @click="toggleRecords"
          >
            <svg
              width="20"
              height="14"
              viewBox="0 0 20 14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              :class="{ 'records-handle--down': recordsExpanded }"
            >
              <path d="m4 10 6-6 6 6" />
            </svg>
          </button>
          <div class="records-summary-actions">
            <p class="muted progress">{{ completed }} / {{ store.dayWorkouts.length }} 項完成</p>
            <ActionMenu
              label="當日選單"
              :items="[
                { label: '複製課表', action: openCopy, disabled: !store.dayWorkouts.length },
              ]"
            />
          </div>
        </div>
        <div id="daily-records-list" ref="recordsList" class="stack records-list">
          <div v-if="!store.dayWorkouts.length" class="card empty">
            <p>這天還沒有紀錄, 來運動吧！</p>
          </div>
          <article
            v-for="w in store.dayWorkouts"
            :key="w.id"
            class="card workout"
            :class="{ 'workout--done': w.completed }"
            data-testid="workout-card"
            @click="store.toggle(w)"
          >
            <div class="row">
              <button
                type="button"
                class="completion-toggle"
                :aria-pressed="w.completed"
                :aria-label="`完成 ${w.exerciseName}`"
                @click.stop="store.toggle(w)"
              >
                <span v-if="w.completed" class="completion-done">Done</span>
                <span
                  v-else
                  class="completion-dot"
                  :style="{ background: w.categoryColor }"
                  aria-hidden="true"
                ></span>
              </button>
              <div class="workout-title">
                <span class="category-label">{{ w.categoryName }}</span>
                <h3>{{ w.exerciseName }}</h3>
              </div>
              <ActionMenu
                :label="`${w.exerciseName}選單`"
                @click.stop
                :items="[
                  { label: '編輯', action: () => edit(w) },
                  { label: '複製', action: () => edit(w, true) },
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
                  <span v-for="(set, i) in w.sets" :key="i"
                    >{{ set.weight }} kg × {{ set.reps }}</span
                  >
                </div></template
              >
            </div>
          </article>
        </div>
      </section>
    </div>
    <FixedModal
      v-if="monthPickerOpen"
      panel-tag="form"
      label="切換年月"
      @close="monthPickerOpen = false"
      @submit="selectMonth"
    >
      <template #header
        ><h2>切換年月</h2>
        <button
          type="button"
          class="icon-button"
          aria-label="關閉"
          @click="monthPickerOpen = false"
        >
          ×
        </button></template
      >
      <template #body
        ><div class="two-fields">
          <label class="field"
            >年份<input
              v-model="pickerYear"
              type="number"
              min="1900"
              max="9999"
              required
              inputmode="numeric"
          /></label>
          <label class="field"
            >月份<select v-model="pickerMonth" aria-label="月份">
              <option v-for="m in 12" :key="m" :value="m">{{ m }} 月</option>
            </select></label
          >
        </div></template
      >
      <template #footer
        ><button type="submit" class="ui-button ui-button--primary">確定</button></template
      >
    </FixedModal>
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
  gap: 16px;
}
.daily-records {
  gap: 8px;
}
.records-summary-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}
.records-summary-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  white-space: nowrap;
  min-width: 0;
}
.records-summary-actions :deep(.icon-button) {
  width: 32px;
}
@media (max-width: 360px) {
  .records-summary-row .day-summary {
    gap: 2px;
  }
  .records-summary-row .day-summary h2 {
    font-size: 0.85rem;
  }
  .records-summary-row .progress {
    font-size: 0.65rem;
  }
}
.records-handle {
  justify-self: center;
  align-self: center;
  display: grid;
  place-items: center;
  width: 32px;
  height: 28px;
  border: 0;
  border-radius: 12px;
  color: var(--color-muted);
  background: var(--color-primary-light);
}
.records-handle--down {
  transform: rotate(180deg);
}
.records-list {
  gap: 8px;
}
.daily-records--expanded {
  border-inline: 1px solid var(--color-border);
  position: fixed;
  top: 0;
  bottom: var(--bottom-nav-height);
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, var(--content-width));
  z-index: 9;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 20px 12px;
  background: var(--color-background);
}
.daily-records--expanded > .records-summary-row {
  flex-shrink: 0;
}
.daily-records--expanded .records-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  align-content: start;
  padding: 3px;
  margin: -3px;
  scrollbar-width: none;
}

.daily-records--expanded .records-list::-webkit-scrollbar {
  display: none;
}

.calendar {
  padding: 10px;
}
.month-header {
  padding: 0 4px 6px;
}
.month-trigger {
  border: 0;
  padding: 7px 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
}
.month-trigger span {
  color: var(--color-muted);
  margin-left: 4px;
}
.month-header .icon-button {
  width: 32px;
  height: 32px;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}
.weekdays {
  color: var(--color-muted);
  font-size: 0.7rem;
  text-align: center;
  margin-bottom: 5px;
}
.day {
  position: relative;
  min-width: 0;
  width: 100%;
  max-width: 36px;
  height: 32px;
  justify-self: center;
  border: 0;
  border-radius: 8px;
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
.day-summary {
  display: flex;
  flex-wrap: wrap;
  row-gap: 2px;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
}
.day-summary h2 {
  font-size: 0.9rem;
}
.day-parts {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
.day-part {
  border-radius: 5px;
  padding: 2px 5px;
  max-width: 100%;
  background: color-mix(in srgb, var(--part-color) 14%, var(--color-surface));
  color: var(--color-text);
  border: 1px solid color-mix(in srgb, var(--part-color) 35%, var(--color-border));
  font-size: 0.6rem;
  line-height: 1.4;
  white-space: normal;
  overflow-wrap: anywhere;
}
.progress {
  font-size: 0.7rem;
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
  cursor: pointer;
  padding: 10px 12px;
}
.completion-toggle {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
}
@media (min-width: 768px) and (hover: hover) and (pointer: fine) {
  .completion-toggle:hover {
    background: var(--color-primary-light);
  }
}
.completion-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.completion-done {
  font-size: 0.65rem;
  font-weight: 700;
}
.workout-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.workout-title h3 {
  overflow-wrap: anywhere;
  font-size: 0.9rem;
}
.category-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.65rem;
  color: var(--color-muted);
  flex-shrink: 0;
}
.workout-details {
  padding-left: 0;
  margin-top: 6px;
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
