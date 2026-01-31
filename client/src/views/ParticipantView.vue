<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { calculateColorMap, WEIGHTS, getContrastColor } from '../utils/colorGradient'

const router = useRouter()
const route = useRoute()

const eventId = route.params.id
const participantName = sessionStorage.getItem(`participant_name_${eventId}`)
const participantId = sessionStorage.getItem(`participant_id_${eventId}`)

// State
const event = ref(null)
const participants = ref([])
const availability = ref([])
const myAvailability = ref({}) // { 'YYYY-MM-DD': 'available' | 'unavailable' }
const comments = ref([])
const tags = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const error = ref('')
const newComment = ref('')
const selectionMode = ref('available') // 'available' or 'unavailable'
const editingCommentId = ref(null)
const editingCommentContent = ref('')

// Calendar state
const currentDate = ref(new Date())
const isDragging = ref(false)
const dragStart = ref(null)
const dragEnd = ref(null)

// Computed
const colorMap = computed(() => {
  if (!availability.value.length || !participants.value.length) return {}
  
  const byDate = {}
  availability.value.forEach(a => {
    if (!byDate[a.date]) byDate[a.date] = []
    byDate[a.date].push(a)
  })
  
  return calculateColorMap(byDate, participants.value.length)
})

const calendarDays = computed(() => {
  if (!event.value) return []
  
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  
  const days = []
  
  // 填充上月日期
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, -startOffset + i + 1)
    days.push({
      date: d,
      dateKey: formatDate(d),
      isCurrentMonth: false,
      isInRange: false
    })
  }
  
  // 当月日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    const dateKey = formatDate(d)
    const isInRange = dateKey >= event.value.startDate && dateKey <= event.value.endDate
    
    days.push({
      date: d,
      dateKey,
      isCurrentMonth: true,
      isInRange,
      color: colorMap.value[dateKey],
      myStatus: myAvailability.value[dateKey]
    })
  }
  
  // 填充下月日期
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    days.push({
      date: d,
      dateKey: formatDate(d),
      isCurrentMonth: false,
      isInRange: false
    })
  }
  
  return days
})

const selectedDateKeys = computed(() => {
  if (!isDragging.value || !dragStart.value) return new Set()
  
  const start = dragStart.value
  const end = dragEnd.value || start
  const startTime = Math.min(new Date(start).getTime(), new Date(end).getTime())
  const endTime = Math.max(new Date(start).getTime(), new Date(end).getTime())
  
  const keys = new Set()
  const current = new Date(startTime)
  while (current.getTime() <= endTime) {
    const dateKey = formatDate(current)
    // 只选择范围内的日期
    if (event.value && dateKey >= event.value.startDate && dateKey <= event.value.endDate) {
      keys.add(dateKey)
    }
    current.setDate(current.getDate() + 1)
  }
  return keys
})

const monthLabel = computed(() => {
  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return `${currentDate.value.getFullYear()}年 ${months[currentDate.value.getMonth()]}`
})

// Methods
function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function prevMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

function handleDayMouseDown(day) {
  if (!day.isInRange) return
  
  isDragging.value = true
  dragStart.value = day.dateKey
  dragEnd.value = day.dateKey
}

function handleDayMouseEnter(day) {
  if (isDragging.value && day.isInRange) {
    dragEnd.value = day.dateKey
  }
}

async function handleMouseUp() {
  if (!isDragging.value) return
  
  const dates = Array.from(selectedDateKeys.value)
  if (dates.length > 0) {
    // 更新本地状态
    dates.forEach(dateKey => {
      myAvailability.value[dateKey] = selectionMode.value
    })
    
    // 保存到服务器
    await saveAvailability(dates, selectionMode.value)
  }
  
  isDragging.value = false
  dragStart.value = null
  dragEnd.value = null
}

