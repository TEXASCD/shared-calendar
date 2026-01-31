<script setup>
import { ref, inject } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  eventId: String,
  poll: Object
})

const send = inject('send')
const pollQuestion = ref('')
const newOption = ref('')

function startPoll() {
  send({
    type: 'start_poll',
    eventId: props.eventId,
    question: pollQuestion.value.trim() || t('poll.title')
  })
  pollQuestion.value = ''
}

function addOption() {
  if (!newOption.value.trim()) return
  send({
    type: 'add_poll_option',
    eventId: props.eventId,
    text: newOption.value.trim()
  })
  newOption.value = ''
}

function vote(optionId) {
  send({
    type: 'cast_vote',
    eventId: props.eventId,
    optionId
  })
}

function getTotalVotes() {
  if (!props.poll?.options) return 0
  return props.poll.options.reduce((sum, opt) => sum + opt.count, 0)
}

function getPercentage(count) {
  const total = getTotalVotes()
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}
</script>

<template>
  <div class="poll-section">
    <div class="section-header">
      <span class="section-title">{{ t('poll.title') }}</span>
    </div>

    <!-- No poll yet -->
    <div v-if="!poll" class="poll-create">
      <input
        v-model="pollQuestion"
        type="text"
        :placeholder="t('poll.question')"
        @keyup.enter="startPoll"
      />
      <button class="btn-ghost btn-sm" @click="startPoll">
        {{ t('poll.startPoll') }}
      </button>
    </div>

    <!-- Poll exists -->
    <div v-else class="poll-content">
      <div class="poll-question">{{ poll.question }}</div>

      <div class="poll-options">
        <div
          v-for="option in poll.options"
          :key="option.id"
          class="poll-option"
        >
          <div class="option-info">
            <span class="option-text">{{ option.text }}</span>
            <span class="option-count">{{ option.count }} {{ t('poll.votes') }}</span>
          </div>
          <div class="option-bar">
            <div
              class="option-fill"
              :style="{ width: getPercentage(option.count) + '%' }"
            ></div>
          </div>
          <button class="btn-ghost btn-sm" @click="vote(option.id)">
            {{ t('poll.vote') }}
          </button>
        </div>
      </div>

      <div class="add-option-form">
        <input
          v-model="newOption"
          type="text"
          :placeholder="t('poll.optionPlaceholder')"
          @keyup.enter="addOption"
        />
        <button class="btn-ghost btn-sm" @click="addOption">
          {{ t('poll.addOption') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.poll-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 10px;
}

.section-header {
  margin-bottom: 10px;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.poll-create {
  display: flex;
  gap: 8px;
}

.poll-create input {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.75rem;
}

.poll-question {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.poll-option {
  display: grid;
  gap: 6px;
}

.option-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.option-text {
  color: var(--text-primary);
}

.option-count {
  color: var(--text-muted);
}

.option-bar {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.option-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

.add-option-form {
  display: flex;
  gap: 8px;
}

.add-option-form input {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.75rem;
}
</style>
