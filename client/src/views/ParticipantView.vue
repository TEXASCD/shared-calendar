<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { calculateColorMap, WEIGHTS, getContrastColor } from '../utils/colorGradient'

const router = useRouter()
const route = useRoute()

const eventId = route.params.id
const participantName = sessionStorage.getItem(`participant_name_${eventId}`)
const participantId = sessionStorage.getItem(`participant_id_${eventId}`)
const isAlsoOrganizer = !!sessionStorage.getItem(`organizer_token_${eventId}`)
const encodedName = encodeURIComponent(participantName)

// State
const event = ref(null)
const participants = ref([])
const availability = ref([])
const myAvailability = ref({})
const comments = ref([])
const tags = ref([])
const dateNotes = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const error = ref('')
const newComment = ref('')
const selectionMode = ref('available')
const editingCommentId = ref(null)
const editingCommentContent = ref('')

// Calendar state
const currentDate = ref(new Date())
const isDragging = ref(false)
const dragStart = ref(null)
const dragEnd = ref(null)

// Date detail modal state
const showDateDetail = ref(false)
const selectedDate = ref(null)
const myNoteContent = ref('')
const dateTagName = ref('')
const dateTagColor = ref('#6366f1')

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

const notesByDate = computed(() => {
  const map = {}
  dateNotes.value.forEach(n => {
    if (!map[n.date]) map[n.date] = []
    map[n.date].push(n)
  })
  return map
})

const tagsByDate = computed(() => {
  const map = {}
  tags.value.forEach(t => {
    if (t.date) {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    }
  })
  return map
})

const calendarDays = computed(() => {
  if (!event.value) return []
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const days = []

  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, -startOffset + i + 1)
    days.push({ date: d, dateKey: formatDate(d), isCurrentMonth: false, isInRange: false })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    const dateKey = formatDate(d)
    const isInRange = dateKey >= event.value.startDate && dateKey <= event.value.endDate
    days.push({
      date: d, dateKey, isCurrentMonth: true, isInRange,
      color: colorMap.value[dateKey],
      myStatus: myAvailability.value[dateKey]
    })
  }
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    days.push({ date: d, dateKey: formatDate(d), isCurrentMonth: false, isInRange: false })
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
    if (event.value && dateKey >= event.value.startDate && dateKey <= event.value.endDate) {
      keys.add(dateKey)
    }
    current.setDate(current.getDate() + 1)
  }
  return keys
})

const monthLabel = computed(() => {
  const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
  return `${currentDate.value.getFullYear()}年 ${months[currentDate.value.getMonth()]}`
})

// Helpers for date detail modal
function getMyNote(dateKey) {
  return dateNotes.value.find(n => n.date === dateKey && n.participantId === parseInt(participantId))
}
function getOtherNotes(dateKey) {
  return dateNotes.value.filter(n => n.date === dateKey && n.participantId !== parseInt(participantId))
}
function hasDateExtra(dateKey) {
  return (notesByDate.value[dateKey]?.length > 0) || (tagsByDate.value[dateKey]?.length > 0)
}

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
    dates.forEach(dateKey => { myAvailability.value[dateKey] = selectionMode.value })
    await saveAvailability(dates, selectionMode.value)
  }
  isDragging.value = false
  dragStart.value = null
  dragEnd.value = null
}

async function loadData() {
  try {
    const response = await fetch(`/api/events/${eventId}/participant`, {
      headers: { 'X-Participant-Name': encodedName }
    })
    if (!response.ok) throw new Error('加载失败')
    const data = await response.json()
    event.value = data.event
    participants.value = data.participants
    availability.value = data.availability
    comments.value = data.comments
    tags.value = data.tags || []
    dateNotes.value = data.dateNotes || []
    const myData = availability.value.filter(a => a.participantId === parseInt(participantId))
    myData.forEach(a => { myAvailability.value[a.date] = a.status })
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
      headers: { 'Content-Type': 'application/json', 'X-Participant-Name': encodedName },
      body: JSON.stringify({ dates, status })
    })
    if (response.ok) {
      const newAvail = await response.json()
      availability.value = availability.value.filter(
        a => !(a.participantId === parseInt(participantId) && dates.includes(a.date))
      )
      newAvail.forEach(a => { availability.value.push(a) })
    }
  } catch (err) { console.error('保存失败:', err) }
  finally { isSaving.value = false }
}

