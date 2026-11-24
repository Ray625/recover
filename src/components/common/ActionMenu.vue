<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'
defineProps<{
  label: string
  items: { label: string; action: () => void; danger?: boolean; disabled?: boolean }[]
}>()
const root = ref<HTMLElement>()
const open = ref(false)
const trigger = ref<HTMLButtonElement>()
useClickOutside(root, () => (open.value = false))
function choose(action: () => void) {
  close()
  action()
}
function close() {
  open.value = false
  trigger.value?.focus()
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
    <div v-if="open" class="action-menu__panel">
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
  </div>
</template>
<style scoped>
.action-menu {
  position: relative;
}
.action-menu__panel {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 5;
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
