import { ref, onUnmounted } from 'vue'

/**
 * WebSocket 连接管理
 * - 自动重连
 * - 错误处理
 * - 消息队列
 */

const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 10

export function useSocket() {
  const socket = ref(null)
  const connected = ref(false)
  const reconnectAttempts = ref(0)
  
  let messageCallback = null
  let reconnectTimeout = null
  let messageQueue = []

  function connect(onMessage) {
    if (socket.value?.readyState === WebSocket.OPEN) {
      console.log('[Socket] Already connected')
      return
    }
    
    messageCallback = onMessage
    createConnection()
  }

  function createConnection() {
    cleanup()
    
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const host = import.meta.env.DEV ? 'localhost:3000' : location.host
    const url = `${protocol}://${host}`
    
    console.log(`[Socket] Connecting to ${url}...`)
    
    try {
      socket.value = new WebSocket(url)
    } catch (err) {
      console.error('[Socket] Failed to create WebSocket:', err)
      scheduleReconnect()
      return
    }

    socket.value.addEventListener('open', handleOpen)
    socket.value.addEventListener('close', handleClose)
    socket.value.addEventListener('error', handleError)
    socket.value.addEventListener('message', handleMessage)
  }

  function handleOpen() {
    console.log('[Socket] Connected')
    connected.value = true
    reconnectAttempts.value = 0
    
    // 发送 join 消息
    const name = localStorage.getItem('calendar_user') || '匿名用户'
    send({ type: 'join', name })
    
    // 发送排队的消息
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()
      doSend(msg)
    }
  }

  function handleClose(event) {
    console.log(`[Socket] Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`)
    connected.value = false
    
    // 非正常关闭才重连
    if (event.code !== 1000) {
      scheduleReconnect()
    }
  }

  function handleError(event) {
    // WebSocket error 事件不包含有用信息，只记录发生了错误
    console.error('[Socket] Connection error occurred')
    connected.value = false
  }

  function handleMessage(event) {
    if (!messageCallback) return
    
    try {
      const message = JSON.parse(event.data)
      messageCallback(message)
    } catch (err) {
      console.error('[Socket] Failed to parse message:', err.message)
      console.debug('[Socket] Raw message:', event.data.substring(0, 200))
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout) return
    
    if (reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Socket] Max reconnection attempts reached')
      return
    }
    
    reconnectAttempts.value++
    const delay = RECONNECT_DELAY * Math.min(reconnectAttempts.value, 5)
    
    console.log(`[Socket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${MAX_RECONNECT_ATTEMPTS})`)
    
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null
      createConnection()
    }, delay)
  }

  function send(message) {
    if (socket.value?.readyState === WebSocket.OPEN) {
      doSend(message)
    } else {
      // 连接未就绪时排队
      console.log('[Socket] Queueing message:', message.type)
      messageQueue.push(message)
    }
  }

  function doSend(message) {
    try {
      socket.value.send(JSON.stringify(message))
    } catch (err) {
      console.error('[Socket] Failed to send message:', err)
    }
  }

  function disconnect() {
    cleanup()
    if (socket.value) {
      socket.value.close(1000, 'User disconnect')
      socket.value = null
    }
  }

  function cleanup() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    
    if (socket.value) {
      socket.value.removeEventListener('open', handleOpen)
      socket.value.removeEventListener('close', handleClose)
      socket.value.removeEventListener('error', handleError)
      socket.value.removeEventListener('message', handleMessage)
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    socket,
    connected,
    reconnectAttempts,
    connect,
    send,
    disconnect
  }
}
