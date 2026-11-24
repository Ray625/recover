<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useFitnessStore } from '@/stores/fitness'
import WorkoutEditor from '@/components/fitness/WorkoutEditor.vue'
import AppToast from '@/components/common/AppToast.vue'
useTheme()
const store = useFitnessStore()
const adding = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => store.message,
  (message) => {
    clearTimeout(toastTimer)
    if (message)
      toastTimer = setTimeout(() => {
        store.message = ''
      }, 2600)
  },
)
onBeforeUnmount(() => clearTimeout(toastTimer))
</script>
<template>
  <div class="app-layout" data-testid="app-shell">
    <main class="app-content">
      <p v-if="store.error" class="error card" role="alert">{{ store.error }}</p>
      <RouterView />
    </main>
    <nav class="bottom-nav" aria-label="主要導覽">
      <RouterLink to="/"><span aria-hidden="true">▦</span>日曆</RouterLink>
      <RouterLink to="/account"><span aria-hidden="true">♙</span>帳戶</RouterLink>
      <button type="button" class="quick-add" aria-label="快速紀錄" @click="adding = true">
        <span aria-hidden="true">＋</span>
      </button>
      <RouterLink to="/stats"><span aria-hidden="true">▥</span>統計</RouterLink>
      <RouterLink to="/settings"><span aria-hidden="true">⚙</span>設定</RouterLink>
    </nav>
    <WorkoutEditor v-if="adding" @close="adding = false" />
    <AppToast :message="store.message" @close="store.message = ''" />
  </div>
</template>
<style scoped>
.app-layout {
  max-width: var(--content-width);
  margin: 0 auto;
  min-height: 100dvh;
  background: var(--color-background);
  position: relative;
  border-inline: 1px solid var(--color-border);
}
.app-content {
  padding: 28px 20px calc(110px + env(safe-area-inset-bottom, 0px));
}
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, var(--content-width));
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  z-index: 10;
  padding: 10px 8px calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}
.bottom-nav a {
  display: grid;
  gap: 3px;
  justify-items: center;
  padding: 5px 0;
  text-decoration: none;
  color: var(--color-muted);
  font-size: 0.65rem;
}
.bottom-nav a span {
  font-size: 1.5rem;
  line-height: 1;
}
.bottom-nav a.router-link-exact-active {
  color: var(--color-primary);
  font-weight: 700;
}
.quick-add {
  width: 52px;
  height: 52px;
  justify-self: center;
  border: 0;
  border-radius: 18px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 2rem;
  box-shadow: 0 5px 14px var(--shadow-color-soft);
}
</style>