// ============ Date Detail Modal ============
function openDateDetail(day) {
  if (!day.isInRange) return
  selectedDate.value = day.dateKey
  const myNote = getMyNote(day.dateKey)
  myNoteContent.value = myNote ? myNote.content : ''
  dateTagName.value = ''
  dateTagColor.value = '#6366f1'
  showDateDetail.value = true
}
function closeDateDetail() {
  showDateDetail.value = false
  selectedDate.value = null
}

async function saveDateNote() {
  if (!myNoteContent.value.trim()) return
  try {
    const response = await fetch(`/api/events/${eventId}/date-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Participant-Name': encodedName },
      body: JSON.stringify({ date: selectedDate.value, content: myNoteContent.value.trim() })
    })
    if (response.ok) {
      const note = await response.json()
      const idx = dateNotes.value.findIndex(n => n.date === note.date && n.participantId === note.participantId)
      if (idx >= 0) dateNotes.value[idx] = note
      else dateNotes.value.push(note)
    }
  } catch (err) { console.error('保存备注失败:', err) }
}

async function deleteMyDateNote() {
  const myNote = getMyNote(selectedDate.value)
  if (!myNote) return
  try {
    await fetch(`/api/events/${eventId}/date-notes/${myNote.id}`, {
      method: 'DELETE',
      headers: { 'X-Participant-Name': encodedName }
    })
    dateNotes.value = dateNotes.value.filter(n => n.id !== myNote.id)
    myNoteContent.value = ''
  } catch (err) { console.error('删除备注失败:', err) }
}

async function addTagToDate() {
  if (!dateTagName.value.trim()) return
  try {
    const response = await fetch(`/api/events/${eventId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Participant-Name': encodedName },
      body: JSON.stringify({ name: dateTagName.value.trim(), color: dateTagColor.value, date: selectedDate.value })
    })
    if (response.ok) {
      const tag = await response.json()
      tags.value.push(tag)
      dateTagName.value = ''
    }
  } catch (err) { console.error('添加标签失败:', err) }
}

async function removeTag(tagId) {
  try {
    await fetch(`/api/events/${eventId}/tags/${tagId}`, {
      method: 'DELETE',
      headers: { 'X-Participant-Name': encodedName }
    })
    tags.value = tags.value.filter(t => t.id !== tagId)
  } catch (err) { console.error('删除标签失败:', err) }
}

// ============ Comments ============
async function addComment() {
  if (!newComment.value.trim()) return
  try {
    const response = await fetch(`/api/events/${eventId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Participant-Name': encodedName },
      body: JSON.stringify({ content: newComment.value.trim() })
    })
    if (response.ok) {
      const comment = await response.json()
      comments.value.push(comment)
      newComment.value = ''
    }
  } catch (err) { console.error('添加评论失败:', err) }
}
async function deleteMyComment(commentId) {
  if (!confirm('确定删除此评论？')) return
  try {
    await fetch(`/api/events/${eventId}/comments/${commentId}`, {
      method: 'DELETE', headers: { 'X-Participant-Name': encodedName }
    })
    comments.value = comments.value.filter(c => c.id !== commentId)
  } catch (err) { console.error('删除评论失败:', err) }
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
  if (!editingCommentContent.value.trim()) { alert('评论内容不能为空'); return }
  try {
    const response = await fetch(`/api/events/${eventId}/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Participant-Name': encodedName },
      body: JSON.stringify({ content: editingCommentContent.value.trim() })
    })
    if (response.ok) {
      const updated = await response.json()
      const idx = comments.value.findIndex(c => c.id === commentId)
      if (idx !== -1) comments.value[idx] = updated
      cancelEditComment()
    } else {
      const data = await response.json()
      alert('编辑失败: ' + (data.error || '未知错误'))
    }
  } catch (err) { console.error('编辑评论失败:', err) }
}

function switchToOrganizer() { router.push(`/event/${eventId}/organizer`) }
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

