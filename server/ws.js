import { WebSocketServer } from 'ws'
import * as db from './db.js'

// ============================================
// Constants
// ============================================
const RATE_LIMIT = {
  WINDOW_MS: 1000,
  MAX_REQUESTS: 20
}

// ============================================
// Rate Limiter
// ============================================
class RateLimiter {
  constructor() {
    this.requests = new Map()
  }

  isAllowed(clientId) {
    const now = Date.now()
    const windowStart = now - RATE_LIMIT.WINDOW_MS
    
    let timestamps = this.requests.get(clientId) || []
    timestamps = timestamps.filter(t => t > windowStart)
    
    if (timestamps.length >= RATE_LIMIT.MAX_REQUESTS) {
      return false
    }
    
    timestamps.push(now)
    this.requests.set(clientId, timestamps)
    return true
  }

  cleanup() {
    const now = Date.now()
    const windowStart = now - RATE_LIMIT.WINDOW_MS
    
    for (const [clientId, timestamps] of this.requests) {
      const filtered = timestamps.filter(t => t > windowStart)
      if (filtered.length === 0) {
        this.requests.delete(clientId)
      } else {
        this.requests.set(clientId, filtered)
      }
    }
  }
}

// ============================================
// Event Room Management
// ============================================
class EventRooms {
  constructor() {
    this.rooms = new Map() // eventId -> Set<ws>
  }

  join(eventId, ws) {
    if (!this.rooms.has(eventId)) {
      this.rooms.set(eventId, new Set())
    }
    this.rooms.get(eventId).add(ws)
  }

  leave(eventId, ws) {
    const room = this.rooms.get(eventId)
    if (room) {
      room.delete(ws)
      if (room.size === 0) {
        this.rooms.delete(eventId)
      }
    }
  }

  leaveAll(ws) {
    for (const [eventId, room] of this.rooms) {
      room.delete(ws)
      if (room.size === 0) {
        this.rooms.delete(eventId)
      }
    }
  }

  broadcast(eventId, message, exclude = null) {
    const room = this.rooms.get(eventId)
    if (!room) return
    
    const data = JSON.stringify(message)
    room.forEach(client => {
      if (client.readyState === 1 && client !== exclude) {
        client.send(data)
      }
    })
  }

  getCount(eventId) {
    const room = this.rooms.get(eventId)
    return room ? room.size : 0
  }
}

