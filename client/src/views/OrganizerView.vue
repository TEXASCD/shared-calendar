<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { calculateColorMap, getStatistics, WEIGHTS, getContrastColor } from '../utils/colorGradient'

const router = useRouter()
const route = useRoute()

const eventId = route.params.id
const organizerToken = sessionStorage.getItem(`organizer_token_${eventId}`)
const organizerName = sessionStorage.getItem(`organizer_name_${eventId}`)

// State
const event = ref(null)
const participants = ref([])
const availability = ref([])
const comments = ref([])
const tags = ref([])
const isLoading = ref(true)
const error = ref('')
const showShareModal = ref(false)
const showStatsPanel = ref(false)
const newTagName = ref('')
const newTagColor = ref('#6366f1')
const editingCommentId = ref(null)
const editingCommentContent = ref('')
const editingParticipantId = ref(null)
const editingParticipantName = ref('')
const selectedParticipantId = ref(null)
const participantDetails = ref(null)
const showAvailabilityModal = ref(false)
const availabilityModalParticipant = ref(null)
const availabilityModalDates = ref([])
const availabilityModalStatus = ref('available')
const editingAvailCommentId = ref(null)
const editingAvailCommentContent = ref('')

// Calendar state
const currentDate = ref(new Date())
const selectedDates = ref([])

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

