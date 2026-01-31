<script setup>
import { ref, inject } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  tags: Array
})

const emit = defineEmits(['close'])

const send = inject('send')
const newTagName = ref('')

function createTag() {
  if (!newTagName.value.trim()) return
  send({
    type: 'add_tag',
    name: newTagName.value.trim()
  })
  newTagName.value = ''
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content tag-modal">
      <header class="modal-header">
        <h2>{{ t('tag.title') }}</h2>
        <button class="btn-icon btn-ghost close-btn" @click="$emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <div class="modal-body">
        <div class="tag-create-form">
          <input
            v-model="newTagName"
            type="text"
            :placeholder="t('tag.namePlaceholder')"
            @keyup.enter="createTag"
          />
          <button class="btn-primary" @click="createTag">
            {{ t('tag.create') }}
          </button>
        </div>

        <div class="tags-grid" v-if="tags.length > 0">
          <div
            v-for="tag in tags"
            :key="tag.id"
            class="tag-card"
          >
            <span class="tag-color" :style="{ background: tag.color || 'var(--accent-primary)' }"></span>
            <span class="tag-name">{{ tag.name }}</span>
            <span class="tag-creator">{{ tag.createdBy }}</span>
          </div>
        </div>

        <div class="empty-state" v-else>
          <p>暂无标签，请创建一个</p>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" @click="$emit('close')">
          {{ t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-modal {
  width: 100%;
  max-width: 480px;
  padding: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 {
  font-size: 1.25rem;
}

.close-btn {
  color: var(--text-muted);
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tag-create-form {
  display: flex;
  gap: 12px;
}

.tag-create-form input {
  flex: 1;
}

.tags-grid {
  display: grid;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.tag-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.tag-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
}

.tag-creator {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
