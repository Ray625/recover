<script setup lang="ts">
export interface FixedSelectOption {
  value: string
  label: string
}

defineProps<{
  modelValue: string
  options: FixedSelectOption[]
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <select
    class="fixed-select"
    :value="modelValue"
    :disabled="disabled || options.length === 0"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option
      v-if="!options.some((option) => option.value === modelValue)"
      :value="modelValue"
      disabled
    >
      {{ placeholder ?? '請選擇' }}
    </option>
    <option v-for="option in options" :key="option.value" :value="option.value">
      {{ option.label }}
    </option>
  </select>
</template>

<style scoped>
.fixed-select {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
}
.fixed-select:disabled {
  background: var(--color-disabled-surface);
  color: var(--color-muted);
  cursor: not-allowed;
}
</style>
