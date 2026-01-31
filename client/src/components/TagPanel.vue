<script setup>
import { ref, inject, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  tags: Array,
  selectedDates: Array
})

const emit = defineEmits(['manage-tags'])

const send = inject('send')
const selectedTag = ref(null)
const weightType = ref('available') // available or unavailable
const newTagName = ref('')

const hasSelectedDates = computed(() => props.selectedDates.length > 0)

function createTag() {
  if (!newTagName.value.trim()) return
  send({
    type: 'add_tag',
    name: newTagName.value.trim()
  })
  newTagName.value = ''
}

function applyTag() {
  if (!selectedTag.value || !hasSelectedDates.value) return
  
  const weight = weightType.value === 'available' ? 1 : -2
  
  send({
    type: 'add_marks',
    tagId: selectedTag.value,
    weight,
    dates: props.selectedDates
  })
}
</script>

<template>
  <section class="tag-panel card">
    <header class="panel-header">
      <h3>{{ t('tag.title') }}</h3>
    </header>

    <!-- Tag creation -->
    <div class="tag-create">
      <input
        v-model="newTagName"
        type="text"
        :placeholder="t('tag.namePlaceholder')"
        @keyup.enter="createTag"
      />
      <button class="btn-secondary btn-sm" @click="createTag">
        {{ t('tag.create') }}
      </button>
    </div>

    <!-- Tag list -->
    <div class="tag-list" v-if="tags.length > 0">
      <button
        v-for="tag in tags"
        :key="tag.id"
        class="tag-item"
        :class="{ selected: selectedTag === tag.id }"
        @click="selectedTag = selectedTag === tag.id ? null : tag.id"
      >
        <span class="tag-color" :style="{ background: tag.color || 'var(--accent-primary)' }"></span>
        {{ tag.name }}
      </button>
    </div>

    <!-- Weight type selection -->
    <div class="weight-selector" v-if="selectedTag">
      <label class="weight-option">
        <input
          type="radio"
          v-model="weightType"
          value="available"
        />
        <span class="weight-badge available">{{ t('tag.available') }} (+1)</span>
      </label>
      <label class="weight-option">
        <input
          type="radio"
          v-model="weightType"
          value="unavailable"
        />
        <span class="weight-badge unavailable">{{ t('tag.unavailable') }} (-2)</span>
      </label>
    </div>

    <!-- Apply button -->
    <button
      class="btn-primary apply-btn"
      :disabled="!selectedTag || !hasSelectedDates"
      @click="applyTag"
    >
      {{ hasSelectedDates ? t('tag.apply') : t('tag.selectDates') }}
    </button>

    <!-- Weight explanation -->
    <div class="weight-info">
      <div class="info-icon">ℹ️</div>
      <div class="info-text">
        <strong>{{ t('tag.weight') }}:</strong>
        {{ t('tag.weightDesc') }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.tag-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.tag-create {
  display: flex;
  gap: 8px;
}

.tag-create input {
  flex: 1;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 2px solid transparent;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tag-item:hover {
  background: var(--border-light);
}

.tag-item.selected {
  border-color: var(--accent-primary);
  background: rgba(99, 102, 241, 0.1);
}

.tag-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.weight-selector {
  display: flex;
  gap: 12px;
}

.weight-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.weight-option input {
  display: none;
}

.weight-badge {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
  border: 2px solid transparent;
  transition: all var(--transition-fast);
}

.weight-badge.available {
  background: var(--success-light);
  color: var(--success);
}

.weight-badge.unavailable {
  background: var(--danger-light);
  color: var(--danger);
}

.weight-option input:checked + .weight-badge {
  border-color: currentColor;
}

.apply-btn {
  width: 100%;
}

.weight-info {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.info-icon {
  font-size: 1rem;
}

.info-text strong {
  color: var(--text-primary);
}
</style>
