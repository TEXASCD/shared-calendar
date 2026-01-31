<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const eventId = route.params.id
const accessCode = ref('')
const participantName = ref('')
const eventInfo = ref(null)
const isLoading = ref(true)
const isJoining = ref(false)
const error = ref('')
const step = ref(1) // 1: 输入访问码, 2: 输入名字

// 检查是否已有发起者token
const hasOrganizerToken = sessionStorage.getItem(`organizer_token_${eventId}`)

onMounted(async () => {
  // 如果已经是发起者，直接跳转
  if (hasOrganizerToken) {
    router.replace(`/event/${eventId}/organizer`)
    return
  }
  
  // 检查是否已有参与者身份
  const savedName = sessionStorage.getItem(`participant_name_${eventId}`)
  if (savedName) {
    router.replace(`/event/${eventId}/participant`)
    return
  }
  
  // 获取活动基本信息（不需要访问码）
  try {
    const response = await fetch(`/api/events/${eventId}/info`)
    if (response.ok) {
      eventInfo.value = await response.json()
    } else {
      error.value = '活动不存在或已被删除'
    }
  } catch (err) {
    error.value = '加载活动信息失败'
  } finally {
    isLoading.value = false
  }
})

async function verifyAccessCode() {
  if (!accessCode.value.trim()) return
  
  error.value = ''
  isJoining.value = true
  
  try {
    const response = await fetch(`/api/events/${eventId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: accessCode.value.trim() })
    })
    
    if (response.ok) {
      step.value = 2
    } else {
      const data = await response.json()
      error.value = data.error || '访问码错误'
    }
  } catch (err) {
    error.value = '验证失败，请重试'
  } finally {
    isJoining.value = false
  }
}

async function joinEvent() {
  if (!participantName.value.trim()) return
  
  error.value = ''
  isJoining.value = true
  
  try {
    const response = await fetch(`/api/events/${eventId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        accessCode: accessCode.value.trim(),
        name: participantName.value.trim()
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      
      // 保存参与者信息
      sessionStorage.setItem(`participant_name_${eventId}`, participantName.value.trim())
      sessionStorage.setItem(`participant_id_${eventId}`, data.participantId)
      
      // 显示欢迎信息
      if (data.isReturning) {
        alert(`欢迎回来，${participantName.value}！您之前的数据已加载。`)
      }
      
      // 跳转到参与者页面
      router.push(`/event/${eventId}/participant`)
    } else {
      const data = await response.json()
      error.value = data.error || '加入失败'
    }
  } catch (err) {
    error.value = '加入失败，请重试'
  } finally {
    isJoining.value = false
  }
}

function goBack() {
  if (step.value === 2) {
    step.value = 1
  } else {
    router.push('/')
  }
}

function enterAsOrganizer() {
  router.push(`/event/${eventId}/organizer`)
}
</script>

<template>
  <div class="join-container">
    <div class="join-card card">
      <button class="btn-ghost back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        {{ step === 2 ? '返回' : '首页' }}
      </button>
      
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
      
      <div v-else-if="error && !eventInfo" class="error-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <p>{{ error }}</p>
        <button class="btn-primary" @click="router.push('/')">返回首页</button>
      </div>
      
      <template v-else-if="eventInfo">
        <div class="event-header">
          <h1 class="event-title">{{ eventInfo.title }}</h1>
          <p class="event-date">
            {{ eventInfo.startDate }} 至 {{ eventInfo.endDate }}
          </p>
          <p v-if="eventInfo.description" class="event-description">
            {{ eventInfo.description }}
          </p>
          <p class="organizer-info">
            发起者：{{ eventInfo.organizerName }}
          </p>
        </div>
        
        <!-- 步骤1：输入访问码 -->
        <form v-if="step === 1" @submit.prevent="verifyAccessCode" class="join-form">
          <div class="form-group">
            <label for="accessCode">访问码</label>
            <input 
              id="accessCode"
              v-model="accessCode"
              type="text"
              placeholder="请输入活动访问码"
              maxlength="20"
              autocomplete="off"
              required
            />
            <span class="hint">请向活动发起者获取访问码</span>
          </div>
          
          <div v-if="error" class="error-message">
            {{ error }}
          </div>
          
          <button 
            type="submit" 
            class="btn-primary btn-lg"
            :disabled="!accessCode.trim() || isJoining"
          >
            {{ isJoining ? '验证中...' : '下一步' }}
          </button>
        </form>
        
        <!-- 步骤2：输入名字 -->
        <form v-else-if="step === 2" @submit.prevent="joinEvent" class="join-form">
          <div class="form-group">
            <label for="participantName">您的名字</label>
            <input 
              id="participantName"
              v-model="participantName"
              type="text"
              placeholder="输入您的名字"
              maxlength="50"
              required
            />
            <span class="hint">
              如果您之前参与过此活动，请输入相同的名字以恢复数据
            </span>
          </div>
          
          <div v-if="error" class="error-message">
            {{ error }}
          </div>
          
          <button 
            type="submit" 
            class="btn-primary btn-lg"
            :disabled="!participantName.trim() || isJoining"
          >
            {{ isJoining ? '加入中...' : '加入活动' }}
          </button>
        </form>
        
        <!-- 发起者入口（如果有token） -->
        <div v-if="hasOrganizerToken" class="organizer-entry">
          <hr />
          <button class="btn-secondary" @click="enterAsOrganizer">
            以发起者身份进入
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.join-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: var(--bg-secondary);
}

.join-card {
  width: 100%;
  max-width: 480px;
  padding: 40px;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-light);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state svg {
  color: var(--danger);
  margin-bottom: 16px;
}

.error-state p {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.event-header {
  text-align: center;
  margin-bottom: 32px;
  margin-top: 24px;
}

.event-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.event-date {
  font-size: 0.875rem;
  color: var(--primary);
  font-weight: 500;
  margin-bottom: 12px;
}

.event-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 12px;
}

.organizer-info {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input {
  padding: 12px 16px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.error-message {
  padding: 12px 16px;
  background: var(--danger-light);
  color: var(--danger);
  border-radius: 8px;
  font-size: 0.875rem;
}

.btn-lg {
  width: 100%;
  justify-content: center;
}

.organizer-entry {
  margin-top: 24px;
  text-align: center;
}

.organizer-entry hr {
  border: none;
  border-top: 1px solid var(--border-light);
  margin-bottom: 24px;
}

.organizer-entry .btn-secondary {
  width: 100%;
}
</style>