async function loadData() {
  try {
    const response = await fetch(`/api/events/${eventId}/participant`, {
      headers: { 'X-Participant-Name': participantName }
    })
    
    if (!response.ok) throw new Error('加载失败')
    
    const data = await response.json()
    event.value = data.event
    participants.value = data.participants
    availability.value = data.availability
    comments.value = data.comments
    tags.value = data.tags
    
    // 提取我的可用性
    const myData = availability.value.filter(a => a.participantId === parseInt(participantId))
    myData.forEach(a => {
      myAvailability.value[a.date] = a.status
    })
  } catch (err) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

async function saveAvailability(dates, status) {
  isSaving.value = true
  
  try {
    const response = await fetch(`/api/events/${eventId}/availability`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Participant-Name': participantName
      },
      body: JSON.stringify({ dates, status })
    })
    
    if (response.ok) {
      // 更新本地 availability 数据
      const newAvail = await response.json()
      
      // 移除旧数据
      availability.value = availability.value.filter(
        a => !(a.participantId === parseInt(participantId) && dates.includes(a.date))
      )
      
      // 添加新数据
      newAvail.forEach(a => {
        availability.value.push(a)
      })
    }
  } catch (err) {
    console.error('保存失败:', err)
  } finally {
    isSaving.value = false
  }
}

async function addComment() {
  if (!newComment.value.trim()) return
  
  try {
    const response = await fetch(`/api/events/${eventId}/comments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Participant-Name': participantName
      },
      body: JSON.stringify({ content: newComment.value.trim() })
    })
    
    if (response.ok) {
      const comment = await response.json()
      comments.value.push(comment)
      newComment.value = ''
    }
  } catch (err) {
    console.error('添加评论失败:', err)
  }
}

async function deleteMyComment(commentId) {
  if (!confirm('确定删除此评论？')) return
  
  try {
    await fetch(`/api/events/${eventId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'X-Participant-Name': participantName }
    })
    comments.value = comments.value.filter(c => c.id !== commentId)
  } catch (err) {
    console.error('删除评论失败:', err)
  }
}

function startEditComment(comment) {
  editingCommentId.value = comment.id
  editingCommentContent.value = comment.content
}

function cancelEditComment() {
  editingCommentId.value = null
  editingCommentContent.value = ''
}

