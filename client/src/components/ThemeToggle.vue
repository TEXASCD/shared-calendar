<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const theme = inject('theme')
const toggleTheme = inject('toggleTheme')
</script>

<template>
  <button
    class="theme-toggle btn-icon btn-ghost"
    @click="toggleTheme"
    :title="theme === 'light' ? t('theme.dark') : t('theme.light')"
  >
    <svg v-if="theme === 'light'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
    <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  color: var(--text-secondary);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.theme-toggle:hover {
  color: var(--accent-primary);
}

.theme-toggle svg {
  transition: transform var(--transition-normal);
}

.theme-toggle:hover svg {
  transform: rotate(15deg);
}
</style>
