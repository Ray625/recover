<script setup lang="ts">
defineProps<{ title: string }>()
</script>
<template>
  <div class="stack">
    <h1>{{ title }}</h1>
    <section class="card empty">尚未開放</section>
  </div>
</template>
