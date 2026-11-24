<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useBodyScrollLock } from '@/composables/useBodyScrollLock'

withDefaults(defineProps<{ closeOnBackdrop?: boolean }>(), { closeOnBackdrop: true })
const emit = defineEmits<{ close: [] }>()
const dialogRef = ref<HTMLDialogElement>()

useBodyScrollLock(true)
onMounted(() => dialogRef.value?.showModal())
onBeforeUnmount(() => dialogRef.value?.close())
</script>

<template>
  <dialog
    ref="dialogRef"
    class="app-dialog"
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
