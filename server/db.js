import initSqlJs from 'sql.js'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// ============================================
// Constants
// ============================================
const LIMITS = {
  USER_NAME: 50,
  EVENT_TITLE: 200,
  DESCRIPTION: 500,
  COMMENT: 500,
  TAG_NAME: 50
}

const WEIGHTS = {
  AVAILABLE: 1,
  UNAVAILABLE: -2
}

const SAVE_DEBOUNCE_MS = 1000

// ============================================
// Database State
// ============================================
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'calendar.db')

let db = null
let initialized = false
let saveTimeout = null
let pendingSave = false

// ============================================
// Custom Error Types
// ============================================
class DatabaseError extends Error {
  constructor(message, cause = null) {
    super(message)
    this.name = 'DatabaseError'
    this.cause = cause
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}

// ============================================
// Database Initialization
// ============================================
export async function initDatabase() {
  if (initialized) return db
  
  const SQL = await initSqlJs()
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // 创建新的表结构
  runTransaction(() => {
    // 调度活动表
    db.run(`
      CREATE TABLE IF NOT EXISTS scheduling_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        access_code TEXT NOT NULL,
        organizer_token TEXT NOT NULL,
        organizer_name TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    // 参与者表
    db.run(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(event_id, name),
        FOREIGN KEY (event_id) REFERENCES scheduling_events(id)
      )
    `)

    // 可用性表
    db.run(`
      CREATE TABLE IF NOT EXISTS availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        participant_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT CHECK(status IN ('available', 'unavailable')),
        UNIQUE(event_id, participant_id, date),
        FOREIGN KEY (event_id) REFERENCES scheduling_events(id),
        FOREIGN KEY (participant_id) REFERENCES participants(id)
      )
    `)

    // 评论表
    db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        participant_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (event_id) REFERENCES scheduling_events(id),
        FOREIGN KEY (participant_id) REFERENCES participants(id)
      )
    `)

    // 标签表
    db.run(`
      CREATE TABLE IF NOT EXISTS event_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        date TEXT,
        FOREIGN KEY (event_id) REFERENCES scheduling_events(id)
      )
    `)

    // 日期备注表
    db.run(`
      CREATE TABLE IF NOT EXISTS date_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        participant_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(event_id, participant_id, date),
        FOREIGN KEY (event_id) REFERENCES scheduling_events(id),
        FOREIGN KEY (participant_id) REFERENCES participants(id)
      )
    `)

    // 创建索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id)`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_availability_event ON availability(event_id)`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_comments_event ON comments(event_id)`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_tags_event ON event_tags(event_id)`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_date_notes_event ON date_notes(event_id)`)
  }, true)

  // 为已有的 event_tags 表添加 participant_id 列（兼容旧数据）
  try {
    db.run(`ALTER TABLE event_tags ADD COLUMN participant_id INTEGER`)
  } catch (e) {
    // 列已存在则忽略
  }

  initialized = true
  scheduleSave()
  
  // 优雅关闭时保存
  process.on('SIGINT', () => {
    forceSave()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    forceSave()
    process.exit(0)
  })

  return db
}

// ============================================
// Database Save (Debounced)
// ============================================
function scheduleSave() {
  pendingSave = true
  if (saveTimeout) return
  
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    if (pendingSave) {
      forceSave()
    }
  }, SAVE_DEBOUNCE_MS)
}

function forceSave() {
  if (!db) return
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
    pendingSave = false
  } catch (err) {
    console.error('[DB] Save failed:', err.message)
  }
}

// ============================================
// Query Helpers
// ============================================
function runTransaction(fn, skipCheck = false) {
  if (!skipCheck) assertInitialized()
  try {
    db.run('BEGIN TRANSACTION')
    fn()
    db.run('COMMIT')
    scheduleSave()
  } catch (err) {
    try { db.run('ROLLBACK') } catch {}
    throw new DatabaseError('Transaction failed', err)
  }
}

function runQuery(sql, params = []) {
  assertInitialized()
  try {
    db.run(sql, params)
    scheduleSave()
    return true
  } catch (err) {
    console.error('[DB] Query error:', err.message, { sql, params })
    throw new DatabaseError(`Query failed: ${err.message}`, err)
  }
}

function getAll(sql, params = []) {
  assertInitialized()
  try {
    const stmt = db.prepare(sql)
    if (params.length) stmt.bind(params)
    const results = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  } catch (err) {
    console.error('[DB] Query error:', err.message, { sql })
    throw new DatabaseError(`Query failed: ${err.message}`, err)
  }
}

function getOne(sql, params = []) {
  const results = getAll(sql, params)
  return results.length > 0 ? results[0] : null
}

function assertInitialized() {
  if (!initialized || !db) {
    throw new DatabaseError('Database not initialized. Call initDatabase() first.')
  }
}

