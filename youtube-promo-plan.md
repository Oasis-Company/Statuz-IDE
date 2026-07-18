# Statuz IDE — YouTube 宣传视频执行计划

> 基于 HyperFrames 的 HTML 动画宣传视频
> 预计时长：~90 秒 · 分辨率：1920×1080 · 目标：GitHub / YouTube / 官网

---

## 一、项目审查摘要

### 1.1 项目定位

Statuz IDE 是一个**拓扑感知型（Topology-Aware）AI 原生代码编辑器**，基于 VS Code 构建，采用增量式工程策略。

核心公式：`Statuz IDE = VS Code + Statuz Graph Engine (Rust)`

### 1.2 核心差异化卖点

| # | 特性 | 竞品对比 | 视频优先级 |
|---|------|---------|-----------|
| 1 | **Rust Graph Engine** — Traverse/Impact/Path 三原语查询 | 独有，VS Code/Cursor/Windsurf 均无 | ★★★★★ |
| 2 | **DCR 决策捕获系统** — 架构决策注册、漂移检测、宪法约束 | 独有 | ★★★★ |
| 3 | **Strategy Board 画布** — 原生 SVG 策略看板，5 种连线类型 | 独有 | ★★★★ |
| 4 | **17 个 AI 模型提供商** — 按功能分配不同模型 | 业界最广 | ★★★ |
| 5 | **ECC 深度集成** — UI 化安装/管理 63+ 个 Agent 技能 | 独有 | ★★★ |
| 6 | **MCP 协议原生支持** — 完整工具调用生命周期 | 完整（竞品为扩展方式） | ★★★ |
| 7 | **一键迁移** — 从 VS Code/Cursor/Windsurf 迁移设置 | 独有 | ★★ |
| 8 | **主进程 SDK 调用** — API 密钥安全隔离 | 独有 | ★★ |

### 1.3 品牌资产

- **Logo:** SVG 极简线条拓扑抽象（3 条折线 + 中心圆点）
- **设计语言:** 瑞士风格 · 黑白 · 极简
- **字体:** Inter (显示) / JetBrains Mono (代码)
- **现有文案:** "Code is not text. Code is a graph." / "The text era is over. The topology era has begun."

---

## 二、视频叙事结构（7 场景 · 90 秒）

### 节奏模式: hook → PUNCH → breathe → BUILD → PEAK → resolve → CTA

| 场景 | 时间 | 内容 | 视觉重点 | 能量 |
|------|------|------|---------|------|
| **1. Hook** | 0–5s | "The text era is over. The topology era has begun." | 大标题打字机效果 + 幽灵文字 | 低→中 |
| **2. 问题** | 5–15s | 传统 IDE 中代码的隐藏依赖不可见 | VS Code 界面 + 红色依赖线叠加 | 中 |
| **3. 解决方案** | 15–25s | Statuz = VS Code + Rust Graph Engine | 蓝色图结构浮现 + 大标题 (Shader 转场) | **高** |
| **4. 三原语** | 25–45s | Traverse · Impact · Path 分屏演示 | 左侧图可视化 + 右侧终端查询 | 渐强 |
| **5. DCR + Board** | 45–60s | 策略看板 + 决策捕获 + 完整性评分 | 四色卡片 + 连线 + 圆环 | 持续 |
| **6. AI 生态** | 60–75s | 16 个提供商 + MCP + ECC | 4×4 网格 → 流水线图 | 中 |
| **7. CTA** | 75–90s | 下载 + GitHub + 文档 | Logo 居中 + 三个按钮 + 渐黑 | 中→收 |


### 场景间转场设计

| 转场 | 位置 | 类型 | 时长 |
|------|------|------|------|
| Scene 1 → 2 | 5.0s | Blur crossfade | 0.6s |
| Scene 2 → 3 | 15.0s | **Domain-warp shader** | 0.7s |
| Scene 3 → 4 | 25.0s | Blur crossfade | 0.5s |
| Scene 4 → 5 | 45.0s | Blur crossfade | 0.5s |
| Scene 5 → 6 | 60.0s | Blur crossfade | 0.5s |
| Scene 6 → 7 | 75.0s | Blur crossfade | 0.6s |

---

## 三、视觉系统

### 调色板

| 用途 | 色值 | 说明 |
|------|------|------|
| 主背景 | `#0A0A0A` | 深色画布 |
| 卡片背景 | `#1A1A1A` | 表面层级 |
| 主文字 | `#FFFFFF` | 标题 |
| 二级文字 | `#A0A0A0` | 正文 |
| 强调色 | `#007FD4` | 链接、高亮 |
| 边框 | `#333333` | 分割线 |

### 字体

- **显示:** Inter (700–900 weight) — 标题、标签
- **代码:** JetBrains Mono — 代码块、终端

### 每个场景的固定装饰层

1. **径向辉光** — 强调色 (`#007FD4`)，8–12% 不透明度，呼吸动画
2. **幽灵文字** — 大号 "STATUZ" 字，2–5% 不透明度，缓慢漂移
3. **网格线** — 点阵或发丝线，3–5% 不透明度，微脉冲
4. **底部规则** — 2px 发丝线，`#333333`
5. **Logo** — 右下角（除 CTA 场景居中）

