<script setup>
import { ref, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import NoteSection from './NoteSection.vue'
import PollSection from './PollSection.vue'

const { t } = useI18n()

const props = defineProps({
  event: Object
})

const emit = defineEmits(['edit', 'delete'])

const expanded = ref(false)
const showTooltip = ref(false)

const participants = computed(() => {
  const users = new Set()
  if (props.event.owner) users.add(props.event.owner)
  props.event.activity?.forEach(a => {
    if (a.by) users.add(a.by)
  })
  return Array.from(users)
})

const recentActivity = computed(() => {
  return (props.event.activity || []).slice(-5).reverse()
})
</script>

<template>
  <div
    class="event-card"
    :class="{ expanded }"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <div class="event-main" @click="expanded = !expanded">
      <div class="event-info">
        <div class="event-title">{{ event.title }}</div>
        <div class="event-meta">
          <span class="time">{{ event.start }} - {{ event.end }}</span>
          <span class="owner">{{ event.owner }}</span>
        </div>
      </div>
      <div class="expand-icon" :class="{ rotated: expanded }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>

    <Transition name="expand">
      <div v-if="expanded" class="event-details">
        <div class="actions">
          <button class="btn-ghost btn-sm" @click.stop="$emit('edit')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            {{ t('event.edit') }}
          </button>
          <button class="btn-ghost btn-sm btn-danger-text" @click.stop="$emit('delete')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            {{ t('event.delete') }}
          </button>
        </div>

        <NoteSection :eventId="event.id" :notes="event.notes || []" />
        <PollSection :eventId="event.id" :poll="event.poll" />
      </div>
    </Transition>

    <Transition name="tooltip">
      <div v-if="showTooltip && participants.length > 0" class="participants-tooltip">
        <div class="tooltip-header">{{ t('event.participants') }}</div>
        <div class="participants-list">
          <span v-for="user in participants" :key="user" class="participant-badge">
            {{ user }}
          </span>
        </div>
        <div class="activity-list" v-if="recentActivity.length > 0">
          <div class="activity-header">最近活动</div>
          <div v-for="act in recentActivity" :key="act.id" class="activity-item">
            <span class="activity-user">{{ act.by }}</span>
            <span class="activity-action">{{ act.action }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.event-card {
  position: relative;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.event-card:hover {
  box-shadow: var(--shadow-md);
}

.event-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  cursor: pointer;
}

.event-info {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.expand-icon {
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.event-details {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
}

.btn-danger-text {
  color: var(--danger);
}

.btn-danger-text:hover {
  background: var(--danger-light);
}

.participants-tooltip {
  position: absolute;
  top: 0;
  right: 100%;
  margin-right: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 12px;
  min-width: 180px;
  box-shadow: var(--shadow-lg);
  z-index: 30;
}

.tooltip-header,
.activity-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.participants-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.participant-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  background: var(--accent-primary);
  color: white;
  border-radius: var(--radius-full);
}

.activity-list {
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
}

.activity-item {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.activity-user {
  color: var(--text-secondary);
  font-weight: 500;
}

.expand-enter-active,
.expand-leave-active {
  transition: all var(--transition-fast);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
</style>
