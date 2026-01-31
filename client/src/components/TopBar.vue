<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import ThemeToggle from './ThemeToggle.vue'
import LangSwitch from './LangSwitch.vue'

const { t } = useI18n()

defineProps({
  userName: String,
  joined: Boolean,
  onlineCount: Number,
  connected: Boolean
})

const emit = defineEmits(['update:userName', 'join'])

const theme = inject('theme')
const toggleTheme = inject('toggleTheme')
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="logo">📅</div>
      <div class="brand-text">
        <h1>{{ t('app.title') }}</h1>
        <p>{{ t('app.subtitle') }}</p>
      </div>
    </div>

    <div class="controls">
      <div class="online-status" v-if="joined">
        <span class="online-dot" :class="{ disconnected: !connected }"></span>
        <span v-if="connected">{{ onlineCount }} {{ t('nav.people') }} {{ t('nav.online') }}</span>
        <span v-else class="reconnecting">重连中...</span>
      </div>

      <div class="user-input" v-if="!joined">
        <input
          type="text"
          :value="userName"
          @input="$emit('update:userName', $event.target.value)"
          :placeholder="t('auth.namePlaceholder')"
          @keyup.enter="$emit('join')"
        />
        <button class="btn-primary" @click="$emit('join')">
          {{ t('auth.join') }}
        </button>
      </div>
      
      <div class="user-badge" v-else>
        <span class="avatar">{{ userName.charAt(0).toUpperCase() }}</span>
        <span class="user-name">{{ userName }}</span>
      </div>

      <div class="toolbar">
        <ThemeToggle />
        <LangSwitch />
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-light);
  gap: 24px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 50;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  font-size: 2rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.brand-text h1 {
  font-size: 1.25rem;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-text p {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.online-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
}

.online-dot {
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.online-dot.disconnected {
  background: var(--warning);
  animation: none;
}

.reconnecting {
  color: var(--warning);
  font-style: italic;
}

.user-input {
  display: flex;
  gap: 10px;
}

.user-input input {
  width: 180px;
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
}

.avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-gradient);
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: 50%;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.toolbar {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .topbar {
    padding: 12px 16px;
  }
  
  .brand-text p {
    display: none;
  }
  
  .user-input input {
    width: 140px;
  }
}
</style>
