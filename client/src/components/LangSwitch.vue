<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale, t } = useI18n()
const showDropdown = ref(false)

const languages = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' }
]

function selectLanguage(code) {
  locale.value = code
  localStorage.setItem('locale', code)
  showDropdown.value = false
}

function getCurrentFlag() {
  return languages.find(l => l.code === locale.value)?.flag || '🌐'
}
</script>

<template>
  <div class="lang-switch" @mouseleave="showDropdown = false">
    <button
      class="lang-btn btn-icon btn-ghost"
      @click="showDropdown = !showDropdown"
    >
      <span class="flag">{{ getCurrentFlag() }}</span>
    </button>
    
    <Transition name="dropdown">
      <div v-if="showDropdown" class="dropdown">
        <button
          v-for="lang in languages"
          :key="lang.code"
          class="dropdown-item"
          :class="{ active: locale === lang.code }"
          @click="selectLanguage(lang.code)"
        >
          <span class="flag">{{ lang.flag }}</span>
          <span>{{ lang.label }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.lang-switch {
  position: relative;
}

.lang-btn {
  font-size: 1.25rem;
}

.flag {
  font-size: 1.125rem;
}

.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  min-width: 140px;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--bg-tertiary);
}

.dropdown-item.active {
  background: var(--accent-primary);
  color: white;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