onMounted(() => { loadData() })
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
        <button v-if="isAlsoOrganizer" class="btn-organizer-switch" @click="switchToOrganizer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          管理视图
        </button>
        <button class="btn-ghost" @click="logout">退出</button>
      </div>
    </header>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div><p>加载中...</p>
    </div>
    <div v-else-if="error && !event" class="error-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>{{ error }}</p>
      <button class="btn-primary" @click="loadData()">重新加载</button>
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

        <div class="selection-mode">
          <span>选择模式：</span>
          <button :class="['mode-btn', { active: selectionMode === 'available' }]" @click="selectionMode = 'available'">
            <span class="mode-indicator available"></span>可以参加
          </button>
          <button :class="['mode-btn', { active: selectionMode === 'unavailable' }]" @click="selectionMode = 'unavailable'">
            <span class="mode-indicator unavailable"></span>无法参加
          </button>
        </div>

        <p class="calendar-hint">拖动选择日期标记可用性 · 点击右下角 <strong>⋯</strong> 添加备注和标签</p>

        <div class="calendar-grid">
          <div v-for="day in ['日','一','二','三','四','五','六']" :key="day" class="weekday-header">{{ day }}</div>

          <div
            v-for="day in calendarDays" :key="day.dateKey"
            :class="['day-cell', ...getDayClass(day)]"
            :style="day.isInRange && day.color && !day.myStatus ? { backgroundColor: day.color, color: getContrastColor(day.color) } : {}"
            @mousedown.prevent="handleDayMouseDown(day)"
            @mouseenter="handleDayMouseEnter(day)"
          >
            <span class="day-number">{{ day.date.getDate() }}</span>
            <span v-if="day.myStatus" class="my-status-icon">{{ day.myStatus === 'available' ? '✓' : '✗' }}</span>

            <!-- 标签色点 -->
            <div v-if="day.isInRange && tagsByDate[day.dateKey]?.length" class="day-tag-dots">
              <span v-for="t in tagsByDate[day.dateKey].slice(0, 3)" :key="t.id" class="tag-dot" :style="{ background: t.color }"></span>
              <span v-if="tagsByDate[day.dateKey].length > 3" class="tag-dot-more">+{{ tagsByDate[day.dateKey].length - 3 }}</span>
            </div>

            <!-- 备注指示器 -->
            <span v-if="day.isInRange && notesByDate[day.dateKey]?.length" class="note-indicator">✎</span>

            <!-- 详情按钮 -->
            <button v-if="day.isInRange" class="day-detail-btn" @mousedown.stop @click.stop="openDateDetail(day)" title="备注与标签">⋯</button>

            <!-- 悬浮气泡 -->
            <div v-if="day.isInRange && hasDateExtra(day.dateKey)" class="day-tooltip">
              <div v-if="tagsByDate[day.dateKey]?.length" class="tooltip-section">
                <div class="tooltip-label">标签</div>
                <div class="tooltip-tags">
                  <span v-for="t in tagsByDate[day.dateKey]" :key="t.id" class="tooltip-tag">
                    <span class="tooltip-tag-dot" :style="{ background: t.color }"></span>{{ t.name }}
                  </span>
                </div>
              </div>
              <div v-if="notesByDate[day.dateKey]?.length" class="tooltip-section">
                <div class="tooltip-label">备注</div>
                <div v-for="n in notesByDate[day.dateKey]" :key="n.id" class="tooltip-note">
                  <strong>{{ n.participantName }}：</strong>{{ n.content }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="legend-section">
          <div class="color-legend">
            <span class="legend-title">整体情况：</span>
            <span class="legend-item"><span class="legend-color" style="background:#22c55e"></span>最佳</span>
            <span class="legend-item"><span class="legend-color" style="background:#eab308"></span>一般</span>
            <span class="legend-item"><span class="legend-color" style="background:#ef4444"></span>较差</span>
          </div>
          <div class="my-legend">
            <span class="legend-title">我的标记：</span>
            <span class="legend-item"><span class="legend-color my-available-color"></span>可以参加</span>
            <span class="legend-item"><span class="legend-color my-unavailable-color"></span>无法参加</span>
          </div>
        </div>
      </section>

      <!-- 右侧面板 -->
      <aside class="side-panel">
        <div class="panel-card card">
          <h3>活动信息</h3>
          <p class="event-date">{{ event.startDate }} 至 {{ event.endDate }}</p>
          <p v-if="event.description" class="event-desc">{{ event.description }}</p>
          <p class="organizer-info">发起者：{{ event.organizerName }}</p>
        </div>

        <!-- 标签管理 -->
        <div class="panel-card card">
          <h3>标签 ({{ tags.length }})</h3>
          <div class="tag-list">
            <div v-for="tag in tags" :key="tag.id" class="tag-item-row">
              <span class="tag-color" :style="{ background: tag.color }"></span>
              <span class="tag-name">{{ tag.name }}</span>
              <span v-if="tag.date" class="tag-date-badge">{{ tag.date.slice(5) }}</span>
              <span v-if="tag.participantName" class="tag-creator">{{ tag.participantName }}</span>
              <button v-if="tag.participantId === parseInt(participantId)" class="btn-icon btn-sm" @click="removeTag(tag.id)" title="删除">×</button>
            </div>
            <p v-if="!tags.length" class="no-data">暂无标签，点击日期中的 ⋯ 添加</p>
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
                  <button class="btn-icon btn-edit" @click="startEditComment(c)">✎</button>
                  <button class="btn-icon btn-danger" @click="deleteMyComment(c.id)">×</button>
                </div>
              </div>
              <div v-if="editingCommentId === c.id" class="comment-edit-form">
                <textarea v-model="editingCommentContent" rows="2" maxlength="500"></textarea>
                <div class="comment-edit-actions">
                  <button class="btn-ghost btn-sm" @click="cancelEditComment">取消</button>
                  <button class="btn-primary btn-sm" @click="saveEditComment(c.id)">保存</button>
                </div>
              </div>
              <p v-else>{{ c.content }}</p>
            </li>
          </ul>
          <div class="comment-form">
            <textarea v-model="newComment" placeholder="写下您的评论..." rows="2" maxlength="500"></textarea>
            <button class="btn-primary btn-sm" @click="addComment" :disabled="!newComment.trim()">发表</button>
          </div>
        </div>
      </aside>
    </main>

    <!-- ========== 日期详情弹窗 ========== -->
    <div v-if="showDateDetail" class="modal-overlay" @click.self="closeDateDetail">
      <div class="modal-content card date-detail-modal">
        <div class="modal-header">
          <h2>{{ selectedDate }}</h2>
          <button class="btn-ghost btn-sm" @click="closeDateDetail">关闭</button>
        </div>

        <!-- 我的备注 -->
        <div class="detail-section">
          <h3>我的备注</h3>
          <textarea v-model="myNoteContent" placeholder="在此日期添加备注..." rows="3" maxlength="500" class="note-textarea"></textarea>
          <div class="note-actions">
            <button class="btn-primary btn-sm" @click="saveDateNote" :disabled="!myNoteContent.trim()">保存备注</button>
            <button v-if="getMyNote(selectedDate)" class="btn-ghost btn-sm btn-danger-text" @click="deleteMyDateNote">删除备注</button>
          </div>
        </div>

        <!-- 其他人的备注 -->
        <div v-if="getOtherNotes(selectedDate).length" class="detail-section">
          <h3>其他人的备注</h3>
          <div v-for="n in getOtherNotes(selectedDate)" :key="n.id" class="other-note-item">
            <strong>{{ n.participantName }}：</strong>
            <p>{{ n.content }}</p>
          </div>
        </div>

        <!-- 标签管理 -->
        <div class="detail-section">
          <h3>此日期的标签</h3>
          <div class="date-tags-list">
            <div v-for="t in (tagsByDate[selectedDate] || [])" :key="t.id" class="date-tag-chip">
              <span class="tag-color" :style="{ background: t.color }"></span>
              <span>{{ t.name }}</span>
              <span class="tag-creator-small">({{ t.participantName || '发起者' }})</span>
              <button v-if="t.participantId === parseInt(participantId)" class="chip-delete" @click="removeTag(t.id)">×</button>
            </div>
            <p v-if="!tagsByDate[selectedDate]?.length" class="no-data">暂无标签</p>
          </div>
          <div class="add-tag-form">
            <input v-model="dateTagName" placeholder="标签名称" maxlength="50" />
            <input v-model="dateTagColor" type="color" class="color-input" />
            <button class="btn-primary btn-sm" @click="addTagToDate" :disabled="!dateTagName.trim()">添加标签</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.participant-container { min-height: 100vh; background: var(--bg-secondary); user-select: none; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; background: var(--bg-card); border-bottom: 1px solid var(--border-light); }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h1 { font-size: 1.25rem; font-weight: 600; }
.role-badge.participant { background: var(--success); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 500; }
.header-actions { display: flex; align-items: center; gap: 12px; }
.saving-indicator { font-size: 0.875rem; color: var(--primary); }
.btn-organizer-switch { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-organizer-switch:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: var(--shadow-md); }

.loading-state, .error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; }
.error-state svg { color: var(--danger); margin-bottom: 16px; }
.error-state p { color: var(--text-secondary); margin-bottom: 24px; }
.spinner { width: 40px; height: 40px; border: 3px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.main-content { display: grid; grid-template-columns: 1fr 360px; gap: 24px; padding: 24px 32px; max-width: 1400px; margin: 0 auto; }
.calendar-section { padding: 24px; }
.calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.calendar-header h2 { font-size: 1.25rem; font-weight: 600; }
.calendar-nav { display: flex; gap: 8px; }

.selection-mode { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; }
.selection-mode > span { font-size: 0.875rem; color: var(--text-secondary); }
.mode-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: 2px solid var(--border-light); border-radius: 8px; background: var(--bg-primary); cursor: pointer; font-size: 0.875rem; transition: all 0.2s; color: var(--text-primary); }
.mode-btn.active { border-color: var(--primary); background: var(--primary-light); }
.mode-indicator { width: 12px; height: 12px; border-radius: 50%; }
.mode-indicator.available { background: #22c55e; }
.mode-indicator.unavailable { background: #ef4444; }
.calendar-hint { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 16px; }

.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.weekday-header { text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); padding: 8px 0; }

.day-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.875rem; cursor: default; transition: all 0.15s; background: var(--bg-primary); position: relative; overflow: visible; }
.day-cell.other-month { opacity: 0.3; }
.day-cell.out-of-range { background: var(--bg-secondary); opacity: 0.5; cursor: not-allowed; }
.day-cell.in-range { cursor: crosshair; border: 1px solid var(--border-light); }
.day-cell.in-range:hover { transform: scale(1.05); box-shadow: var(--shadow-md); z-index: 20; }
.day-cell.my-available { background: rgba(34, 197, 94, 0.3) !important; border-color: #22c55e !important; }
.day-cell.my-unavailable { background: rgba(239, 68, 68, 0.3) !important; border-color: #ef4444 !important; }
.day-cell.selecting { transform: scale(1.1); box-shadow: var(--shadow-lg); z-index: 10; }
.day-number { font-weight: 500; }
.my-status-icon { font-size: 0.7rem; font-weight: 700; line-height: 1; }

/* 标签色点 */
.day-tag-dots { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); display: flex; gap: 2px; pointer-events: none; }
.tag-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.tag-dot-more { font-size: 0.5rem; color: var(--text-muted); line-height: 6px; }

/* 备注指示器 */
.note-indicator { position: absolute; top: 1px; left: 3px; font-size: 0.55rem; color: var(--primary); pointer-events: none; opacity: 0.8; }

/* 详情按钮 */
.day-detail-btn { display: none; position: absolute; bottom: 1px; right: 2px; background: rgba(99,102,241,0.15); border: none; border-radius: 4px; font-size: 0.6rem; cursor: pointer; padding: 0 3px; line-height: 1.2; color: var(--primary); font-weight: 700; z-index: 5; }
.day-cell.in-range:hover .day-detail-btn { display: block; }

/* 悬浮气泡 */
.day-tooltip { display: none; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; min-width: 180px; max-width: 260px; z-index: 100; box-shadow: var(--shadow-lg); text-align: left; font-size: 0.75rem; pointer-events: none; }
.day-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: var(--bg-card); }
.day-cell.in-range:hover .day-tooltip { display: block; }
.tooltip-section { margin-bottom: 8px; }
.tooltip-section:last-child { margin-bottom: 0; }
.tooltip-label { font-weight: 600; color: var(--text-muted); margin-bottom: 4px; font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.5px; }
.tooltip-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tooltip-tag { display: inline-flex; align-items: center; gap: 4px; background: var(--bg-secondary); padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; }
.tooltip-tag-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tooltip-note { color: var(--text-secondary); margin-bottom: 4px; line-height: 1.4; }
.tooltip-note:last-child { margin-bottom: 0; }
.tooltip-note strong { color: var(--text-primary); }

