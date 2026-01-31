import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import http from 'http'
import * as db from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000

async function startServer() {
  // Initialize database first
  await db.initDatabase()
  console.log('✓ SQLite 数据库已初始化')

  const app = express()
  const server = http.createServer(app)

  // Middleware
  app.use(express.json())
  
  // 请求日志
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`)
    }
    next()
  })

  // Serve static files
  const isProduction = process.env.NODE_ENV === 'production'
  
  // 生产环境：从 dist 目录服务构建后的文件
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  
  // 公共文件（如测试工具）
  const publicPath = path.join(__dirname, '../public')
  app.use(express.static(publicPath))

  // 开发环境：允许访问客户端源文件
  if (!isProduction) {
    const clientPath = path.join(__dirname, '../client')
    app.use('/src', express.static(path.join(clientPath, 'src')))
  }

  // ============================================
  // API Routes
  // ============================================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
  })

  // 创建活动
  app.post('/api/events', (req, res) => {
    try {
      const { title, description, startDate, endDate, organizerName } = req.body
      const result = db.createSchedulingEvent({ title, description, startDate, endDate, organizerName })
      res.json(result)
    } catch (err) {
      console.error('创建活动失败:', err.message)
      res.status(400).json({ error: err.message })
    }
  })

  // 获取活动基本信息（无需访问码）
  app.get('/api/events/:id/info', (req, res) => {
    try {
      const event = db.getEventInfo(req.params.id)
      if (!event) {
        return res.status(404).json({ error: '活动不存在' })
      }
      res.json(event)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 验证访问码
  app.post('/api/events/:id/verify', (req, res) => {
    try {
      const { accessCode } = req.body
      const valid = db.verifyAccessCode(req.params.id, accessCode)
      if (valid) {
        res.json({ success: true })
      } else {
        res.status(401).json({ error: '访问码错误' })
      }
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 加入活动
  app.post('/api/events/:id/join', (req, res) => {
    try {
      const { accessCode, name } = req.body
      const result = db.joinEvent(req.params.id, accessCode, name)
      res.json(result)
    } catch (err) {
      if (err instanceof db.ValidationError) {
        res.status(400).json({ error: err.message })
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // 获取活动完整数据（发起者）
  app.get('/api/events/:id', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      const data = db.getEventFull(req.params.id, organizerToken)
      
      if (!data) {
        return res.status(404).json({ error: '活动不存在' })
      }
      
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 获取活动数据（参与者）
  app.get('/api/events/:id/participant', (req, res) => {
    try {
      const rawName = req.headers['x-participant-name']
      if (!rawName) {
        return res.status(401).json({ error: '需要参与者身份' })
      }
      const participantName = decodeURIComponent(rawName)
      
      const data = db.getEventFull(req.params.id)
      if (!data) {
        return res.status(404).json({ error: '活动不存在' })
      }
      
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 更新可用性
  app.post('/api/events/:id/availability', (req, res) => {
    try {
      const rawName = req.headers['x-participant-name']
      if (!rawName) {
        return res.status(401).json({ error: '需要参与者身份' })
      }
      // 解码中文名字
      const participantName = decodeURIComponent(rawName)
      
      const participant = db.getParticipantByName(req.params.id, participantName)
      if (!participant) {
        return res.status(404).json({ error: '参与者不存在' })
      }
      
      const { dates, status } = req.body
      const result = db.updateAvailability(req.params.id, participant.id, dates, status)
      res.json(result)
    } catch (err) {
      if (err instanceof db.ValidationError) {
        res.status(400).json({ error: err.message })
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // 添加评论
  app.post('/api/events/:id/comments', (req, res) => {
    try {
      const rawName = req.headers['x-participant-name']
      if (!rawName) {
        return res.status(401).json({ error: '需要参与者身份' })
      }
      const participantName = decodeURIComponent(rawName)
      
      const participant = db.getParticipantByName(req.params.id, participantName)
      if (!participant) {
        return res.status(404).json({ error: '参与者不存在' })
      }
      
      const { content } = req.body
      const comment = db.addComment(req.params.id, participant.id, content)
      res.json(comment)
    } catch (err) {
      if (err instanceof db.ValidationError) {
        res.status(400).json({ error: err.message })
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // 删除评论（发起者可删任何评论，参与者只能删自己的）
  app.delete('/api/events/:id/comments/:commentId', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      const rawName = req.headers['x-participant-name']
      
      if (organizerToken && db.verifyOrganizerToken(req.params.id, organizerToken)) {
        // 发起者可以删除任何评论
        db.deleteComment(req.params.commentId)
      } else if (rawName) {
        // 参与者只能删除自己的评论
        const participantName = decodeURIComponent(rawName)
        const participant = db.getParticipantByName(req.params.id, participantName)
        if (participant) {
          db.deleteComment(req.params.commentId, participant.id)
        }
      } else {
        return res.status(401).json({ error: '未授权' })
      }
      
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 编辑评论（发起者可编辑任何评论，参与者只能编辑自己的）
  app.put('/api/events/:id/comments/:commentId', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      const rawName = req.headers['x-participant-name']
      const { content } = req.body
      
      if (!content || !content.trim()) {
        return res.status(400).json({ error: '评论内容不能为空' })
      }
      
      let comment = null
      
      if (organizerToken && db.verifyOrganizerToken(req.params.id, organizerToken)) {
        // 发起者可以编辑任何评论
        comment = db.updateComment(req.params.commentId, content)
      } else if (rawName) {
        // 参与者只能编辑自己的评论
        const participantName = decodeURIComponent(rawName)
        const participant = db.getParticipantByName(req.params.id, participantName)
        if (participant) {
          comment = db.updateComment(req.params.commentId, content, participant.id)
        } else {
          return res.status(404).json({ error: '参与者不存在' })
        }
      } else {
        return res.status(401).json({ error: '未授权' })
      }
      
      if (comment) {
        res.json(comment)
      } else {
        res.status(404).json({ error: '评论不存在或无权编辑' })
      }
    } catch (err) {
      if (err instanceof db.ValidationError) {
        res.status(400).json({ error: err.message })
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // 添加标签（仅发起者）
  app.post('/api/events/:id/tags', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      if (!organizerToken || !db.verifyOrganizerToken(req.params.id, organizerToken)) {
        return res.status(401).json({ error: '需要发起者权限' })
      }
      
      const { name, color, date } = req.body
      const tag = db.addTag(req.params.id, name, color, date)
      res.json(tag)
    } catch (err) {
      if (err instanceof db.ValidationError) {
        res.status(400).json({ error: err.message })
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // 删除标签（仅发起者）
  app.delete('/api/events/:id/tags/:tagId', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      if (!organizerToken || !db.verifyOrganizerToken(req.params.id, organizerToken)) {
        return res.status(401).json({ error: '需要发起者权限' })
      }
      
      db.deleteTag(req.params.id, req.params.tagId)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 获取参与者详情（仅发起者）
  app.get('/api/events/:id/participants/:participantId', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      if (!organizerToken || !db.verifyOrganizerToken(req.params.id, organizerToken)) {
        return res.status(401).json({ error: '需要发起者权限' })
      }
      
      const details = db.getParticipantDetails(req.params.id, parseInt(req.params.participantId))
      if (!details) {
        return res.status(404).json({ error: '参与者不存在' })
      }
      res.json(details)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 修改参与者（仅发起者）
  app.put('/api/events/:id/participants/:participantId', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      if (!organizerToken || !db.verifyOrganizerToken(req.params.id, organizerToken)) {
        return res.status(401).json({ error: '需要发起者权限' })
      }
      
      const { name } = req.body
      if (!name || !name.trim()) {
        return res.status(400).json({ error: '名字不能为空' })
      }
      
      const participant = db.updateParticipant(req.params.id, parseInt(req.params.participantId), name)
      res.json(participant)
    } catch (err) {
      if (err instanceof db.ValidationError) {
        res.status(400).json({ error: err.message })
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // 修改参与者可用性（仅发起者）
  app.put('/api/events/:id/participants/:participantId/availability', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      if (!organizerToken || !db.verifyOrganizerToken(req.params.id, organizerToken)) {
        return res.status(401).json({ error: '需要发起者权限' })
      }
      
      const { dates, status } = req.body
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: '日期列表不能为空' })
      }
      if (!['available', 'unavailable'].includes(status)) {
        return res.status(400).json({ error: '状态必须是 available 或 unavailable' })
      }
      
      const result = db.updateAvailability(req.params.id, parseInt(req.params.participantId), dates, status)
      res.json(result)
    } catch (err) {
      if (err instanceof db.ValidationError) {
        res.status(400).json({ error: err.message })
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // 删除参与者可用性（仅发起者）
  app.delete('/api/events/:id/participants/:participantId/availability', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      if (!organizerToken || !db.verifyOrganizerToken(req.params.id, organizerToken)) {
        return res.status(401).json({ error: '需要发起者权限' })
      }
      
      const { dates } = req.body
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: '日期列表不能为空' })
      }
      
      db.deleteAvailability(req.params.id, parseInt(req.params.participantId), dates)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // 删除参与者（仅发起者）
  app.delete('/api/events/:id/participants/:participantId', (req, res) => {
    try {
      const organizerToken = req.headers['x-organizer-token']
      if (!organizerToken || !db.verifyOrganizerToken(req.params.id, organizerToken)) {
        return res.status(401).json({ error: '需要发起者权限' })
      }
      
      db.deleteParticipant(req.params.id, parseInt(req.params.participantId))
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // SPA fallback - must be last
  app.get('*', (req, res) => {
    // 优先使用 dist 目录的 index.html（生产构建）
    const distIndex = path.join(distPath, 'index.html')
    const publicIndex = path.join(publicPath, 'index.html')
    
    // 检查 dist/index.html 是否存在
    const fs = require('fs')
    if (fs.existsSync(distIndex)) {
      res.sendFile(distIndex)
    } else {
      res.sendFile(publicIndex)
    }
  })

  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   共享日历调度系统已启动                            ║
║                                                    ║
║   本地访问: http://localhost:${PORT}                 ║
║                                                    ║
║   功能特性:                                        ║
║   • 活动创建与分享                                 ║
║   • 参与者可用性标记                               ║
║   • 渐变色可视化统计                               ║
║   • 评论与标签功能                                 ║
║                                                    ║
╚════════════════════════════════════════════════════╝
    `)
  })
}

startServer().catch(err => {
  console.error('启动失败:', err)
  process.exit(1)
})