const statistics = computed(() => {
  if (!availability.value.length) return null
  
  const byDate = {}
  availability.value.forEach(a => {
    if (!byDate[a.date]) byDate[a.date] = []
    byDate[a.date].push(a)
  })
  
  return getStatistics(byDate, participants.value)
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
      availableCount: getAvailableCount(dateKey),
      unavailableCount: getUnavailableCount(dateKey)
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

const shareUrl = computed(() => {
  return `${window.location.origin}/event/${eventId}`
})

// Methods
function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function getAvailableCount(dateKey) {
  return availability.value.filter(a => a.date === dateKey && a.status === 'available').length
}

function getUnavailableCount(dateKey) {
  return availability.value.filter(a => a.date === dateKey && a.status === 'unavailable').length
}

function prevMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

async function loadData() {
  try {
    const response = await fetch(`/api/events/${eventId}`, {
      headers: { 'X-Organizer-Token': organizerToken }
    })
    
    if (!response.ok) throw new Error('加载失败')
    
    const data = await response.json()
    event.value = data.event
    participants.value = data.participants
    availability.value = data.availability
    comments.value = data.comments
    tags.value = data.tags
  } catch (err) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

async function addTag() {
  if (!newTagName.value.trim()) return
  
  try {
    const response = await fetch(`/api/events/${eventId}/tags`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Organizer-Token': organizerToken
      },
      body: JSON.stringify({
        name: newTagName.value.trim(),
        color: newTagColor.value
      })
    })
    
    if (response.ok) {
      const tag = await response.json()
      tags.value.push(tag)
      newTagName.value = ''
    }
  } catch (err) {
    console.error('添加标签失败:', err)
  }
}

async function deleteTag(tagId) {
  if (!confirm('确定删除此标签？')) return
  
  try {
    await fetch(`/api/events/${eventId}/tags/${tagId}`, {
      method: 'DELETE',
      headers: { 'X-Organizer-Token': organizerToken }
    })
    tags.value = tags.value.filter(t => t.id !== tagId)
  } catch (err) {
    console.error('删除标签失败:', err)
  }
}

async function deleteParticipant(participantId) {
  if (!confirm('确定删除此参与者及其所有数据？')) return
  
  try {
    await fetch(`/api/events/${eventId}/participants/${participantId}`, {
      method: 'DELETE',
      headers: { 'X-Organizer-Token': organizerToken }
    })
    participants.value = participants.value.filter(p => p.id !== participantId)
    availability.value = availability.value.filter(a => a.participantId !== participantId)
    comments.value = comments.value.filter(c => c.participantId !== participantId)
    // 如果正在查看该参与者的详情，关闭详情面板
    if (selectedParticipantId.value === participantId) {
      selectedParticipantId.value = null
      participantDetails.value = null
    }
  } catch (err) {
    console.error('删除参与者失败:', err)
  }
}

function startEditParticipant(participant) {
  editingParticipantId.value = participant.id
  editingParticipantName.value = participant.name
}

function cancelEditParticipant() {
  editingParticipantId.value = null
  editingParticipantName.value = ''
}

async function saveEditParticipant(participantId) {
  if (!editingParticipantName.value.trim()) {
    alert('名字不能为空')
    return
  }
  
  try {
    const response = await fetch(`/api/events/${eventId}/participants/${participantId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'X-Organizer-Token': organizerToken
      },
      body: JSON.stringify({ name: editingParticipantName.value.trim() })
    })
    
    if (response.ok) {
      const updatedParticipant = await response.json()
      const index = participants.value.findIndex(p => p.id === participantId)
      if (index !== -1) {
        participants.value[index] = updatedParticipant
      }
      cancelEditParticipant()
    } else {
      const data = await response.json()
      alert('修改失败: ' + (data.error || '未知错误'))
    }
  } catch (err) {
    console.error('修改参与者失败:', err)
  }
}

async function showParticipantDetails(participantId) {
  if (selectedParticipantId.value === participantId) {
    // 点击同一个参与者，切换关闭
    selectedParticipantId.value = null
    participantDetails.value = null
    return
  }
  
  selectedParticipantId.value = participantId
  
  try {
    const response = await fetch(`/api/events/${eventId}/participants/${participantId}`, {
      headers: { 'X-Organizer-Token': organizerToken }
    })
    
    if (response.ok) {
      participantDetails.value = await response.json()
    }
  } catch (err) {
    console.error('获取参与者详情失败:', err)
  }
}

function getParticipantStats(participantId) {
  const avail = availability.value.filter(a => a.participantId === participantId)
  const available = avail.filter(a => a.status === 'available').length
  const unavailable = avail.filter(a => a.status === 'unavailable').length
  const commentCount = comments.value.filter(c => c.participantId === participantId).length
  return { available, unavailable, commentCount }
}

// 可用性编辑功能
function openAvailabilityModal(participant) {
  availabilityModalParticipant.value = participant
  availabilityModalDates.value = []
  availabilityModalStatus.value = 'available'
  showAvailabilityModal.value = true
}

function closeAvailabilityModal() {
  showAvailabilityModal.value = false
  availabilityModalParticipant.value = null
  availabilityModalDates.value = []
}

function getUnmarkedDates(participantId) {
  if (!event.value) return []
  
  const markedDates = new Set(
    availability.value
      .filter(a => a.participantId === participantId)
      .map(a => a.date)
  )
  
  const dates = []
  const start = new Date(event.value.startDate)
  const end = new Date(event.value.endDate)
  const current = new Date(start)
  
  while (current <= end) {
    const dateStr = formatDate(current)
    if (!markedDates.has(dateStr)) {
      dates.push(dateStr)
    }
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

async function saveAvailabilityForParticipant() {
  if (availabilityModalDates.value.length === 0) {
    alert('请至少选择一个日期')
    return
  }
  
  try {
    const response = await fetch(
      `/api/events/${eventId}/participants/${availabilityModalParticipant.value.id}/availability`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Organizer-Token': organizerToken
        },
        body: JSON.stringify({
          dates: availabilityModalDates.value,
          status: availabilityModalStatus.value
        })
      }
    )
    
    if (response.ok) {
      const newAvail = await response.json()
      // 更新本地数据
      newAvail.forEach(a => {
        const existing = availability.value.findIndex(
          av => av.participantId === a.participantId && av.date === a.date
        )
        if (existing >= 0) {
          availability.value[existing] = a
        } else {
          availability.value.push(a)
        }
      })
      closeAvailabilityModal()
      // 刷新参与者详情
      if (selectedParticipantId.value === availabilityModalParticipant.value.id) {
        showParticipantDetails(selectedParticipantId.value)
      }
    } else {
      const data = await response.json()
      alert('保存失败: ' + (data.error || '未知错误'))
    }
  } catch (err) {
    console.error('保存可用性失败:', err)
  }
}

async function deleteParticipantAvailability(participantId, date) {
  if (!confirm(`确定要删除 ${date} 的可用性标记吗？`)) return
  
  try {
    const response = await fetch(
      `/api/events/${eventId}/participants/${participantId}/availability`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Organizer-Token': organizerToken
        },
        body: JSON.stringify({ dates: [date] })
      }
    )
    
    if (response.ok) {
      availability.value = availability.value.filter(
        a => !(a.participantId === participantId && a.date === date)
      )
      // 刷新参与者详情
      if (selectedParticipantId.value === participantId) {
        showParticipantDetails(participantId)
      }
    }
  } catch (err) {
    console.error('删除可用性失败:', err)
  }
}

// 参与者评论编辑（在详情面板内）
function startEditAvailComment(comment) {
  editingAvailCommentId.value = comment.id
  editingAvailCommentContent.value = comment.content
}

function cancelEditAvailComment() {
  editingAvailCommentId.value = null
  editingAvailCommentContent.value = ''
}

async function saveEditAvailComment(commentId) {
  if (!editingAvailCommentContent.value.trim()) {
    alert('评论内容不能为空')
    return
  }
  
  try {
    const response = await fetch(`/api/events/${eventId}/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Organizer-Token': organizerToken
      },
      body: JSON.stringify({ content: editingAvailCommentContent.value.trim() })
    })
    
    if (response.ok) {
      const updatedComment = await response.json()
      const index = comments.value.findIndex(c => c.id === commentId)
      if (index !== -1) {
        comments.value[index] = updatedComment
      }
      // 刷新参与者详情
      if (selectedParticipantId.value) {
        showParticipantDetails(selectedParticipantId.value)
      }
      cancelEditAvailComment()
    } else {
      const data = await response.json()
      alert('编辑失败: ' + (data.error || '未知错误'))
    }
  } catch (err) {
    console.error('编辑评论失败:', err)
  }
}

