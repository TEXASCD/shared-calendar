import { computed } from 'vue'

export function useCalendar(currentDate, marks) {
  const year = computed(() => currentDate.value.getFullYear())
  const month = computed(() => currentDate.value.getMonth())

  const calendarDays = computed(() => {
    const days = []
    const firstDay = new Date(year.value, month.value, 1)
    const startWeekday = (firstDay.getDay() + 6) % 7 // Monday = 0
    const startDate = new Date(firstDay)
    startDate.setDate(firstDay.getDate() - startWeekday)

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const dateKey = formatDate(date)
      
      // Calculate weight for this date
      const dateMarks = marks.value.filter(m => m.date === dateKey)
      const weight = dateMarks.reduce((sum, m) => sum + m.weight, 0)

      days.push({
        date,
        dateKey,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === month.value,
        isToday: isToday(date),
        weight,
        marks: dateMarks
      })
    }

    return days
  })

  function formatDate(date) {
    return date.toISOString().split('T')[0]
  }

  function isToday(date) {
    const today = new Date()
    return formatDate(date) === formatDate(today)
  }

  function getWeightColor(weight) {
    if (weight === 0) return null
    
    const maxWeight = 10
    const intensity = Math.min(Math.abs(weight) / maxWeight, 1)
    
    if (weight > 0) {
      // Green for positive
      const lightness = 90 - intensity * 40
      return `hsl(142, 70%, ${lightness}%)`
    } else {
      // Red for negative
      const lightness = 90 - intensity * 40
      return `hsl(0, 70%, ${lightness}%)`
    }
  }

  function prevMonth() {
    currentDate.value = new Date(year.value, month.value - 1, 1)
  }

  function nextMonth() {
    currentDate.value = new Date(year.value, month.value + 1, 1)
  }

  function goToToday() {
    currentDate.value = new Date()
  }

  return {
    year,
    month,
    calendarDays,
    formatDate,
    getWeightColor,
    prevMonth,
    nextMonth,
    goToToday
  }
}