// ============================================
// WebSocket Setup
// ============================================
export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server })
  const rateLimiter = new RateLimiter()
  const eventRooms = new EventRooms()
  
  setInterval(() => rateLimiter.cleanup(), 60000)

  function sendError(ws, error, details = null) {
    const errorMsg = { type: 'error', message: error }
    if (details) errorMsg.details = details
    ws.send(JSON.stringify(errorMsg))
    console.warn(`[WS] Error: ${error}`, details || '')
  }

  function sendSuccess(ws, type, data = {}) {
    ws.send(JSON.stringify({ type, success: true, ...data }))
  }

  // ============================================
  // Connection Handler
  // ============================================
  wss.on('connection', (ws, req) => {
    const clientId = req.socket.remoteAddress + ':' + Date.now()
    ws.clientId = clientId
    ws.eventId = null
    ws.participantId = null
    ws.participantName = null
    ws.isOrganizer = false

    ws.on('message', (raw) => {
      if (!rateLimiter.isAllowed(clientId)) {
        return sendError(ws, '请求过于频繁，请稍后再试')
      }

      let message
      try {
        const text = raw.toString()
        if (text.length > 65536) {
          return sendError(ws, '消息太大')
        }
        message = JSON.parse(text)
      } catch (err) {
        return sendError(ws, '无效的 JSON 格式')
      }

      handleMessage(ws, message)
    })

    ws.on('close', () => {
      if (ws.eventId) {
        eventRooms.leave(ws.eventId, ws)
        // 广播在线人数更新
        eventRooms.broadcast(ws.eventId, {
          type: 'presence',
          count: eventRooms.getCount(ws.eventId)
        })
      }
    })

    ws.on('error', (err) => {
      console.error(`[WS] Socket error:`, err.message)
    })
  })

  // ============================================
  // Message Router
  // ============================================
  const handlers = {
    // 活动管理
    create_event: handleCreateEvent,
    get_event: handleGetEvent,
    join_event: handleJoinEvent,
    join_as_organizer: handleJoinAsOrganizer,
    
    // 可用性
    update_availability: handleUpdateAvailability,
    
    // 评论
    add_comment: handleAddComment,
    delete_comment: handleDeleteComment,
    
    // 标签
    add_tag: handleAddTag,
    delete_tag: handleDeleteTag,
    
    // 参与者管理（仅发起者）
    remove_participant: handleRemoveParticipant
  }

  function handleMessage(ws, message) {
    const { type } = message

    const handler = handlers[type]
    if (!handler) {
      return sendError(ws, `未知的消息类型: ${type}`)
    }

    try {
      handler(ws, message)
    } catch (err) {
      if (err instanceof db.ValidationError) {
        sendError(ws, err.message)
      } else if (err instanceof db.DatabaseError) {
        console.error(`[WS] Database error in ${type}:`, err.message)
        sendError(ws, '数据库操作失败，请重试')
      } else {
        console.error(`[WS] Unexpected error in ${type}:`, err)
        sendError(ws, '发生了意外错误')
      }
    }
  }

  // ============================================
  // Handler Implementations
  // ============================================
  
  // 创建调度活动
  function handleCreateEvent(ws, message) {
    const { title, description, startDate, endDate, organizerName } = message
    
    const result = db.createSchedulingEvent({
      title,
      description,
      startDate,
      endDate,
      organizerName
    })
    
    sendSuccess(ws, 'event_created', {
      eventId: result.id,
      accessCode: result.accessCode,
      organizerToken: result.organizerToken
    })
  }

  // 获取活动信息
  function handleGetEvent(ws, message) {
    const { eventId, organizerToken } = message
    
    const eventData = db.getEventFull(eventId, organizerToken)
    if (!eventData) {
      return sendError(ws, '活动不存在')
    }
    
    // 加入房间
    if (ws.eventId) {
      eventRooms.leave(ws.eventId, ws)
    }
    ws.eventId = eventId
    ws.isOrganizer = eventData.isOrganizer
    eventRooms.join(eventId, ws)
    
    sendSuccess(ws, 'event_data', {
      ...eventData,
      onlineCount: eventRooms.getCount(eventId)
    })
    
    // 广播在线人数更新
    eventRooms.broadcast(eventId, {
      type: 'presence',
      count: eventRooms.getCount(eventId)
    }, ws)
  }

  // 参与者加入活动
  function handleJoinEvent(ws, message) {
    const { eventId, accessCode, name } = message
    
    const result = db.joinEvent(eventId, accessCode, name)
    
    // 更新 ws 状态
    if (ws.eventId) {
      eventRooms.leave(ws.eventId, ws)
    }
    ws.eventId = eventId
    ws.participantId = result.participantId
    ws.participantName = name
    ws.isOrganizer = false
    eventRooms.join(eventId, ws)
    
    // 获取完整活动数据
    const eventData = db.getEventFull(eventId)
    
    sendSuccess(ws, 'joined', {
      participantId: result.participantId,
      isReturning: result.isReturning,
      ...eventData,
      onlineCount: eventRooms.getCount(eventId)
    })
    
    // 广播新参与者加入
    if (!result.isReturning) {
      eventRooms.broadcast(eventId, {
        type: 'participant_joined',
        participant: { id: result.participantId, name }
      }, ws)
    }
    
    // 广播在线人数
    eventRooms.broadcast(eventId, {
      type: 'presence',
      count: eventRooms.getCount(eventId)
    })
  }

  // 发起者加入
  function handleJoinAsOrganizer(ws, message) {
    const { eventId, organizerToken } = message
    
    if (!db.verifyOrganizerToken(eventId, organizerToken)) {
      return sendError(ws, '发起者令牌无效')
    }
    
    // 更新 ws 状态
    if (ws.eventId) {
      eventRooms.leave(ws.eventId, ws)
    }
    ws.eventId = eventId
    ws.isOrganizer = true
    eventRooms.join(eventId, ws)
    
    const eventData = db.getEventFull(eventId, organizerToken)
    
    sendSuccess(ws, 'organizer_joined', {
      ...eventData,
      onlineCount: eventRooms.getCount(eventId)
    })
    
    eventRooms.broadcast(eventId, {
      type: 'presence',
      count: eventRooms.getCount(eventId)
    })
  }

  // 更新可用性
  function handleUpdateAvailability(ws, message) {
    const { dates, status } = message
    
    if (!ws.eventId || !ws.participantId) {
      return sendError(ws, '请先加入活动')
    }
    
    const results = db.updateAvailability(ws.eventId, ws.participantId, dates, status)
    
    // 广播给所有人
    eventRooms.broadcast(ws.eventId, {
      type: 'availability_updated',
      participantId: ws.participantId,
      participantName: ws.participantName,
      updates: results
    })
  }

  // 添加评论
  function handleAddComment(ws, message) {
    const { content } = message
    
    if (!ws.eventId || !ws.participantId) {
      return sendError(ws, '请先加入活动')
    }
    
    const comment = db.addComment(ws.eventId, ws.participantId, content)
    
    eventRooms.broadcast(ws.eventId, {
      type: 'comment_added',
      comment
    })
  }

  // 删除评论
  function handleDeleteComment(ws, message) {
    const { commentId } = message
    
    if (!ws.eventId) {
      return sendError(ws, '请先加入活动')
    }
    
    if (ws.isOrganizer) {
      db.deleteComment(commentId)
    } else if (ws.participantId) {
      db.deleteComment(commentId, ws.participantId)
    } else {
      return sendError(ws, '无权限删除评论')
    }
    
    eventRooms.broadcast(ws.eventId, {
      type: 'comment_deleted',
      commentId
    })
  }

  // 添加标签（仅发起者）
  function handleAddTag(ws, message) {
    const { name, color, date } = message
    
    if (!ws.eventId || !ws.isOrganizer) {
      return sendError(ws, '只有发起者可以添加标签')
    }
    
    const tag = db.addTag(ws.eventId, name, color, date)
    
    eventRooms.broadcast(ws.eventId, {
      type: 'tag_added',
      tag
    })
  }

  // 删除标签（仅发起者）
  function handleDeleteTag(ws, message) {
    const { tagId } = message
    
    if (!ws.eventId || !ws.isOrganizer) {
      return sendError(ws, '只有发起者可以删除标签')
    }
    
    db.deleteTag(ws.eventId, tagId)
    
    eventRooms.broadcast(ws.eventId, {
      type: 'tag_deleted',
      tagId
    })
  }

  // 移除参与者（仅发起者）
  function handleRemoveParticipant(ws, message) {
    const { participantId } = message
    
    if (!ws.eventId || !ws.isOrganizer) {
      return sendError(ws, '只有发起者可以移除参与者')
    }
    
    db.deleteParticipant(ws.eventId, participantId)
    
    eventRooms.broadcast(ws.eventId, {
      type: 'participant_removed',
      participantId
    })
  }

  return wss
}