async function saveEditComment(commentId) {
  if (!editingCommentContent.value.trim()) {
    alert('评论内容不能为空')
    return
  }
  
  try {
    const response = await fetch(`/api/events/${eventId}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'X-Participant-Name': participantName
      },
      body: JSON.stringify({ content: editingCommentContent.value.trim() })
    })
    
    if (response.ok) {
      const updatedComment = await response.json()
      const index = comments.value.findIndex(c => c.id === commentId)
      if (index !== -1) {
        comments.value[index] = updatedComment
      }
      cancelEditComment()
    } else {
      const data = await response.json()
      alert('编辑失败: ' + (data.error || '未知错误'))
    }
  } catch (err) {
    console.error('编辑评论失败:', err)
  }
}

function logout() {
  sessionStorage.removeItem(`participant_name_${eventId}`)
  sessionStorage.removeItem(`participant_id_${eventId}`)
  router.push(`/event/${eventId}`)
}

function getDayClass(day) {
  const classes = []
  if (!day.isCurrentMonth) classes.push('other-month')
  if (!day.isInRange && day.isCurrentMonth) classes.push('out-of-range')
  if (day.isInRange) classes.push('in-range')
  if (day.myStatus === 'available') classes.push('my-available')
  if (day.myStatus === 'unavailable') classes.push('my-unavailable')
  if (selectedDateKeys.value.has(day.dateKey)) classes.push('selecting')
  return classes
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="participant-container" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
    <!-- Header -->
    <header class="page-header">
      <div class="header-left">
        <h1 v-if="event">{{ event.title }}</h1>
        <span class="role-badge participant">{{ participantName }}</span>
      </div>
      <div class="header-actions">
        <span v-if="isSaving" class="saving-indicator">保存中...</span>
        <button class="btn-ghost" @click="logout">退出</button>
      </div>
    </header>
    
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>
    
    <main v-else-if="event" class="main-content">
      <!-- 左侧：日历 -->
      <section class="calendar-section card">
        <div class="calendar-header">
          <h2>{{ monthLabel }}</h2>
          <div class="calendar-nav">
            <button class="btn-ghost btn-sm" @click="prevMonth">上月</button>
            <button class="btn-ghost btn-sm" @click="nextMonth">下月</button>
          </div>
        </div>
        
        <!-- 选择模式 -->
        <div class="selection-mode">
          <span>选择模式：</span>
          <button 
            :class="['mode-btn', { active: selectionMode === 'available' }]"
            @click="selectionMode = 'available'"
          >
            <span class="mode-indicator available"></span>
            可以参加
          </button>
          <button 
            :class="['mode-btn', { active: selectionMode === 'unavailable' }]"
            @click="selectionMode = 'unavailable'"
          >
            <span class="mode-indicator unavailable"></span>
            无法参加
          </button>
        </div>
        
        <p class="calendar-hint">提示：在日历上拖动以批量选择日期</p>
        
        <div class="calendar-grid">
          <div v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="weekday-header">
            {{ day }}
          </div>
          
          <div
            v-for="day in calendarDays"
            :key="day.dateKey"
            :class="['day-cell', ...getDayClass(day)]"
            :style="day.isInRange && day.color && !day.myStatus ? { 
              backgroundColor: day.color,
              color: getContrastColor(day.color)
            } : {}"
            @mousedown.prevent="handleDayMouseDown(day)"
            @mouseenter="handleDayMouseEnter(day)"
          >
            <span class="day-number">{{ day.date.getDate() }}</span>
            <span v-if="day.myStatus" class="my-status-icon">
              {{ day.myStatus === 'available' ? '✓' : '✗' }}
            </span>
          </div>
        </div>
        
        <div class="legend-section">
          <div class="color-legend">
            <span class="legend-title">整体情况：</span>
            <span class="legend-item">
              <span class="legend-color" style="background: #22c55e"></span>
              最佳
            </span>
            <span class="legend-item">
              <span class="legend-color" style="background: #eab308"></span>
              一般
            </span>
            <span class="legend-item">
              <span class="legend-color" style="background: #ef4444"></span>
              较差
            </span>
          </div>
          <div class="my-legend">
            <span class="legend-title">我的标记：</span>
            <span class="legend-item">
              <span class="legend-color my-available-color"></span>
              可以参加
            </span>
            <span class="legend-item">
              <span class="legend-color my-unavailable-color"></span>
              无法参加
            </span>
          </div>
        </div>
      </section>
      
      <!-- 右侧面板 -->
      <aside class="side-panel">
        <!-- 活动信息 -->
        <div class="panel-card card">
          <h3>活动信息</h3>
          <p class="event-date">{{ event.startDate }} 至 {{ event.endDate }}</p>
          <p v-if="event.description" class="event-desc">{{ event.description }}</p>
          <p class="organizer-info">发起者：{{ event.organizerName }}</p>
        </div>
        
        <!-- 标签列表 -->
        <div v-if="tags.length" class="panel-card card">
          <h3>标签</h3>
          <div class="tag-list">
            <span v-for="tag in tags" :key="tag.id" class="tag-item">
              <span class="tag-color" :style="{ background: tag.color }"></span>
              {{ tag.name }}
            </span>
          </div>
        </div>
        
        <!-- 参与者列表 -->
        <div class="panel-card card">
          <h3>参与者 ({{ participants.length }})</h3>
          <ul class="participant-list">
            <li v-for="p in participants" :key="p.id" :class="{ 'is-me': p.id === parseInt(participantId) }">
              {{ p.name }}
              <span v-if="p.id === parseInt(participantId)" class="me-badge">我</span>
            </li>
          </ul>
        </div>
        
        <!-- 评论区 -->
        <div class="panel-card card">
          <h3>评论 ({{ comments.length }})</h3>
          <ul class="comment-list">
            <li v-for="c in comments" :key="c.id" class="comment-item" :class="{ editing: editingCommentId === c.id }">
              <div class="comment-header">
                <strong>{{ c.participantName }}</strong>
                <div v-if="c.participantId === parseInt(participantId)" class="comment-actions">
                  <button class="btn-icon btn-edit" @click="startEditComment(c)" title="编辑">✎</button>
                  <button class="btn-icon btn-danger" @click="deleteMyComment(c.id)" title="删除">×</button>
                </div>
              </div>
              <!-- 编辑模式 -->
              <div v-if="editingCommentId === c.id" class="comment-edit-form">
                <textarea 
                  v-model="editingCommentContent" 
                  rows="2" 
                  maxlength="500"
                ></textarea>
                <div class="comment-edit-actions">
                  <button class="btn-ghost btn-sm" @click="cancelEditComment">取消</button>
                  <button class="btn-primary btn-sm" @click="saveEditComment(c.id)">保存</button>
                </div>
              </div>
              <!-- 显示模式 -->
              <p v-else>{{ c.content }}</p>
            </li>
          </ul>
          
          <div class="comment-form">
            <textarea 
              v-model="newComment" 
              placeholder="写下您的评论..."
              rows="2"
              maxlength="500"
            ></textarea>
            <button class="btn-primary btn-sm" @click="addComment" :disabled="!newComment.trim()">
              发表
            </button>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.participant-container {
  min-height: 100vh;
  background: var(--bg-secondary);
  user-select: none;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.role-badge.participant {
  background: var(--success);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.saving-indicator {
  font-size: 0.875rem;
  color: var(--primary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-light);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.calendar-section {
  padding: 24px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.calendar-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.calendar-nav {
  display: flex;
  gap: 8px;
}

.selection-mode {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.selection-mode span {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 2px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.mode-btn.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.mode-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.mode-indicator.available {
  background: #22c55e;
}

.mode-indicator.unavailable {
  background: #ef4444;
}

.calendar-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday-header {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 0;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: default;
  transition: all 0.15s;
  background: var(--bg-primary);
  position: relative;
}

.day-cell.other-month {
  opacity: 0.3;
}

.day-cell.out-of-range {
  background: var(--bg-secondary);
  opacity: 0.5;
  cursor: not-allowed;
}

.day-cell.in-range {
  cursor: crosshair;
  border: 1px solid var(--border-light);
}

.day-cell.in-range:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

.day-cell.my-available {
  background: rgba(34, 197, 94, 0.3) !important;
  border-color: #22c55e !important;
}

.day-cell.my-unavailable {
  background: rgba(239, 68, 68, 0.3) !important;
  border-color: #ef4444 !important;
}

.day-cell.selecting {
  transform: scale(1.1);
  box-shadow: var(--shadow-lg);
  z-index: 10;
}

.day-number {
  font-weight: 500;
}

.my-status-icon {
  font-size: 0.75rem;
  font-weight: 700;
}

.legend-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.color-legend,
.my-legend {
  display: flex;
  align-items: center;
  gap: 16px;
}

.legend-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  min-width: 70px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.my-available-color {
  background: rgba(34, 197, 94, 0.3);
  border: 2px solid #22c55e;
}

.my-unavailable-color {
  background: rgba(239, 68, 68, 0.3);
  border: 2px solid #ef4444;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  padding: 20px;
}

.panel-card h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.event-date {
  color: var(--primary);
  font-weight: 500;
  margin-bottom: 8px;
}

.event-desc {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 8px;
}

.organizer-info {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
}

.tag-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.participant-list {
  list-style: none;
  padding: 0;
}

.participant-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.875rem;
}

.participant-list li.is-me {
  font-weight: 600;
  color: var(--primary);
}

.me-badge {
  background: var(--primary);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.625rem;
}

.comment-list {
  list-style: none;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.comment-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.comment-item p {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 1rem;
}

.btn-icon:hover {
  background: var(--bg-secondary);
}

.btn-icon.btn-danger:hover {
  color: var(--danger);
}

.comment-actions {
  display: flex;
  gap: 4px;
}

.btn-edit {
  font-size: 0.875rem;
}

.comment-item.editing {
  background: var(--bg-secondary);
  padding: 12px;
  margin: -12px 0;
  border-radius: 8px;
}

.comment-edit-form {
  margin-top: 8px;
}

.comment-edit-form textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--primary);
  border-radius: 8px;
  font-size: 0.875rem;
  resize: none;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.comment-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-form textarea {
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 0.875rem;
  resize: none;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.comment-form textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.comment-form .btn-primary {
  align-self: flex-end;
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  
  .side-panel {
    order: -1;
  }
}
</style>