---

## 四、执行步骤

### 阶段 1：基础设施（~30 分钟）

- [ ] 1.1 初始化 HyperFrames 项目结构
- [ ] 1.2 创建 `DESIGN.md`（已完成）
- [ ] 1.3 创建 `.hyperframes/expanded-prompt.md`（已完成）
- [ ] 1.4 创建 `index.html` 主入口文件
- [ ] 1.5 验证 `npx hyperframes init` 和 `npx hyperframes lint`

### 阶段 2：HTML 场景实现（~4–6 小时）

每个场景作为独立的子组合文件：

| 文件 | 场景 | 复杂度 |
|------|------|--------|
| `compositions/scene1-hook.html` | 开场标题 + 打字机效果 | 中 |
| `compositions/scene2-problem.html` | VS Code 界面 + 依赖线叠加 | 高 |
| `compositions/scene3-solution.html` | 图结构 + 产品名称揭示 | 高 |
| `compositions/scene4-queries.html` | 分屏演示 (图 + 终端) | 最高 |
| `compositions/scene5-board.html` | 策略看板 + 圆环评分 | 高 |
| `compositions/scene6-ai.html` | 提供商网格 + 流水线 | 中 |
| `compositions/scene7-cta.html` | 结尾 + 按钮 | 低 |

### 阶段 3：动画调优（~2 小时）

- [ ] 3.1 调整 GSAP 时间线同步
- [ ] 3.2 验证所有转场 (Blur crossfade + Domain-warp shader)
- [ ] 3.3 添加装饰层呼吸动画
- [ ] 3.4 代码块颜色和打字机效果
- [ ] 3.5 图节点/边的动画编排

### 阶段 4：质量检查（~1 小时）

- [ ] 4.1 `npx hyperframes lint` — 语法验证
- [ ] 4.2 `npx hyperframes validate` — 对比度检查
- [ ] 4.3 `npx hyperframes inspect` — 布局溢出检查
- [ ] 4.4 动画地图检查 — 死区、碰撞、节奏验证
- [ ] 4.5 全流程预览 — 从 0s 到 90s 串场验证

### 阶段 5：输出（~1 小时）

- [ ] 5.1 `npx hyperframes render` — 渲染为 MP4 视频
- [ ] 5.2 准备 YouTube 封面缩略图
- [ ] 5.3 最终质量检查
- [ ] 5.4 交付

---

## 五、实现细节说明

### 5.1 架构设计

```
index.html (主入口)
├── Scene 1: compositions/scene1-hook.html
├── Scene 2: compositions/scene2-problem.html
├── Scene 3: compositions/scene3-solution.html
├── Scene 4: compositions/scene4-queries.html
├── Scene 5: compositions/scene5-board.html
├── Scene 6: compositions/scene6-ai.html
└── Scene 7: compositions/scene7-cta.html
```

### 5.2 关键动画技术

| 效果 | 技术方案 |
|------|---------|
| 打字机效果 | `gsap.from()` + 字符拆分 |
| 图节点动画 | `gsap.from()` + `stagger` |
| 连线绘制 | `stroke-dashoffset` 动画 |
| 图结构脉冲 | `sine.inOut` 呼吸动画 |
| 圆环计数 | `stroke-dashoffset` 值动画 |
| 网格波 | 多元素 `stagger` |
| 爆炸半径 | 同心圆 `scale` 动画 |
| 渐变黑 | 最后场景 `opacity: 1→0` |

### 5.3 设计约束

- 所有动画必须 **确定性** — 无 `Math.random()` 或 `Date.now()`
- 所有时间线 `{ paused: true }` — 由 HyperFrames 播放器控制
- 过渡使用 **Blur crossfade**（主）和 **Domain-warp shader**（场景 3 揭示）
- 禁止 `repeat: -1` — 使用有限循环
- 禁止异步构建时间线
- 视频专用尺寸：标题 60–120px，正文 28–42px，标签 18–24px

---

## 六、已产出文件

| 文件 | 用途 | 状态 |
|------|------|------|
| `DESIGN.md` | 视频视觉系统定义（颜色、字体、动效语言） | ✅ 已完成 |
| `.hyperframes/expanded-prompt.md` | 完整生产剧本（7 场景，逐帧编排） | ✅ 已完成 |
| `youtube-promo-plan.md` | 本执行计划文档 | ✅ 已完成 |

---

## 七、待定决策

请在开始执行前确认以下事项：

1. **视频时长偏好** — 当前设计为 ~90 秒。是否接受？或者您希望缩短到 60 秒或延长到 120 秒？
2. **叙事重点** — 是否突出某个特定功能？当前方案强调 Graph Engine > DCR/Board > AI Ecosystem。是否需要调整优先级？
3. **是否需要语音旁白？** — 当前方案为纯视觉 + 背景音乐。如果添加 TTS 语音，需要额外生成配音脚本。
4. **背景音乐风格** — 提供几种选择：A) 极简电子环境音（Hans Zimmer 风格） B) 节奏感强的科技脉冲（Daft Punk 风格） C) 温和的钢琴/环境音
5. **是否添加字幕？** — YouTube 视频建议添加英文字幕。是否需要中英双语字幕？