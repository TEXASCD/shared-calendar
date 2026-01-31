<script setup>
import { ref, inject, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  event: Object,
  selectedDate: Date
})

const emit = defineEmits(['close'])

const send = inject('send')
const userName = inject('userName')

const title = ref('')
const startTime = ref('09:00')
const endTime = ref('10:00')

const isEditing = ref(false)

onMounted(() => {
  if (props.event) {
    isEditing.value = true
    title.value = props.event.title
    startTime.value = props.event.start
    endTime.value = props.event.end
  }
})

function formatDate(date) {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

function handleSubmit() {
  if (!title.value.trim()) return
  
  if (startTime.value >= endTime.value) {
    alert('结束时间需要晚于开始时间')
    return
  }

  const payload = {
    date: formatDate(props.selectedDate),
    start: startTime.value,
    end: endTime.value,
    title: title.value.trim(),
    owner: userName.value || '匿名用户'
  }

  if (isEditing.value && props.event) {
    send({
      type: 'update_event',
      event: { ...payload, id: props.event.id }
    })
  } else {
    send({
      type: 'add_event',
      event: payload
    })
  }

  emit('close')
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content event-modal">
      <header class="modal-header">
        <h2>{{ isEditing ? t('event.edit') : t('event.addEvent') }}</h2>
        <button class="btn-icon btn-ghost close-btn" @click="$emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <form class="modal-body" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>{{ t('event.title') }}</label>
          <input
            v-model="title"
            type="text"
            :placeholder="t('event.title')"
            autofocus
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>{{ t('event.startTime') }}</label>
            <input v-model="startTime" type="time" />
          </div>
          <div class="form-group">
            <label>{{ t('event.endTime') }}</label>
            <input v-model="endTime" type="time" />
          </div>
        </div>

        <div class="form-group date-info">
          <span class="date-label">📅 {{ formatDate(selectedDate) }}</span>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            {{ t('event.cancel') }}
          </button>
          <button type="submit" class="btn-primary">
            {{ t('event.save') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.event-modal {
  width: 100%;
  max-width: 420px;
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

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input {
  width: 100%;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.date-info {
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.date-label {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
