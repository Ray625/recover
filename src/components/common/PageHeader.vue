<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <header class="page-header">
    <h1>{{ title }}</h1>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
}
h1 {
  font-size: 1.2rem;
  line-height: 1.5;
}
.page-header__actions {
  display: flex;
  align-items: center;
  height: 28.8px;
}
</style>
