<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'

withDefaults(defineProps<{ closeOnBackdrop?: boolean }>(), { closeOnBackdrop: true })
const emit = defineEmits<{ close: [] }>()
const dialogRef = ref<HTMLDialogElement>()

function keepFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialogRef.value) return
  const controls = [
    ...dialogRef.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ),
  ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0)
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (!first) {
    event.preventDefault()
    dialogRef.value.focus()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === dialogRef.value)
  ) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

useBodyScrollLock(true)
onMounted(() => dialogRef.value?.showModal())
onBeforeUnmount(() => dialogRef.value?.close())
</script>

<template>
  <dialog
    ref="dialogRef"
    class="app-dialog"
    @keydown="keepFocus"
    @cancel.prevent="emit('close')"
    @click.self="closeOnBackdrop && emit('close')"
  >
    <slot />
  </dialog>
</template>

<style scoped>
.app-dialog {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  border: 0;
  padding: 0;
}
.app-dialog:not([open]) {
  display: none;
}
.app-dialog::backdrop {
  background: transparent;
}
</style>
