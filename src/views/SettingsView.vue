<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useFitnessStore } from '@/stores/fitness'
import { validateData, localDate, type FitnessData } from '@/domain/fitness'
import { createId } from '@/utils/id'
import FixedModal from '@/components/common/FixedModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ActionMenu from '@/components/common/ActionMenu.vue'
const store = useFitnessStore()
const { isDarkMode, setDarkMode } = useTheme()
const query = ref('')
const edit = ref<{
  kind: 'category' | 'exercise'
  id?: string
  name: string
  categoryId: string
  color: string
}>()
const deletion = ref<{ kind: 'category' | 'exercise'; id: string; name: string }>()
const error = ref('')
const imported = ref<FitnessData>()
const visible = computed(() =>
  store.data.categories
    .map((c) => ({
      ...c,
      exercises: store.data.exercises.filter(
        (e) =>
          e.categoryId === c.id &&
          (!query.value || e.name.includes(query.value) || c.name.includes(query.value)),
      ),
    }))
    .filter((c) => !query.value || c.name.includes(query.value) || c.exercises.length),
)
function open(kind: 'category' | 'exercise', id?: string, categoryId = '') {
  error.value = ''
  const item =
    kind === 'category'
      ? store.data.categories.find((c) => c.id === id)
      : store.data.exercises.find((e) => e.id === id)
  edit.value = {
    kind,
    id,
    name: item?.name ?? '',
    categoryId:
      kind === 'exercise'
        ? (store.data.exercises.find((e) => e.id === id)?.categoryId ??
          categoryId ??
          store.data.categories[0]?.id ??
          '')
        : '',
    color: store.data.categories.find((c) => c.id === id)?.color ?? '#c88c68',
  }
}
function save() {
  const form = edit.value
  if (!form) return
  const name = form.name.trim()
  if (!name) {
    error.value = '請輸入名稱'
    return
  }
  if (form.kind === 'exercise' && !store.data.categories.some((c) => c.id === form.categoryId)) {
    error.value = '請選擇分類'
    return
  }
  const ok = store.mutate((d) => {
    if (form.kind === 'category') {
      const c = d.categories.find((c) => c.id === form.id)
      if (c) {
        c.name = name
        c.color = form.color
      } else d.categories.push({ id: createId(), name, color: form.color })
    } else {
      const e = d.exercises.find((e) => e.id === form.id)
      if (e) {
        e.name = name
        e.categoryId = form.categoryId
      } else d.exercises.push({ id: createId(), name, categoryId: form.categoryId })
    }
  })
  if (ok) {
    edit.value = undefined
    store.message = '已儲存'
  } else error.value = store.error
}
function requestDelete(kind: 'category' | 'exercise', id: string, name: string) {
  error.value = ''
  if (kind === 'category' && store.data.exercises.some((e) => e.categoryId === id)) {
    error.value = '請先將動作移至其他分類'
    return
  }
  deletion.value = { kind, id, name }
}
function remove() {
  const item = deletion.value
  if (!item) return
  if (item.kind === 'category' && store.data.exercises.some((e) => e.categoryId === item.id)) {
    error.value = '請先將動作移至其他分類'
    deletion.value = undefined
    return
  }
  if (
    store.mutate((d) => {
      if (item.kind === 'category') d.categories = d.categories.filter((c) => c.id !== item.id)
      else d.exercises = d.exercises.filter((e) => e.id !== item.id)
    })
  ) {
    deletion.value = undefined
    store.message = '已刪除'
  }
}
function exportData() {
  const url = URL.createObjectURL(
    new Blob([store.unreadableBackup ?? JSON.stringify(store.data, null, 2)], {
      type: 'application/json',
    }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `fitness-${localDate()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function readBackup(event: Event) {
  error.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('備份檔案過大')
    imported.value = validateData(JSON.parse(await file.text()))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '無法讀取備份'
  } finally {
    input.value = ''
  }
}
function importData() {
  if (imported.value && store.commit(imported.value, true)) {
    imported.value = undefined
    store.message = '已匯入'
  }
}
</script>
<template>
  <div class="stack settings-page">
    <header>
      <p class="eyebrow">PREFERENCES</p>
      <h1>設定</h1>
    </header>
    <section class="card">
      <label class="row between"
        ><span>深色模式</span
        ><input
          type="checkbox"
          :checked="isDarkMode"
          @change="setDarkMode(($event.target as HTMLInputElement).checked)"
      /></label>
    </section>
    <section class="stack" aria-label="分類與動作管理">
      <div class="row between">
        <h2>分類與動作</h2>
        <button type="button" class="ui-button ui-button--secondary" @click="open('category')">
          新增分類
        </button>
      </div>
      <label class="sr-only" for="exercise-search">搜尋動作或分類</label
      ><input id="exercise-search" v-model="query" type="search" placeholder="搜尋動作或分類" />
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <div v-for="c in visible" :key="c.id" class="card category-card">
        <div class="row between">
          <h3 class="row">
            <i class="color-dot" :style="{ background: c.color }"></i>{{ c.name
            }}<span class="muted">{{
              store.data.exercises.filter((e) => e.categoryId === c.id).length
            }}</span>
          </h3>
          <ActionMenu
            :label="`${c.name}分類選單`"
            :items="[
              { label: '編輯', action: () => open('category', c.id) },
              {
                label: '刪除',
                action: () => requestDelete('category', c.id, c.name),
                danger: true,
              },
            ]"
          />
        </div>
        <div v-for="e in c.exercises" :key="e.id" class="exercise-row row between">
          <span>{{ e.name }}</span
          ><ActionMenu
            :label="`${e.name}動作選單`"
            :items="[
              { label: '編輯', action: () => open('exercise', e.id) },
              {
                label: '刪除',
                action: () => requestDelete('exercise', e.id, e.name),
                danger: true,
              },
            ]"
          />
        </div>
        <button
          type="button"
          class="add-exercise"
          :aria-label="`在${c.name}新增動作`"
          @click="open('exercise', undefined, c.id)"
        >
          ＋ 新增動作
        </button>
      </div>
      <p v-if="!visible.length" class="empty">沒有符合的項目</p>
    </section>
    <section class="card stack">
      <h2>資料備份</h2>
      <p class="muted">資料儲存在此瀏覽器</p>
      <div class="two-fields">
        <button type="button" class="ui-button ui-button--secondary" @click="exportData">
          匯出</button
        ><label class="ui-button ui-button--secondary import-button"
          >匯入<input
            type="file"
            accept="application/json,.json"
            aria-label="匯入備份"
            @change="readBackup"
        /></label>
      </div>
    </section>
    <FixedModal
      v-if="edit"
      panel-tag="form"
      :label="`${edit.id ? '編輯' : '新增'}${edit.kind === 'category' ? '分類' : '動作'}`"
      @close="edit = undefined"
      @submit="save"
      ><template #header
        ><h2>{{ edit.id ? '編輯' : '新增' }}{{ edit.kind === 'category' ? '分類' : '動作' }}</h2>
        <button type="button" class="icon-button" aria-label="關閉" @click="edit = undefined">
          ×
        </button></template
      ><template #body
        ><label class="field">名稱<input v-model="edit.name" required maxlength="80" /></label
        ><label v-if="edit.kind === 'category'" class="field"
          >顏色<input v-model="edit.color" type="color" /></label
        ><label v-else class="field"
          >分類<select v-model="edit.categoryId" aria-label="分類" required>
            <option v-for="c in store.data.categories" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select></label
        >
        <p v-if="error" role="alert" class="error">{{ error }}</p></template
      ><template #footer
        ><button type="submit" class="ui-button ui-button--primary">儲存</button></template
      ></FixedModal
    >
    <ConfirmDialog
      v-if="deletion"
      :title="deletion.kind === 'category' ? '刪除分類' : '刪除動作'"
      :message="deletion.name"
      confirm-label="刪除"
      tone="danger"
      @cancel="deletion = undefined"
      @confirm="remove"
    />
    <ConfirmDialog
      v-if="imported"
      title="匯入備份"
      message="取代目前資料？"
      confirm-label="匯入"
      @cancel="imported = undefined"
      @confirm="importData"
    />
  </div>
</template>
<style scoped>
.settings-page {
  gap: 24px;
}
.eyebrow {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  color: var(--color-primary);
  margin-bottom: 7px;
  font-weight: 700;
}
.category-card {
  padding: 10px 14px;
}
.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.exercise-row {
  border-top: 1px solid var(--color-divider);
  font-size: 0.85rem;
  padding-left: 18px;
  overflow-wrap: anywhere;
}
.add-exercise {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.8rem;
  padding: 12px 18px;
}
.import-button {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.import-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
</style>
