<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
defineProps<{ title: string }>()
</script>
<template>
  <div class="stack">
    <PageHeader :title="title" :eyebrow="title === '帳戶' ? 'ACCOUNT' : 'STATISTICS'" />
    <section class="card empty">尚未開放</section>
  </div>
</template>