async function deleteAvailComment(commentId) {
  if (!confirm('确定删除此评论？')) return
  
  try {
    await fetch(`/api/events/${eventId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'X-Organizer-Token': organizerToken }
    })
    comments.value = comments.value.filter(c => c.id !== commentId)
    // 刷新参与者详情
    if (selectedParticipantId.value) {
      showParticipantDetails(selectedParticipantId.value)
    }
  } catch (err) {
    console.error('删除评论失败:', err)
  }
}

async function deleteComment(commentId) {
  if (!confirm('确定删除此评论？')) return
  
  try {
    await fetch(`/api/events/${eventId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'X-Organizer-Token': organizerToken }
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
        'X-Organizer-Token': organizerToken
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

function copyShareLink() {
  navigator.clipboard.writeText(shareUrl.value)
  alert('链接已复制！')
}

function switchToParticipant() {
  // 从已加载的参与者列表中找到发起者对应的参与者记录
  const me = participants.value.find(p => p.name === event.value?.organizerName)
  if (me) {
    sessionStorage.setItem(`participant_name_${eventId}`, me.name)
    sessionStorage.setItem(`participant_id_${eventId}`, me.id)
    router.push(`/event/${eventId}/participant`)
  } else {
    alert('未找到您的参与者记录，请通过分享链接加入活动')
  }
}

function logout() {
  sessionStorage.removeItem(`organizer_token_${eventId}`)
  sessionStorage.removeItem(`organizer_name_${eventId}`)
  router.push('/')
}

const monthLabel = computed(() => {
  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return `${currentDate.value.getFullYear()}年 ${months[currentDate.value.getMonth()]}`
})

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="organizer-container">
    <!-- Header -->
    <header class="page-header">
      <div class="header-left">
        <h1 v-if="event">{{ event.title }}</h1>
        <span class="role-badge">发起者</span>
      </div>
      <div class="header-actions">
        <button class="btn-participant-switch" @click="switchToParticipant" title="以参与者身份标记日期">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <polyline points="17 11 19 13 23 9"></polyline>
          </svg>
          参与者视图
        </button>
        <button class="btn-secondary" @click="showShareModal = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          分享
        </button>
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
        
        <div class="calendar-grid">
          <div v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="weekday-header">
            {{ day }}
          </div>
          
          <div
            v-for="day in calendarDays"
            :key="day.dateKey"
            class="day-cell"
            :class="{
              'other-month': !day.isCurrentMonth,
              'in-range': day.isInRange,
              'out-of-range': !day.isInRange && day.isCurrentMonth
            }"
            :style="day.color ? { 
              backgroundColor: day.color,
              color: getContrastColor(day.color)
            } : {}"
          >
            <span class="day-number">{{ day.date.getDate() }}</span>
            <div v-if="day.isInRange && (day.availableCount || day.unavailableCount)" class="day-stats">
              <span class="stat-available">{{ day.availableCount }}</span>
              <span class="stat-unavailable">{{ day.unavailableCount }}</span>
            </div>
          </div>
        </div>
        
        <div class="color-legend">
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
      </section>
      
      <!-- 右侧面板 -->
      <aside class="side-panel">
        <!-- 活动信息 -->
        <div class="panel-card card">
          <h3>活动信息</h3>
          <p class="event-date">{{ event.startDate }} 至 {{ event.endDate }}</p>
          <p v-if="event.description" class="event-desc">{{ event.description }}</p>
          <p class="access-code">访问码: <strong>{{ event.accessCode }}</strong></p>
        </div>
        
        <!-- 统计面板 -->
        <div class="panel-card card">
          <h3>
            统计
            <button class="btn-ghost btn-sm" @click="showStatsPanel = !showStatsPanel">
              {{ showStatsPanel ? '收起' : '展开' }}
            </button>
          </h3>
          
          <div class="stats-summary">
            <div class="stat-box">
              <span class="stat-number">{{ participants.length }}</span>
              <span class="stat-label">参与者</span>
            </div>
            <div class="stat-box">
              <span class="stat-number">{{ statistics?.allAvailableDates?.length || 0 }}</span>
              <span class="stat-label">全员可用日期</span>
            </div>
          </div>
          
          <div v-if="showStatsPanel && statistics" class="stats-detail">
            <h4>最佳日期推荐</h4>
            <ul class="best-dates">
              <li v-for="d in statistics.bestDates" :key="d.date">
                {{ d.date }} - {{ d.availableCount }}人可用
              </li>
            </ul>
          </div>
        </div>
        
        <!-- 标签管理 -->
        <div class="panel-card card">
          <h3>标签管理</h3>
          <div class="tag-list">
            <div v-for="tag in tags" :key="tag.id" class="tag-item">
              <span class="tag-color" :style="{ background: tag.color }"></span>
              <span class="tag-name">{{ tag.name }}</span>
              <button class="btn-icon" @click="deleteTag(tag.id)">×</button>
            </div>
          </div>
          <div class="tag-form">
            <input v-model="newTagName" placeholder="标签名称" maxlength="50" />
            <input v-model="newTagColor" type="color" />
            <button class="btn-primary btn-sm" @click="addTag">添加</button>
          </div>
        </div>
        
        <!-- 参与者列表 -->
        <div class="panel-card card">
          <h3>参与者 ({{ participants.length }})</h3>
          <ul class="participant-list">
            <li 
              v-for="p in participants" 
              :key="p.id" 
              :class="{ 'is-editing': editingParticipantId === p.id, 'is-selected': selectedParticipantId === p.id }"
            >
              <!-- 编辑模式 -->
              <template v-if="editingParticipantId === p.id">
                <div class="participant-edit-form">
                  <input 
                    v-model="editingParticipantName" 
                    type="text" 
                    placeholder="输入新名字"
                    @keyup.enter="saveEditParticipant(p.id)"
                    @keyup.escape="cancelEditParticipant"
                  />
                  <div class="participant-edit-actions">
                    <button class="btn-ghost btn-sm" @click="cancelEditParticipant">取消</button>
                    <button class="btn-primary btn-sm" @click="saveEditParticipant(p.id)">保存</button>
                  </div>
                </div>
              </template>
              <!-- 显示模式 -->
              <template v-else>
                <div class="participant-info" @click="showParticipantDetails(p.id)">
                  <span class="participant-name">
                    {{ p.name }}
                    <span v-if="p.name === event?.organizerName" class="organizer-badge">发起者</span>
                  </span>
                  <span class="participant-stats-brief">
                    ✓{{ getParticipantStats(p.id).available }} 
                    ✗{{ getParticipantStats(p.id).unavailable }}
                    💬{{ getParticipantStats(p.id).commentCount }}
                  </span>
                </div>
                <div class="participant-actions">
                  <button class="btn-icon" @click.stop="startEditParticipant(p)" title="编辑">✎</button>
                  <button class="btn-icon btn-danger" @click.stop="deleteParticipant(p.id)" title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </template>
              
              <!-- 参与者详情展开 -->
              <div v-if="selectedParticipantId === p.id && participantDetails" class="participant-details">
                <div class="detail-section">
                  <div class="detail-header">
                    <h4>可用性标记 ({{ participantDetails.availability?.length || 0 }})</h4>
                    <button class="btn-ghost btn-xs" @click.stop="openAvailabilityModal(p)">+ 添加</button>
                  </div>
                  <div v-if="participantDetails.availability?.length" class="detail-list">
                    <span 
                      v-for="a in participantDetails.availability" 
                      :key="a.date" 
                      :class="['avail-chip', a.status]"
                    >
                      {{ a.date.slice(5) }} {{ a.status === 'available' ? '✓' : '✗' }}
                      <button class="chip-delete" @click.stop="deleteParticipantAvailability(p.id, a.date)">×</button>
                    </span>
                  </div>
                  <p v-else class="no-data">暂无标记</p>
                </div>
                <div class="detail-section">
                  <h4>评论 ({{ participantDetails.comments?.length || 0 }})</h4>
                  <div v-if="participantDetails.comments?.length" class="detail-comments">
                    <div v-for="c in participantDetails.comments" :key="c.id" class="detail-comment">
                      <!-- 编辑模式 -->
                      <template v-if="editingAvailCommentId === c.id">
                        <textarea 
                          v-model="editingAvailCommentContent" 
                          rows="2"
                          class="comment-edit-textarea"
                        ></textarea>
                        <div class="comment-edit-btns">
                          <button class="btn-ghost btn-xs" @click.stop="cancelEditAvailComment">取消</button>
                          <button class="btn-primary btn-xs" @click.stop="saveEditAvailComment(c.id)">保存</button>
                        </div>
                      </template>
                      <!-- 显示模式 -->
                      <template v-else>
                        <span class="comment-content">{{ c.content }}</span>
                        <div class="comment-btns">
                          <button class="btn-icon btn-xs" @click.stop="startEditAvailComment(c)">✎</button>
                          <button class="btn-icon btn-xs btn-danger" @click.stop="deleteAvailComment(c.id)">×</button>
                        </div>
                      </template>
                    </div>
                  </div>
                  <p v-else class="no-data">暂无评论</p>
                </div>
              </div>
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
                <div class="comment-actions">
                  <button class="btn-icon btn-edit" @click="startEditComment(c)" title="编辑">✎</button>
                  <button class="btn-icon btn-danger" @click="deleteComment(c.id)" title="删除">×</button>
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
        </div>
      </aside>
    </main>
    
    <!-- 分享弹窗 -->
    <div v-if="showShareModal" class="modal-overlay" @click.self="showShareModal = false">
      <div class="modal-content card">
        <h2>分享活动</h2>
        <p>将以下链接和访问码发送给参与者：</p>
        
        <div class="share-info">
          <label>活动链接</label>
          <div class="share-link">
            <input :value="shareUrl" readonly />
            <button class="btn-primary" @click="copyShareLink">复制</button>
          </div>
        </div>
        
        <div class="share-info">
          <label>访问码</label>
          <div class="access-code-display">{{ event?.accessCode }}</div>
        </div>
        
        <button class="btn-secondary" @click="showShareModal = false">关闭</button>
      </div>
    </div>
    
    <!-- 添加可用性弹窗 -->
    <div v-if="showAvailabilityModal" class="modal-overlay" @click.self="closeAvailabilityModal">
      <div class="modal-content card">
        <h2>为 {{ availabilityModalParticipant?.name }} 添加可用性</h2>
        
        <div class="form-group">
          <label>选择日期</label>
          <div class="date-checkboxes">
            <label 
              v-for="date in getUnmarkedDates(availabilityModalParticipant?.id)" 
              :key="date" 
              class="date-checkbox"
            >
              <input type="checkbox" :value="date" v-model="availabilityModalDates" />
              {{ date.slice(5) }}
            </label>
            <p v-if="getUnmarkedDates(availabilityModalParticipant?.id).length === 0" class="no-data">
              所有日期都已标记
            </p>
          </div>
        </div>
        
        <div class="form-group">
          <label>状态</label>
          <div class="status-options">
            <label class="status-option">
              <input type="radio" value="available" v-model="availabilityModalStatus" />
              <span class="status-label available">✓ 可以参加</span>
            </label>
            <label class="status-option">
              <input type="radio" value="unavailable" v-model="availabilityModalStatus" />
              <span class="status-label unavailable">✗ 无法参加</span>
            </label>
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="btn-ghost" @click="closeAvailabilityModal">取消</button>
          <button class="btn-primary" @click="saveAvailabilityForParticipant">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.organizer-container {
  min-height: 100vh;
  background: var(--bg-secondary);
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

.role-badge {
  background: var(--primary);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-participant-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--success);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-participant-switch:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
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
  grid-template-columns: 1fr 400px;
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
  margin-bottom: 20px;
}

.calendar-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.calendar-nav {
  display: flex;
  gap: 8px;
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
  transition: all 0.2s;
  background: var(--bg-primary);
}

.day-cell.other-month {
  opacity: 0.3;
}

.day-cell.out-of-range {
  background: var(--bg-secondary);
  opacity: 0.5;
}

.day-cell.in-range {
  border: 1px solid var(--border-light);
}

.day-number {
  font-weight: 500;
}

.day-stats {
  display: flex;
  gap: 4px;
  font-size: 0.625rem;
  margin-top: 2px;
}

.stat-available {
  color: #22c55e;
}

.stat-unavailable {
  color: #ef4444;
}

.color-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
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

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  padding: 20px;
}

