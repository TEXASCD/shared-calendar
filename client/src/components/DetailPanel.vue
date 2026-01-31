<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import EventCard from './EventCard.vue'

const { t } = useI18n()

const props = defineProps({
  selectedDate: Date,
  events: Array
})

const emit = defineEmits(['edit-event'])

const send = inject('send')

const dateLabel = computed(() => {
  if (!props.selectedDate) return t('event.noEvents')
  return props.selectedDate.toLocaleDateString()
})

const formatDateKey = (date) => {
  if (!date) return null
  return date.toISOString().split('T')[0]
}

const filteredEvents = computed(() => {
  if (!props.selectedDate) return []
  const dateKey = formatDateKey(props.selectedDate)
  return props.events
    .filter(e => e.date === dateKey)
    .sort((a, b) => a.start.localeCompare(b.start))
})

function handleDelete(eventId) {
  send({ type: 'delete_event', id: eventId })
}
</script>

<template>
  <section class="detail-panel card">
    <header class="panel-header">
      <h3>{{ dateLabel }}</h3>
      <span class="event-count" v-if="filteredEvents.length > 0">
        {{ filteredEvents.length }} {{ filteredEvents.length === 1 ? '项' : '项' }}
      </span>
    </header>

    <div class="events-list" v-if="filteredEvents.length > 0">
      <EventCard
        v-for="event in filteredEvents"
        :key="event.id"
        :event="event"
        @edit="$emit('edit-event', event)"
        @delete="handleDelete(event.id)"
      />
    </div>

    <div class="empty-state" v-else>
      <div class="empty-icon">📋</div>
      <p>{{ t('event.noEvents') }}</p>
    </div>
  </section>
</template>

<style scoped>
.detail-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.event-count {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 4px 10px;
  border-radius: var(--radius-full);
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  padding: 32px;
}

.empty-icon {
  font-size: 2.5rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 0.875rem;
}
</style>
