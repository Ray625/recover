<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'
defineProps<{
  label: string
  items: { label: string; action: () => void; danger?: boolean; disabled?: boolean }[]
}>()
const root = ref<HTMLElement>()
const open = ref(false)
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const panelStyle = ref<CSSProperties>({})
useClickOutside(root, (event) => {
  if (event.target instanceof Node && panel.value?.contains(event.target)) return
  open.value = false
})
function positionPanel() {
  if (!open.value || !trigger.value || !panel.value) return
  const rect = trigger.value.getBoundingClientRect()
  const height = panel.value.offsetHeight
  const width = panel.value.offsetWidth
  const top = rect.top - height - 6 >= 8 ? rect.top - height - 6 : rect.bottom + 6
  panelStyle.value = {
    left: `${Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))}px`,
    top: `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`,
  }
}
watch(open, async (value) => {
  if (value) {
    await nextTick()
    positionPanel()
  }
})
onMounted(() => {
  window.addEventListener('resize', positionPanel)
  window.addEventListener('scroll', positionPanel, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', positionPanel)
  window.removeEventListener('scroll', positionPanel, true)
})
function choose(action: () => void) {
  close()
  action()
}
function close() {
  open.value = false
  trigger.value?.focus({ preventScroll: true })
}
</script>
<template>
  <div ref="root" class="action-menu" @keydown.esc.stop="close">
    <button
      ref="trigger"
      type="button"
      class="icon-button"
      :aria-label="label"
      :aria-expanded="open"
      @click="open = !open"
    >
      ⋯
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="action-menu__panel"
        :style="panelStyle"
        @keydown.esc.stop="close"
      >
        <button
          v-for="item in items"
          :key="item.label"
          type="button"
          :class="{ error: item.danger }"
          :disabled="item.disabled"
          @click="choose(item.action)"
        >
          {{ item.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
<style scoped>
.action-menu {
  position: relative;
}
.action-menu__panel {
  position: fixed;
  z-index: 15;
  min-width: 140px;
  padding: 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 28px var(--shadow-color-soft);
}
.action-menu__panel button {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  padding: 12px;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.9rem;
}
.action-menu__panel button.error {
  color: var(--color-danger);
}
.action-menu__panel button:hover {
  background: var(--color-primary-light);
}
</style>