.panel-card h3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  margin-bottom: 12px;
}

.access-code {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.stats-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-box {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.stats-detail {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.stats-detail h4 {
  font-size: 0.875rem;
  margin-bottom: 8px;
}

.best-dates {
  list-style: none;
  padding: 0;
  font-size: 0.875rem;
}

.best-dates li {
  padding: 6px 0;
  border-bottom: 1px solid var(--border-light);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 0.75rem;
}

.tag-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.tag-form {
  display: flex;
  gap: 8px;
}

.tag-form input[type="text"] {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 0.875rem;
}

.tag-form input[type="color"] {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.participant-list {
  list-style: none;
  padding: 0;
}

.participant-list li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.participant-list li:hover {
  background: var(--bg-secondary);
  margin: 0 -8px;
  padding: 10px 8px;
  border-radius: 8px;
}

.participant-list li.is-editing,
.participant-list li.is-selected {
  background: var(--bg-secondary);
  margin: 0 -8px;
  padding: 10px 8px;
  border-radius: 8px;
}

.participant-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.participant-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.organizer-badge {
  font-size: 0.625rem;
  padding: 2px 6px;
  background: var(--primary);
  color: white;
  border-radius: 10px;
}

.participant-stats-brief {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.participant-actions {
  display: flex;
  gap: 4px;
}

.participant-edit-form {
  width: 100%;
}

.participant-edit-form input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--primary);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.participant-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

.participant-details {
  width: 100%;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.detail-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.avail-chip {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-tertiary);
}

.avail-chip.available {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.avail-chip.unavailable {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.detail-comments {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-comment {
  font-size: 0.8rem;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  color: var(--text-secondary);
}

.no-data {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chip-delete {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0 2px;
  font-size: 0.875rem;
  opacity: 0.6;
  margin-left: 2px;
}

.chip-delete:hover {
  opacity: 1;
}

.detail-comment {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.comment-content {
  flex: 1;
}

.comment-btns {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.comment-edit-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--primary);
  border-radius: 6px;
  font-size: 0.8rem;
  resize: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  margin-bottom: 6px;
}

.comment-edit-btns {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.btn-xs {
  padding: 2px 8px !important;
  font-size: 0.7rem !important;
}

/* 可用性模态框样式 */
.date-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.date-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
}

.date-checkbox:hover {
  background: var(--bg-primary);
}

.date-checkbox input {
  margin: 0;
}

.status-options {
  display: flex;
  gap: 16px;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.status-option input {
  margin: 0;
}

.status-label {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
}

.status-label.available {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-label.unavailable {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 8px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-muted);
}

.btn-icon:hover {
  background: var(--bg-secondary);
}

.btn-icon.btn-danger:hover {
  color: var(--danger);
}

.comment-list {
  list-style: none;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
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

.comment-item.editing {
  background: var(--bg-secondary);
  padding: 12px;
  margin: -12px 0;
  border-radius: 8px;
}

.comment-actions {
  display: flex;
  gap: 4px;
}

.btn-edit {
  font-size: 0.875rem;
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

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-width: 480px;
  padding: 32px;
}

.modal-content h2 {
  margin-bottom: 8px;
}

.modal-content > p {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.share-info {
  margin-bottom: 20px;
}

.share-info label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 8px;
}

.share-link {
  display: flex;
  gap: 8px;
}

.share-link input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--bg-secondary);
}

.access-code-display {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 1.25rem;
  font-weight: 600;
  font-family: monospace;
  letter-spacing: 2px;
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
