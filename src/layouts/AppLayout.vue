<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { appConfig } from '@/config/app'
import { useTheme } from '@/composables/useTheme'

useTheme()

const navigationItems = [
  { to: '/', label: '首頁' },
  { to: '/settings', label: '設定' },
]
</script>

<template>
  <div class="app-layout">
    <aside class="app-layout__sidebar" aria-label="Main navigation">
      <div class="app-layout__brand">
        <span class="app-layout__brand-mark" aria-hidden="true">R</span>
        <strong>{{ appConfig.name }}</strong>
      </div>

      <nav class="app-layout__nav">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          class="app-layout__nav-link"
          :to="item.to"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <div class="app-layout__main">
      <header class="app-layout__topbar">
        <span>{{ appConfig.name }}</span>
      </header>

      <main class="app-layout__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  min-height: 100%;
  margin: 0;
}

:global(body) {
  background: var(--color-background);
  color: var(--color-text);
}

.app-layout {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  grid-template-columns: 220px minmax(0, 1fr);
  background: var(--color-background);
  color: var(--color-text);
}

.app-layout__sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 20px;
}

.app-layout__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
}

.app-layout__brand-mark {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 800;
}

.app-layout__nav {
  display: grid;
  gap: 6px;
}

.app-layout__nav-link {
  border-radius: 8px;
  color: var(--color-muted);
  font-weight: 700;
  padding: 10px 12px;
  text-decoration: none;
}

.app-layout__nav-link.router-link-exact-active {
  background: var(--color-primary-light);
  color: var(--color-text);
}

.app-layout__main {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.app-layout__topbar {
  display: flex;
  min-height: 56px;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 0.9rem;
  font-weight: 700;
  padding: 0 24px;
}

.app-layout__content {
  width: min(100%, 1120px);
  box-sizing: border-box;
  padding: 28px 24px;
}

@media (max-width: 760px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .app-layout__sidebar {
    position: sticky;
    top: 0;
    z-index: 2;
    gap: 12px;
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
    padding: 14px;
  }

  .app-layout__nav {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .app-layout__nav-link {
    white-space: nowrap;
  }

  .app-layout__topbar {
    display: none;
  }

  .app-layout__content {
    padding: 20px 14px;
  }
}
</style>