/* Legend */
.legend-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 12px; }
.color-legend, .my-legend { display: flex; align-items: center; gap: 16px; }
.legend-title { font-size: 0.75rem; color: var(--text-muted); min-width: 70px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--text-secondary); }
.legend-color { width: 16px; height: 16px; border-radius: 4px; }
.my-available-color { background: rgba(34,197,94,0.3); border: 2px solid #22c55e; }
.my-unavailable-color { background: rgba(239,68,68,0.3); border: 2px solid #ef4444; }

/* Side panel */
.side-panel { display: flex; flex-direction: column; gap: 16px; }
.panel-card { padding: 20px; }
.panel-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 12px; }
.event-date { color: var(--primary); font-weight: 500; margin-bottom: 8px; }
.event-desc { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 8px; }
.organizer-info { font-size: 0.75rem; color: var(--text-muted); }

/* Tag list in side panel */
.tag-list { display: flex; flex-direction: column; gap: 6px; }
.tag-item-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-secondary); border-radius: 8px; font-size: 0.8rem; }
.tag-color { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.tag-name { font-weight: 500; }
.tag-date-badge { background: var(--primary-light); color: var(--primary); padding: 1px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500; }
.tag-creator { color: var(--text-muted); font-size: 0.7rem; margin-left: auto; }
.no-data { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }

/* Participants */
.participant-list { list-style: none; padding: 0; }
.participant-list li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-light); font-size: 0.875rem; }
.participant-list li.is-me { font-weight: 600; color: var(--primary); }
.me-badge { background: var(--primary); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.625rem; }

