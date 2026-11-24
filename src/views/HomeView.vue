<script setup lang="ts">
import { appConfig } from '@/config/app'
</script>

<template>
  <section class="base-view">
    <h1>{{ appConfig.name }}</h1>
    <p>{{ appConfig.description }}</p>
  </section>
</template>

<style scoped>
.base-view {
  display: grid;
  gap: 12px;
}
p {
  color: var(--color-muted);
}
</style>
