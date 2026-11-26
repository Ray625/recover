<template>
  <button type="button" class="header-button"><slot /></button>
</template>

<style scoped>
.header-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 32px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 0 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.75rem;
  line-height: 1;
  white-space: nowrap;
}
@media (min-width: 768px) and (hover: hover) and (pointer: fine) {
  .header-button:hover {
    background: var(--color-primary-light);
  }
}
</style>
