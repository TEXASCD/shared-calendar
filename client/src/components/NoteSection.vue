<script setup>
import { ref, inject } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  eventId: String,
  notes: Array
})

const send = inject('send')
const noteText = ref('')

function addNote() {
  if (!noteText.value.trim()) return
  send({
    type: 'add_note',
    eventId: props.eventId,
    text: noteText.value.trim()
  })
  noteText.value = ''
}
</script>

<template>
  <div class="note-section">
    <div class="section-header">
      <span class="section-title">{{ t('note.title') }}</span>
      <span class="count" v-if="notes.length">({{ notes.length }})</span>
    </div>

    <div class="notes-list" v-if="notes.length > 0">
      <div v-for="note in notes" :key="note.id" class="note-item">
        <span class="note-author">{{ note.by }}</span>
        <span class="note-text">{{ note.text }}</span>
      </div>
    </div>

    <div class="note-form">
      <input
        v-model="noteText"
        type="text"
        :placeholder="t('note.placeholder')"
        @keyup.enter="addNote"
      />
      <button class="btn-ghost btn-sm" @click="addNote">
        {{ t('note.add') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.note-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 10px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.count {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  max-height: 120px;
  overflow-y: auto;
}

.note-item {
  font-size: 0.75rem;
  padding: 6px 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
}

.note-author {
  font-weight: 500;
  color: var(--accent-primary);
  margin-right: 6px;
}

.note-author::after {
  content: ':';
}

.note-text {
  color: var(--text-secondary);
}

.note-form {
  display: flex;
  gap: 8px;
}

.note-form input {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.75rem;
}
</style>
