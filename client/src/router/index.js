import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/create',
    name: 'CreateEvent',
    component: () => import('../views/CreateEvent.vue')
  },
  {
    path: '/event/:id',
    name: 'JoinEvent',
    component: () => import('../views/JoinEvent.vue')
  },
  {
    path: '/event/:id/organizer',
    name: 'OrganizerView',
    component: () => import('../views/OrganizerView.vue'),
    meta: { requiresOrganizer: true }
  },
  {
    path: '/event/:id/participant',
    name: 'ParticipantView',
    component: () => import('../views/ParticipantView.vue'),
    meta: { requiresParticipant: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：检查是否有必要的身份信息
router.beforeEach((to, from, next) => {
  const eventId = to.params.id
  
  if (to.meta.requiresOrganizer) {
    const token = sessionStorage.getItem(`organizer_token_${eventId}`)
    if (!token) {
      next({ name: 'JoinEvent', params: { id: eventId } })
      return
    }
  }
  
  if (to.meta.requiresParticipant) {
    const participantName = sessionStorage.getItem(`participant_name_${eventId}`)
    if (!participantName) {
      next({ name: 'JoinEvent', params: { id: eventId } })
      return
    }
  }
  
  next()
})

export default router
