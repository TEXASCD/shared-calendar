# 🗓️ 共享协作日历

实时多人协作日历，支持日夜主题、中英日三语、SQLite 数据持久化。

## 特性

- ✅ **无需注册** - 输入名字即可开始协作
- ✅ **实时同步** - WebSocket 实时广播，多人同时编辑
- ✅ **日夜主题** - 支持浅色/深色主题切换
- ✅ **多语言** - 中文 / English / 日本語
- ✅ **数据持久化** - SQLite 存储，重启不丢失
- ✅ **拖选日期** - 批量选择日期并标记
- ✅ **权重着色** - 可参加/不可参加自动着色
- ✅ **备注投票** - 每个事项支持备注和投票

## 技术栈

- **前端**: Vue 3 + Vite + vue-i18n
- **后端**: Express + WebSocket
- **数据库**: SQLite (better-sqlite3)

## 快速开始

### 1. 安装依赖

```bash
# 安装所有依赖
npm run install:all

# 或分别安装
npm install
cd server && npm install
cd ../client && npm install
```

### 2. 开发模式

```bash
# 同时启动前后端开发服务
npm run dev

# 或分别启动
npm run dev:server  # 后端 http://localhost:3000
npm run dev:client  # 前端 http://localhost:5173
```

### 3. 生产构建

```bash
# 构建前端
npm run build

# 启动服务
npm start
```

访问 http://localhost:3000

## 项目结构

```
├── client/                # Vue 3 前端
│   ├── src/
│   │   ├── components/    # Vue 组件
│   │   ├── composables/   # 组合式函数
│   │   ├── i18n/          # 多语言文件
│   │   └── styles/        # 全局样式
│   └── vite.config.js
├── server/                # Node.js 后端
│   ├── index.js           # 入口
│   ├── db.js              # SQLite 数据层
│   └── ws.js              # WebSocket 处理
├── public/                # 静态资源 (构建输出)
└── package.json
```

## 使用说明

1. **加入协作**: 输入名字点击"加入"
2. **创建事项**: 点击日期 → 点击"添加事项" → 填写表单
3. **拖选日期**: 在日历上拖拽选择多个日期
4. **标记日期**: 创建标签 → 选择标签和类型 → 点击"应用"
5. **备注投票**: 展开事项卡片 → 添加备注或发起投票

## 权重说明

- 可参加: +1 (绿色)
- 不可参加: -2 (红色)
- 颜色深浅代表权重绝对值大小

## License

MIT
