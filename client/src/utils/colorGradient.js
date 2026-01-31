/**
 * 颜色渐变工具
 * 用于根据日期得分计算渐变颜色
 */

// 权重常量
export const WEIGHTS = {
  AVAILABLE: 1,
  UNAVAILABLE: -2
}

/**
 * 解析十六进制颜色为 RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * RGB 转十六进制
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * 在两个颜色之间插值
 */
function interpolateColor(color1, color2, factor) {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) return color1
  
  const r = rgb1.r + (rgb2.r - rgb1.r) * factor
  const g = rgb1.g + (rgb2.g - rgb1.g) * factor
  const b = rgb1.b + (rgb2.b - rgb1.b) * factor
  
  return rgbToHex(r, g, b)
}

/**
 * 计算某天的得分
 * @param {Array} availabilityList - 该天的可用性列表
 * @returns {number} 得分
 */
export function calculateDayScore(availabilityList) {
  if (!availabilityList || availabilityList.length === 0) return 0
  
  let score = 0
  availabilityList.forEach(a => {
    score += a.status === 'available' ? WEIGHTS.AVAILABLE : WEIGHTS.UNAVAILABLE
  })
  return score
}

/**
 * 根据得分计算颜色
 * @param {number} score - 当前得分
 * @param {number} minScore - 最小可能得分
 * @param {number} maxScore - 最大可能得分
 * @returns {string} 十六进制颜色
 */
export function scoreToColor(score, minScore, maxScore) {
  // 颜色定义：红 -> 黄 -> 绿
  const RED = '#ef4444'
  const YELLOW = '#eab308'
  const GREEN = '#22c55e'
  
  // 如果没有数据或范围为0，返回灰色
  if (maxScore === minScore) {
    return '#9ca3af'
  }
  
  // 归一化到 0-1
  const normalized = (score - minScore) / (maxScore - minScore)
  
  // 分段插值
  if (normalized < 0.5) {
    // 红到黄
    return interpolateColor(RED, YELLOW, normalized * 2)
  } else {
    // 黄到绿
    return interpolateColor(YELLOW, GREEN, (normalized - 0.5) * 2)
  }
}

/**
 * 计算所有日期的颜色映射
 * @param {Object} availabilityByDate - 按日期分组的可用性数据 { 'YYYY-MM-DD': [...] }
 * @param {number} totalParticipants - 总参与者数量
 * @returns {Object} 颜色映射 { 'YYYY-MM-DD': '#color' }
 */
export function calculateColorMap(availabilityByDate, totalParticipants) {
  const colorMap = {}
  const scores = {}
  
  // 计算每天的得分
  for (const [date, list] of Object.entries(availabilityByDate)) {
    scores[date] = calculateDayScore(list)
  }
  
  // 计算理论最大最小值
  const maxPossible = totalParticipants * WEIGHTS.AVAILABLE
  const minPossible = totalParticipants * WEIGHTS.UNAVAILABLE
  
  // 计算颜色
  for (const [date, score] of Object.entries(scores)) {
    colorMap[date] = scoreToColor(score, minPossible, maxPossible)
  }
  
  return colorMap
}

/**
 * 获取颜色的文字对比色（黑或白）
 */
export function getContrastColor(hexColor) {
  const rgb = hexToRgb(hexColor)
  if (!rgb) return '#000000'
  
  // 计算亮度
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness > 128 ? '#000000' : '#ffffff'
}

/**
 * 获取统计数据
 * @param {Object} availabilityByDate - 按日期分组的可用性数据
 * @param {Array} participants - 参与者列表
 * @returns {Object} 统计数据
 */
export function getStatistics(availabilityByDate, participants) {
  const stats = {
    bestDates: [],           // 最佳日期（得分最高）
    allAvailableDates: [],   // 所有人都能参加的日期
    dateDetails: {},         // 每天的详细统计
    participantStats: {}     // 每个参与者的响应统计
  }
  
  const totalParticipants = participants.length
  
  // 计算每天的统计
  const scoredDates = []
  for (const [date, list] of Object.entries(availabilityByDate)) {
    const availableCount = list.filter(a => a.status === 'available').length
    const unavailableCount = list.filter(a => a.status === 'unavailable').length
    const score = calculateDayScore(list)
    
    stats.dateDetails[date] = {
      availableCount,
      unavailableCount,
      noResponseCount: totalParticipants - availableCount - unavailableCount,
      score,
      participants: list
    }
    
    scoredDates.push({ date, score, availableCount })
    
    // 检查是否所有人都能参加
    if (availableCount === totalParticipants && totalParticipants > 0) {
      stats.allAvailableDates.push(date)
    }
  }
  
  // 排序获取最佳日期
  scoredDates.sort((a, b) => b.score - a.score)
  stats.bestDates = scoredDates.slice(0, 5).map(d => ({
    date: d.date,
    score: d.score,
    availableCount: d.availableCount
  }))
  
  // 计算每个参与者的响应情况
  participants.forEach(p => {
    const responses = Object.values(availabilityByDate)
      .flat()
      .filter(a => a.participantId === p.id)
    
    stats.participantStats[p.id] = {
      name: p.name,
      totalResponses: responses.length,
      availableCount: responses.filter(a => a.status === 'available').length,
      unavailableCount: responses.filter(a => a.status === 'unavailable').length
    }
  })
  
  return stats
}
