<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  message: String
})

const emit = defineEmits(['close'])
</script>

<template>
  <div class="error-toast" role="alert">
    <div class="error-icon">⚠️</div>
    <div class="error-content">
      <div class="error-title">{{ t('common.error') }}</div>
      <div class="error-message">{{ message }}</div>
    </div>
    <button class="close-btn" @click="$emit('close')" :aria-label="t('common.close')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.error-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--danger);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: 400px;
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
  min-width: 0;
}

.error-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--danger);
  margin-bottom: 4px;
}

.error-message {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  word-break: break-word;
}

.close-btn {
  flex-shrink: 0;
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
</style>
