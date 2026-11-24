<script setup lang="ts">
import type { Component, CSSProperties } from 'vue'
import AppDialog from './AppDialog.vue'

withDefaults(
  defineProps<{
    panelTag?: string | Component
    labelledby?: string
    label?: string
    closeOnBackdrop?: boolean
    accented?: boolean
    panelStyle?: CSSProperties
  }>(),
  {
    panelTag: 'section',
    labelledby: undefined,
    label: '對話視窗',
    closeOnBackdrop: true,
    accented: false,
    panelStyle: undefined,
  },
)

const emit = defineEmits<{
  close: []
  submit: [event: Event]
}>()
</script>

<template>
  <AppDialog
    class="fixed-modal"
    :close-on-backdrop="closeOnBackdrop"
    :aria-labelledby="labelledby"
    :aria-label="labelledby ? undefined : label"
    @close="emit('close')"
  >
    <component
      :is="panelTag"
      class="fixed-modal__panel"
      :class="{ 'fixed-modal__panel--accented': accented }"
      :style="panelStyle"
      @submit.prevent="emit('submit', $event)"
    >
      <header class="fixed-modal__header">
        <slot name="header"></slot>
      </header>

      <div class="fixed-modal__body">
        <slot name="body"></slot>
      </div>

      <footer v-if="$slots.footer" class="fixed-modal__footer">
        <slot name="footer"></slot>
      </footer>
    </component>
  </AppDialog>
</template>

<style scoped>
.fixed-modal {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  overscroll-behavior: contain;
  padding: 16px;
  background: var(--overlay-color);
}

.fixed-modal__panel {
  display: flex;
  width: min(100%, 520px);
  max-width: 100%;
  max-height: calc(100dvh - 32px);
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 22px 60px var(--shadow-color);
}

.fixed-modal__panel--accented {
  border-color: color-mix(
    in srgb,
    var(--accent-color, var(--color-primary)) 34%,
    var(--color-border)
  );
}

.fixed-modal__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border-bottom: 1px solid var(--color-border);
}

.fixed-modal__body {
  display: grid;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 14px;
  padding: 18px;
  scrollbar-gutter: stable;
}

.fixed-modal__footer {
  display: grid;
  flex: 0 0 auto;
  gap: 10px;
  padding: 14px 18px 18px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

@media (max-width: 560px) {
  .fixed-modal {
    padding: 10px;
  }

  .fixed-modal__panel {
    max-height: calc(100dvh - 20px);
  }

  .fixed-modal__header,
  .fixed-modal__body {
    padding: 16px;
  }

  .fixed-modal__body {
    scrollbar-gutter: auto;
  }

  .fixed-modal__footer {
    padding: 12px 16px 16px;
  }
}
</style>