/* Comments */
.comment-list { list-style: none; padding: 0; max-height: 200px; overflow-y: auto; margin-bottom: 16px; }
.comment-item { padding: 12px 0; border-bottom: 1px solid var(--border-light); }
.comment-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.comment-item p { font-size: 0.875rem; color: var(--text-secondary); }
.btn-icon { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; color: var(--text-muted); font-size: 1rem; }
.btn-icon:hover { background: var(--bg-secondary); }
.btn-icon.btn-danger:hover { color: var(--danger); }
.comment-actions { display: flex; gap: 4px; }
.btn-edit { font-size: 0.875rem; }
.comment-item.editing { background: var(--bg-secondary); padding: 12px; margin: -12px 0; border-radius: 8px; }
.comment-edit-form { margin-top: 8px; }
.comment-edit-form textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--primary); border-radius: 8px; font-size: 0.875rem; resize: none; background: var(--bg-primary); color: var(--text-primary); }
.comment-edit-actions { display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end; }
.comment-form { display: flex; flex-direction: column; gap: 8px; }
.comment-form textarea { padding: 10px 12px; border: 1px solid var(--border-light); border-radius: 8px; font-size: 0.875rem; resize: none; background: var(--bg-primary); color: var(--text-primary); }
.comment-form textarea:focus { outline: none; border-color: var(--primary); }
.comment-form .btn-primary { align-self: flex-end; }

