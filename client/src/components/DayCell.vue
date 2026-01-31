<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  day: Object,
  events: Array,
  isSelected: Boolean,
  isDragging: Boolean,
  weightColor: String
})

const showTooltip = ref(false)

const displayEvents = computed(() => props.events.slice(0, 2))
const moreCount = computed(() => Math.max(0, props.events.length - 2))

const cellStyle = computed(() => {
  if (props.weightColor) {
    return { backgroundColor: props.weightColor }
  }
  return {}
})

const marksSummary = computed(() => {
  if (!props.day.marks || props.day.marks.length === 0) return null
  
  const byUser = {}
  props.day.marks.forEach(m => {
    if (!byUser[m.by]) byUser[m.by] = []
    byUser[m.by].push(m)
  })
  
  return Object.entries(byUser).map(([user, marks]) => {
    const total = marks.reduce((sum, m) => sum + m.weight, 0)
    return { user, total, count: marks.length }
  })
})
</script>

<template>
  <div
    class="day-cell"
    :class="{
      'other-month': !day.isCurrentMonth,
      'today': day.isToday,
      'selected': isSelected,
      'dragging': isDragging,
      'has-weight': !!weightColor
    }"
    :style="cellStyle"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <div class="day-number" :class="{ 'today-badge': day.isToday }">
      {{ day.day }}
    </div>

    <div class="events-preview" v-if="displayEvents.length > 0">
      <div
        v-for="event in displayEvents"
        :key="event.id"
        class="event-chip"
      >
        {{ event.title }}
      </div>
      <div v-if="moreCount > 0" class="more-badge">
        +{{ moreCount }}
      </div>
    </div>

    <Transition name="tooltip">
      <div v-if="showTooltip && marksSummary && marksSummary.length > 0" class="day-tooltip">
        <div class="tooltip-title">标记详情 (总分: {{ day.weight }})</div>
        <div class="tooltip-list">
          <div v-for="item in marksSummary" :key="item.user" class="tooltip-item">
            <span class="user-name">{{ item.user }}</span>
            <span class="user-score" :class="{ positive: item.total > 0, negative: item.total < 0 }">
              {{ item.total > 0 ? '+' : '' }}{{ item.total }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.day-cell {
  position: relative;
  min-height: 90px;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.day-cell:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-md);
}

.day-cell.other-month {
  opacity: 0.4;
}

.day-cell.selected {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.day-cell.dragging {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--accent-primary);
}

.day-cell.has-weight {
  border-color: transparent;
}

.day-number {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.day-number.today-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: var(--accent-gradient);
  color: white;
  border-radius: 50%;
}

.events-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.event-chip {
  font-size: 0.625rem;
  padding: 3px 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-badge {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-align: center;
}

.day-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  min-width: 150px;
  box-shadow: var(--shadow-lg);
  z-index: 20;
  pointer-events: none;
}

.tooltip-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
}

.tooltip-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.user-name {
  color: var(--text-secondary);
}

.user-score {
  font-weight: 600;
}

.user-score.positive {
  color: var(--success);
}

.user-score.negative {
  color: var(--danger);
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

@media (max-width: 768px) {
  .day-cell {
    min-height: 60px;
    padding: 6px;
  }
  
  .day-number {
    font-size: 0.75rem;
  }
  
  .event-chip {
    display: none;
  }
  
  .more-badge {
    display: none;
  }
}
</style>
