<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { isDarkMode, setDarkMode } = useTheme()
</script>

<template>
  <section class="settings-view">
    <h1>設定</h1>
    <label class="settings-view__option">
      <span>深色模式</span>
      <input
        type="checkbox"
        :checked="isDarkMode"
        @change="setDarkMode(($event.target as HTMLInputElement).checked)"
      />
    </label>
  </section>
</template>

<style scoped>
.settings-view {
  display: grid;
  gap: 20px;
  max-width: 480px;
}
.settings-view__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
input {
  width: 20px;
  height: 20px;
  accent-color: var(--color-primary);
}
</style>