function sanitizeString(str, maxLength) {
  if (typeof str !== 'string') return ''
  return str.trim().slice(0, maxLength)
}

function generateAccessCode() {
  // 生成6位数字访问码
  return Math.random().toString().slice(2, 8)
}

// ============================================
// Scheduling Event Operations
// ============================================
export function createSchedulingEvent({ title, description, startDate, endDate, organizerName }) {
  if (!title) throw new ValidationError('标题不能为空')
  if (!startDate || !endDate) throw new ValidationError('日期范围不能为空')
  if (!organizerName) throw new ValidationError('发起者名字不能为空')
  if (new Date(startDate) > new Date(endDate)) {
    throw new ValidationError('开始日期不能晚于结束日期')
  }
  
  const id = randomUUID()
  const accessCode = generateAccessCode()
  const organizerToken = randomUUID()
  const sanitizedOrganizerName = sanitizeString(organizerName, LIMITS.USER_NAME)
  
  runQuery(
    `INSERT INTO scheduling_events (id, title, description, start_date, end_date, access_code, organizer_token, organizer_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sanitizeString(title, LIMITS.EVENT_TITLE),
      sanitizeString(description || '', LIMITS.DESCRIPTION),
      startDate,
      endDate,
      accessCode,
      organizerToken,
      sanitizedOrganizerName
    ]
  )
  
  // 自动将发起者添加为第一个参与者，这样发起者也可以评论和标记可用性
  runQuery(
    `INSERT INTO participants (event_id, name) VALUES (?, ?)`,
    [id, sanitizedOrganizerName]
  )
  
  return {
    id,
    accessCode,
    organizerToken
  }
}

export function getEventInfo(eventId) {
  const event = getOne(
    `SELECT id, title, description, start_date as startDate, end_date as endDate, organizer_name as organizerName
     FROM scheduling_events WHERE id = ?`,
    [eventId]
  )
  return event
}

export function getEventFull(eventId, organizerToken = null) {
  const event = getOne(
    `SELECT * FROM scheduling_events WHERE id = ?`,
    [eventId]
  )
  
  if (!event) return null
  
  // 验证发起者token
  const isOrganizer = organizerToken && event.organizer_token === organizerToken
  
  const result = {
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      organizerName: event.organizer_name,
      accessCode: isOrganizer ? event.access_code : undefined
    },
    participants: getParticipants(eventId),
    availability: getAvailability(eventId),
    comments: getComments(eventId),
    tags: getTags(eventId),
    dateNotes: getDateNotes(eventId),
    isOrganizer
  }
  
  return result
}

export function verifyAccessCode(eventId, accessCode) {
  const event = getOne(
    `SELECT access_code FROM scheduling_events WHERE id = ?`,
    [eventId]
  )
  return event && event.access_code === accessCode
}

export function verifyOrganizerToken(eventId, token) {
  const event = getOne(
    `SELECT organizer_token FROM scheduling_events WHERE id = ?`,
    [eventId]
  )
  return event && event.organizer_token === token
}

// ============================================
// Participant Operations
// ============================================
export function joinEvent(eventId, accessCode, name) {
  // 验证访问码
  if (!verifyAccessCode(eventId, accessCode)) {
    throw new ValidationError('访问码错误')
  }
  
  const sanitizedName = sanitizeString(name, LIMITS.USER_NAME)
  if (!sanitizedName) {
    throw new ValidationError('名字不能为空')
  }
  
  // 检查是否已存在
  const existing = getOne(
    `SELECT id FROM participants WHERE event_id = ? AND name = ?`,
    [eventId, sanitizedName]
  )
  
  if (existing) {
    return { participantId: existing.id, isReturning: true }
  }
  
  // 创建新参与者
  runQuery(
    `INSERT INTO participants (event_id, name) VALUES (?, ?)`,
    [eventId, sanitizedName]
  )
  
  const newParticipant = getOne(
    `SELECT id FROM participants WHERE event_id = ? AND name = ?`,
    [eventId, sanitizedName]
  )
  
  return { participantId: newParticipant.id, isReturning: false }
}

export function getParticipants(eventId) {
  return getAll(
    `SELECT id, name, created_at as createdAt FROM participants WHERE event_id = ? ORDER BY created_at`,
    [eventId]
  )
}

export function getParticipantByName(eventId, name) {
  return getOne(
    `SELECT id, name FROM participants WHERE event_id = ? AND name = ?`,
    [eventId, name]
  )
}

export function deleteParticipant(eventId, participantId) {
  runTransaction(() => {
    runQuery(`DELETE FROM availability WHERE event_id = ? AND participant_id = ?`, [eventId, participantId])
    runQuery(`DELETE FROM comments WHERE event_id = ? AND participant_id = ?`, [eventId, participantId])
    runQuery(`DELETE FROM participants WHERE id = ? AND event_id = ?`, [participantId, eventId])
  })
}

export function updateParticipant(eventId, participantId, newName) {
  const sanitizedName = sanitizeString(newName, LIMITS.USER_NAME)
  if (!sanitizedName) {
    throw new ValidationError('名字不能为空')
  }
  
  // 检查新名字是否已被其他参与者使用
  const existing = getOne(
    `SELECT id FROM participants WHERE event_id = ? AND name = ? AND id != ?`,
    [eventId, sanitizedName, participantId]
  )
  if (existing) {
    throw new ValidationError('该名字已被其他参与者使用')
  }
  
  runQuery(
    `UPDATE participants SET name = ? WHERE id = ? AND event_id = ?`,
    [sanitizedName, participantId, eventId]
  )
  
  return getOne(
    `SELECT id, name, created_at as createdAt FROM participants WHERE id = ?`,
    [participantId]
  )
}

export function getParticipantDetails(eventId, participantId) {
  const participant = getOne(
    `SELECT id, name, created_at as createdAt FROM participants WHERE id = ? AND event_id = ?`,
    [participantId, eventId]
  )
  
  if (!participant) return null
  
  const availabilityData = getAll(
    `SELECT date, status FROM availability WHERE event_id = ? AND participant_id = ?`,
    [eventId, participantId]
  )
  
  const commentsData = getAll(
    `SELECT id, content, created_at as createdAt FROM comments WHERE event_id = ? AND participant_id = ?`,
    [eventId, participantId]
  )
  
  return {
    ...participant,
    availability: availabilityData,
    comments: commentsData
  }
}

// ============================================
// Availability Operations
// ============================================
export function updateAvailability(eventId, participantId, dates, status) {
  if (!['available', 'unavailable'].includes(status)) {
    throw new ValidationError('状态必须是 available 或 unavailable')
  }
  
  const results = []
  
  runTransaction(() => {
    for (const date of dates) {
      // 验证日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      
      // 使用 REPLACE 来更新或插入
      runQuery(
        `INSERT OR REPLACE INTO availability (event_id, participant_id, date, status)
         VALUES (?, ?, ?, ?)`,
        [eventId, participantId, date, status]
      )
      
      results.push({
        eventId,
        participantId,
        date,
        status
      })
    }
  })
  
  return results
}

export function getAvailability(eventId) {
  return getAll(
    `SELECT a.id, a.event_id as eventId, a.participant_id as participantId, a.date, a.status, p.name as participantName
     FROM availability a
     JOIN participants p ON a.participant_id = p.id
     WHERE a.event_id = ?
     ORDER BY a.date`,
    [eventId]
  )
}

export function deleteAvailability(eventId, participantId, dates) {
  runTransaction(() => {
    for (const date of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      runQuery(
        `DELETE FROM availability WHERE event_id = ? AND participant_id = ? AND date = ?`,
        [eventId, participantId, date]
      )
    }
  })
}

// ============================================
// Comment Operations
// ============================================
export function addComment(eventId, participantId, content) {
  const sanitizedContent = sanitizeString(content, LIMITS.COMMENT)
  if (!sanitizedContent) {
    throw new ValidationError('评论内容不能为空')
  }
  
  runQuery(
    `INSERT INTO comments (event_id, participant_id, content) VALUES (?, ?, ?)`,
    [eventId, participantId, sanitizedContent]
  )
  
  const comment = getOne(
    `SELECT c.id, c.event_id as eventId, c.participant_id as participantId, c.content, c.created_at as createdAt, p.name as participantName
     FROM comments c
     JOIN participants p ON c.participant_id = p.id
     WHERE c.event_id = ? AND c.participant_id = ?
     ORDER BY c.id DESC LIMIT 1`,
    [eventId, participantId]
  )
  
  return comment
}

export function getComments(eventId) {
  return getAll(
    `SELECT c.id, c.event_id as eventId, c.participant_id as participantId, c.content, c.created_at as createdAt, p.name as participantName
     FROM comments c
     JOIN participants p ON c.participant_id = p.id
     WHERE c.event_id = ?
     ORDER BY c.created_at DESC`,
    [eventId]
  )
}

export function deleteComment(commentId, participantId = null) {
  if (participantId) {
    // 参与者只能删除自己的评论
    runQuery(`DELETE FROM comments WHERE id = ? AND participant_id = ?`, [commentId, participantId])
  } else {
    // 发起者可以删除任何评论
    runQuery(`DELETE FROM comments WHERE id = ?`, [commentId])
  }
}

export function updateComment(commentId, content, participantId = null) {
  const sanitizedContent = sanitizeString(content, LIMITS.COMMENT)
  if (!sanitizedContent) {
    throw new ValidationError('评论内容不能为空')
  }
  
  if (participantId) {
    // 参与者只能编辑自己的评论
    runQuery(
      `UPDATE comments SET content = ? WHERE id = ? AND participant_id = ?`,
      [sanitizedContent, commentId, participantId]
    )
  } else {
    // 发起者可以编辑任何评论
    runQuery(
      `UPDATE comments SET content = ? WHERE id = ?`,
      [sanitizedContent, commentId]
    )
  }
  
  return getOne(
    `SELECT c.id, c.event_id as eventId, c.participant_id as participantId, c.content, c.created_at as createdAt, p.name as participantName
     FROM comments c
     JOIN participants p ON c.participant_id = p.id
     WHERE c.id = ?`,
    [commentId]
  )
}

export function getComment(commentId) {
  return getOne(
    `SELECT c.id, c.event_id as eventId, c.participant_id as participantId, c.content, c.created_at as createdAt, p.name as participantName
     FROM comments c
     JOIN participants p ON c.participant_id = p.id
     WHERE c.id = ?`,
    [commentId]
  )
}

// ============================================
// Tag Operations
// ============================================
export function addTag(eventId, name, color = null, date = null, participantId = null) {
  const sanitizedName = sanitizeString(name, LIMITS.TAG_NAME)
  if (!sanitizedName) {
    throw new ValidationError('标签名称不能为空')
  }
  
  runQuery(
    `INSERT INTO event_tags (event_id, name, color, date, participant_id) VALUES (?, ?, ?, ?, ?)`,
    [eventId, sanitizedName, color || getRandomColor(), date, participantId]
  )
  
  const tag = getOne(
    `SELECT t.id, t.event_id as eventId, t.name, t.color, t.date,
            t.participant_id as participantId, COALESCE(p.name, '') as participantName
     FROM event_tags t
     LEFT JOIN participants p ON t.participant_id = p.id
     WHERE t.event_id = ? AND t.name = ? ORDER BY t.id DESC LIMIT 1`,
    [eventId, sanitizedName]
  )
  
  return tag
}

export function getTags(eventId) {
  return getAll(
    `SELECT t.id, t.event_id as eventId, t.name, t.color, t.date,
            t.participant_id as participantId, COALESCE(p.name, '') as participantName
     FROM event_tags t
     LEFT JOIN participants p ON t.participant_id = p.id
     WHERE t.event_id = ?`,
    [eventId]
  )
}

export function deleteTagByParticipant(eventId, tagId, participantId) {
  runQuery(
    `DELETE FROM event_tags WHERE id = ? AND event_id = ? AND participant_id = ?`,
    [tagId, eventId, participantId]
  )
}

export function deleteTag(eventId, tagId) {
  runQuery(`DELETE FROM event_tags WHERE id = ? AND event_id = ?`, [tagId, eventId])
}

// ============================================
// Date Note Operations
// ============================================
export function getDateNotes(eventId) {
  return getAll(
    `SELECT dn.id, dn.event_id as eventId, dn.participant_id as participantId,
            dn.date, dn.content, dn.created_at as createdAt, p.name as participantName
     FROM date_notes dn
     JOIN participants p ON dn.participant_id = p.id
     WHERE dn.event_id = ?
     ORDER BY dn.date, dn.created_at`,
    [eventId]
  )
}

export function addOrUpdateDateNote(eventId, participantId, date, content) {
  const sanitizedContent = sanitizeString(content, LIMITS.COMMENT)
  if (!sanitizedContent) {
    throw new ValidationError('备注内容不能为空')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('日期格式无效')
  }
  
  runQuery(
    `INSERT OR REPLACE INTO date_notes (event_id, participant_id, date, content)
     VALUES (?, ?, ?, ?)`,
    [eventId, participantId, date, sanitizedContent]
  )
  
  return getOne(
    `SELECT dn.id, dn.event_id as eventId, dn.participant_id as participantId,
            dn.date, dn.content, dn.created_at as createdAt, p.name as participantName
     FROM date_notes dn
     JOIN participants p ON dn.participant_id = p.id
     WHERE dn.event_id = ? AND dn.participant_id = ? AND dn.date = ?`,
    [eventId, participantId, date]
  )
}

export function deleteDateNote(eventId, noteId, participantId = null) {
  if (participantId) {
    runQuery(
      `DELETE FROM date_notes WHERE id = ? AND event_id = ? AND participant_id = ?`,
      [noteId, eventId, participantId]
    )
  } else {
    runQuery(
      `DELETE FROM date_notes WHERE id = ? AND event_id = ?`,
      [noteId, eventId]
    )
  }
}

// ============================================
// Utility
// ============================================
function getRandomColor() {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// ============================================
// Exports
// ============================================
export { LIMITS, WEIGHTS, DatabaseError, ValidationError }
export default { initDatabase }
