import { reactive, readonly, toRefs } from 'vue'

/**
 * 集中状态管理 (替代散落的 provide/inject)
 * 不用 Pinia 是因为项目较小，但遵循相同原则
 */

// ============================================
// State
// ============================================
const state = reactive({
  // User
  userName: localStorage.getItem('calendar_user') || '',
  joined: false,
  
  // Data
  events: [],
  tags: [],
  marks: [],
  onlineCount: 0,
  
  // UI
  selectedDate: null,
  selectedDates: [],
  currentDate: new Date(),
  
  // Modals
  showEventModal: false,
  showTagModal: false,
  editingEvent: null,
  
  // Connection
  connected: false,
  lastError: null
})

// ============================================
// Getters (Computed-like)
// ============================================
function getEventsForDate(date) {
  if (!date) return []
  const dateKey = formatDate(date)
  return state.events
    .filter(e => e.date === dateKey)
    .sort((a, b) => a.start.localeCompare(b.start))
}

function getWeightForDate(dateKey) {
  return state.marks
    .filter(m => m.date === dateKey)
    .reduce((sum, m) => sum + m.weight, 0)
}

function getMarksForDate(dateKey) {
  return state.marks.filter(m => m.date === dateKey)
}

function formatDate(date) {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

// ============================================
// Actions (Mutations)
// ============================================
function setUser(name) {
  state.userName = name
  localStorage.setItem('calendar_user', name)
}

function setJoined(value) {
  state.joined = value
}

function setConnected(value) {
  state.connected = value
}

function setError(error) {
  state.lastError = error
  console.error('[Store] Error:', error)
}

function clearError() {
  state.lastError = null
}

// Data mutations
function setInitialData({ events, tags, marks }) {
  state.events = events || []
  state.tags = tags || []
  state.marks = marks || []
}

function setOnlineCount(count) {
  state.onlineCount = count
}

function addEvent(event) {
  state.events.push(event)
}

function updateEvent(event) {
  const idx = state.events.findIndex(e => e.id === event.id)
  if (idx !== -1) {
    state.events[idx] = event
  }
}

function removeEvent(id) {
  state.events = state.events.filter(e => e.id !== id)
}

function addTag(tag) {
  state.tags.push(tag)
}

function addMarks(marks) {
  state.marks.push(...marks)
}

// UI mutations
function setSelectedDate(date) {
  state.selectedDate = date
}

function setSelectedDates(dates) {
  state.selectedDates = dates
}

function setCurrentDate(date) {
  state.currentDate = date
}

function openEventModal(event = null) {
  state.editingEvent = event
  state.showEventModal = true
}

function closeEventModal() {
  state.showEventModal = false
  state.editingEvent = null
}

function openTagModal() {
  state.showTagModal = true
}

function closeTagModal() {
  state.showTagModal = false
}

// ============================================
// Message Handler (WebSocket)
// ============================================
function handleMessage(message) {
  switch (message.type) {
    case 'init':
      setInitialData(message)
      break
    case 'presence':
      setOnlineCount(message.count)
      break
    case 'event_added':
      addEvent(message.event)
      break
    case 'event_updated':
      updateEvent(message.event)
      break
    case 'event_deleted':
      removeEvent(message.id)
      break
    case 'tag_added':
      addTag(message.tag)
      break
    case 'marks_added':
      addMarks(message.marks)
      break
    case 'error':
      setError(message.message)
      break
    default:
      console.warn('[Store] Unknown message type:', message.type)
  }
}

// ============================================
// Export
// ============================================
export function useStore() {
  return {
    // State (readonly to prevent direct mutation)
    state: readonly(state),
    
    // Refs for v-model
    ...toRefs(state),
    
    // Getters
    getEventsForDate,
    getWeightForDate,
    getMarksForDate,
    formatDate,
    
    // Actions
    setUser,
    setJoined,
    setConnected,
    setError,
    clearError,
    setInitialData,
    setOnlineCount,
    addEvent,
    updateEvent,
    removeEvent,
    addTag,
    addMarks,
    setSelectedDate,
    setSelectedDates,
    setCurrentDate,
    openEventModal,
    closeEventModal,
    openTagModal,
    closeTagModal,
    handleMessage
  }
}