/* ========== Date Detail Modal ========== */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.date-detail-modal { width: 100%; max-width: 500px; padding: 28px 32px; max-height: 80vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-header h2 { font-size: 1.2rem; font-weight: 700; }
.detail-section { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light); }
.detail-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.detail-section h3 { font-size: 0.875rem; font-weight: 600; margin-bottom: 10px; color: var(--text-primary); }
.note-textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--border-light); border-radius: 8px; font-size: 0.875rem; resize: none; background: var(--bg-primary); color: var(--text-primary); transition: border-color 0.2s; }
.note-textarea:focus { outline: none; border-color: var(--primary); }
.note-actions { display: flex; gap: 10px; margin-top: 10px; }
.btn-danger-text { color: var(--danger) !important; }
.btn-danger-text:hover { background: rgba(239,68,68,0.1) !important; }

.other-note-item { padding: 10px 14px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px; font-size: 0.85rem; }
.other-note-item:last-child { margin-bottom: 0; }
.other-note-item strong { color: var(--text-primary); }
.other-note-item p { color: var(--text-secondary); margin-top: 2px; }

.date-tags-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.date-tag-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--bg-secondary); padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; }
.tag-creator-small { font-size: 0.7rem; color: var(--text-muted); }
.chip-delete { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 2px; font-size: 1rem; opacity: 0.6; margin-left: 2px; }
.chip-delete:hover { opacity: 1; color: var(--danger); }

.add-tag-form { display: flex; gap: 8px; align-items: center; }
.add-tag-form input[type="text"] { flex: 1; padding: 8px 12px; border: 1px solid var(--border-light); border-radius: 8px; font-size: 0.85rem; background: var(--bg-primary); color: var(--text-primary); }
.add-tag-form input[type="text"]:focus { outline: none; border-color: var(--primary); }
.color-input { width: 36px; height: 36px; padding: 0; border: none; border-radius: 8px; cursor: pointer; }

@media (max-width: 1024px) {
  .main-content { grid-template-columns: 1fr; padding: 16px; }
  .side-panel { order: -1; }
}
</style>
