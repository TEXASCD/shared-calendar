<script setup>
import { ref, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalendar } from '../composables/useCalendar'
import DayCell from './DayCell.vue'

const { t } = useI18n()

const props = defineProps({
  currentDate: Date,
  selectedDate: Date,
  selectedDates: Array,
  events: Array,
  marks: Array
})

const emit = defineEmits(['update:currentDate', 'update:selectedDate', 'update:selectedDates', 'add-event'])

const currentDateRef = computed({
  get: () => props.currentDate,
  set: (val) => emit('update:currentDate', val)
})

const { year, month, calendarDays, formatDate, getWeightColor, prevMonth, nextMonth, goToToday } = useCalendar(currentDateRef, computed(() => props.marks))

// Drag selection state
const isDragging = ref(false)
const dragStart = ref(null)
const dragEnd = ref(null)

const selectedDateKeys = computed(() => {
  if (!isDragging.value || !dragStart.value) return new Set()
  
  const start = dragStart.value
  const end = dragEnd.value || start
  const startTime = Math.min(new Date(start).getTime(), new Date(end).getTime())
  const endTime = Math.max(new Date(start).getTime(), new Date(end).getTime())
  
  const keys = new Set()
  const current = new Date(startTime)
  while (current.getTime() <= endTime) {
    keys.add(formatDate(current))
    current.setDate(current.getDate() + 1)
  }
  return keys
})

function handleDayMouseDown(dateKey) {
  isDragging.value = true
  dragStart.value = dateKey
  dragEnd.value = dateKey
}

function handleDayMouseEnter(dateKey) {
  if (isDragging.value) {
    dragEnd.value = dateKey
  }
}

function handleMouseUp() {
  if (isDragging.value && dragStart.value) {
    const dates = Array.from(selectedDateKeys.value)
    emit('update:selectedDates', dates)
    
    if (dates.length === 1) {
      emit('update:selectedDate', new Date(dates[0]))
    }
  }
  isDragging.value = false
}

function handleDayClick(dateKey) {
  emit('update:selectedDate', new Date(dateKey))
  emit('update:selectedDates', [dateKey])
}

function getEventsForDate(dateKey) {
  return props.events.filter(e => e.date === dateKey)
}

const monthLabel = computed(() => {
  const monthNames = t('calendar.months')
  return `${year.value}年 ${monthNames[month.value]}`
})
</script>

<template>
  <section class="calendar-section card" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
    <header class="calendar-header">
      <h2 class="month-label">{{ monthLabel }}</h2>
      <div class="calendar-nav">
        <button class="btn-ghost btn-sm" @click="prevMonth">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          {{ t('calendar.prevMonth') }}
        </button>
        <button class="btn-secondary btn-sm" @click="goToToday">{{ t('calendar.today') }}</button>
        <button class="btn-ghost btn-sm" @click="nextMonth">
          {{ t('calendar.nextMonth') }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </header>

    <div class="calendar-grid">
      <div
        v-for="weekday in t('calendar.weekdays')"
        :key="weekday"
        class="weekday-header"
      >
        {{ weekday }}
      </div>

      <DayCell
        v-for="day in calendarDays"
        :key="day.dateKey"
        :day="day"
        :events="getEventsForDate(day.dateKey)"
        :isSelected="selectedDates.includes(day.dateKey) || selectedDateKeys.has(day.dateKey)"
        :isDragging="isDragging && selectedDateKeys.has(day.dateKey)"
        :weightColor="getWeightColor(day.weight)"
        @mousedown.prevent="handleDayMouseDown(day.dateKey)"
        @mouseenter="handleDayMouseEnter(day.dateKey)"
        @click="handleDayClick(day.dateKey)"
      />
    </div>

    <div class="calendar-footer" v-if="selectedDates.length > 0">
      <span class="selected-info">
        {{ selectedDates.length }} {{ selectedDates.length > 1 ? '天已选中' : '天已选中' }}
      </span>
      <button class="btn-primary btn-sm" @click="$emit('add-event')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        {{ t('event.addEvent') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.calendar-section {
  padding: 24px;
  user-select: none;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.month-label {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.calendar-nav {
  display: flex;
  gap: 8px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.weekday-header {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.calendar-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.selected-info {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .calendar-section {
    padding: 16px;
  }
  
  .calendar-grid {
    gap: 4px;
  }
  
  .calendar-nav {
    width: 100%;
    justify-content: center;
  }
}
</style>
