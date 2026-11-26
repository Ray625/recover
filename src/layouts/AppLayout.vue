<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useFitnessStore } from '@/stores/fitness'
import WorkoutEditor from '@/components/fitness/WorkoutEditor.vue'
import AppToast from '@/components/common/AppToast.vue'
import accountArm from '@/assets/icons/account-arm.png'
useTheme()
const store = useFitnessStore()
const adding = ref(false)
watch(
  () => store.ownerId,
  () => {
    adding.value = false
  },
)
const calendarDay = new Date().getDate()
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
      <RouterLink to="/account">
        <svg class="nav-icon account-icon--outline" viewBox="0 0 28 28" aria-hidden="true">
          <defs>
            <filter
              id="account-arm-outline"
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
              color-interpolation-filters="sRGB"
            >
              <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="outer" />
              <feMorphology in="SourceAlpha" operator="erode" radius="0.6" result="inner" />
              <feComposite in="outer" in2="inner" operator="out" result="edge" />
              <feFlood flood-color="currentColor" />
              <feComposite in2="edge" operator="in" />
            </filter>
            <clipPath id="account-arm-open-edge"><rect width="20.5" height="28" /></clipPath>
          </defs>
          <g clip-path="url(#account-arm-open-edge)">
            <image :href="accountArm" width="28" height="28" filter="url(#account-arm-outline)" />
          </g>
        </svg>
        <span
          class="nav-icon account-icon account-icon--solid"
          :style="{ maskImage: `url(${accountArm})`, WebkitMaskImage: `url(${accountArm})` }"
          aria-hidden="true"
        ></span>
        帳戶
      </RouterLink>
      <RouterLink to="/">
        <svg
          class="nav-icon"
          viewBox="0 0 28 28"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          aria-hidden="true"
        >
          <rect x="3.5" y="3.5" width="21" height="21" rx="5" />
          <text
            x="14"
            y="14.5"
            text-anchor="middle"
            dominant-baseline="central"
            fill="currentColor"
            stroke="none"
            font-size="11"
            font-weight="600"
          >
            {{ calendarDay }}
          </text>
        </svg>
        日曆
      </RouterLink>
      <button
        type="button"
        class="quick-add"
        aria-label="快速紀錄"
        :disabled="!store.canWrite"
        @click="adding = true"
      >
        <span aria-hidden="true">＋</span>
      </button>
      <RouterLink to="/stats">
        <svg
          class="nav-icon"
          viewBox="0 0 28 28"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M16 4H6a2 2 0 0 0-2 2v18h16v-7M8 9h5M8 13h3M8 19h4" />
          <path d="m15 16-1 4 4-1L25 8l-3-2-7 10Zm5-8 3 2" />
        </svg>
        統計
      </RouterLink>
      <RouterLink to="/settings"
        ><span class="settings-icon" aria-hidden="true"></span>設定</RouterLink
      >
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
  min-height: var(--bottom-nav-height);
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
  grid-template-rows: 28px auto;
  gap: 3px;
  justify-items: center;
  padding: 5px 0;
  text-decoration: none;
  color: var(--color-muted);
  font-size: 0.65rem;
}
.nav-icon {
  width: 28px;
  height: 28px;
}
.account-icon--solid {
  display: none;
}
.bottom-nav a.router-link-exact-active .account-icon--outline {
  display: none;
}
.bottom-nav a.router-link-exact-active .account-icon--solid {
  display: block;
}
.account-icon {
  background: currentColor;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}
.bottom-nav a span {
  font-size: 1.5rem;
  line-height: 1;
}
.bottom-nav a .settings-icon {
  position: relative;
  width: 28px;
  height: 28px;
  font-size: 2.5rem;
  line-height: 1;
}
.settings-icon::before {
  content: '⚙︎';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, calc(-50% - 4px));
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
