<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const title = ref('')
const description = ref('')
const startDate = ref('')
const endDate = ref('')
const organizerName = ref('')
const isSubmitting = ref(false)
const error = ref('')

// 生成今天的日期字符串
const today = new Date().toISOString().split('T')[0]

const isValid = computed(() => {
  return title.value.trim() && 
         startDate.value && 
         endDate.value && 
         organizerName.value.trim() &&
         new Date(startDate.value) <= new Date(endDate.value)
})

async function createEvent() {
  if (!isValid.value || isSubmitting.value) return
  
  isSubmitting.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.value.trim(),
        description: description.value.trim(),
        startDate: startDate.value,
        endDate: endDate.value,
        organizerName: organizerName.value.trim()
      })
    })
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || '创建失败')
    }
    
    const data = await response.json()
    
    // 保存发起者token到sessionStorage
    sessionStorage.setItem(`organizer_token_${data.id}`, data.organizerToken)
    sessionStorage.setItem(`organizer_name_${data.id}`, organizerName.value.trim())
    
    // 跳转到发起者管理页面
    router.push(`/event/${data.id}/organizer`)
  } catch (err) {
    error.value = err.message
  } finally {
    isSubmitting.value = false
  }
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="create-container">
    <div class="create-card card">
      <button class="btn-ghost back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        返回
      </button>
      
      <h1 class="page-title">创建新活动</h1>
      <p class="page-description">设定活动信息和日期范围，创建后可分享给参与者</p>
      
      <form @submit.prevent="createEvent" class="create-form">
        <div class="form-group">
          <label for="organizerName">您的名字 <span class="required">*</span></label>
          <input 
            id="organizerName"
            v-model="organizerName"
            type="text"
            placeholder="输入您的名字（作为活动发起者）"
            maxlength="50"
            required
          />
          <span class="hint">此名字将用于标识您是活动发起者</span>
        </div>
        
        <div class="form-group">
          <label for="title">活动标题 <span class="required">*</span></label>
          <input 
            id="title"
            v-model="title"
            type="text"
            placeholder="例如：团队聚餐时间协调"
            maxlength="200"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="description">活动描述</label>
          <textarea 
            id="description"
            v-model="description"
            placeholder="可选：添加活动说明或备注"
            rows="3"
            maxlength="500"
          ></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="startDate">开始日期 <span class="required">*</span></label>
            <input 
              id="startDate"
              v-model="startDate"
              type="date"
              :min="today"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="endDate">结束日期 <span class="required">*</span></label>
            <input 
              id="endDate"
              v-model="endDate"
              type="date"
              :min="startDate || today"
              required
            />
          </div>
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <div class="form-actions">
          <button 
            type="submit" 
            class="btn-primary btn-lg"
            :disabled="!isValid || isSubmitting"
          >
            <span v-if="isSubmitting">创建中...</span>
            <span v-else>创建活动</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.create-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: var(--bg-secondary);
}

.create-card {
  width: 100%;
  max-width: 560px;
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

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 8px;
  margin-top: 24px;
}

.page-description {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.create-form {
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

.required {
  color: var(--danger);
}

.form-group input,
.form-group textarea {
  padding: 12px 16px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.error-message {
  padding: 12px 16px;
  background: var(--danger-light);
  color: var(--danger);
  border-radius: 8px;
  font-size: 0.875rem;
}

.form-actions {
  margin-top: 8px;
}

.form-actions .btn-lg {
  width: 100%;
  justify-content: center;
}

@media (max-width: 480px) {
  .create-card {
    padding: 24px;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
