# 进度与待办

> **文档性质**：本文档记录 Statuz IDE 的开发进度和待办事项。所有状态声明均基于对代码库的直接验证。若某项信息暂时无法验证，将明确标注 "未验证"。

---

## 已知偏差说明

旧文档 `.trae/documents/handover.md` 中存在以下与代码实际状态不符的声明，已在此修正：

| 偏差项 | 旧文档声明 | 实际状态 | 参考 |
|--------|-----------|---------|------|
| Phase 1 品牌清理 | "Verify zero residual Void" 已完成 | 存在大量品牌残留（Action IDs、ViewContainer ID、IPC channel、UI 字符串等） | `BRAND_DEBT.md` |
| `src2/` 和 `out/` 提交状态 | 被提交到 git | 已被 `.gitignore` 排除，但本地 `src2/` 残留旧 Void 品牌文件名 | `ARCHITECTURE.md` |
| A2A 智能体模式 | 描述为已有架构 | 完全未实现，无相关代码文件 | `DESIGN.md` |
| Board 系统设计 | 描述为已有架构 | 完全未实现，无相关代码文件 | `DESIGN.md` |

---

## 已完成工作

### Phase 1: 品牌一致性

| 任务 | 状态 | 说明 |
|------|------|------|
| 版权头更新 | ✅ 已完成 | 所有文件版权头已更新为 `Copyright 2026 Statuz` |
| 文件名重命名 | ✅ 已完成 | `VoidCommandBar` → `StatuzCommandBar` 等 |
| 组件名重命名 | ✅ 已完成 | `VoidChatArea` → `StatuzChatArea` 等 |
| Action ID 重命名 | 🟡 部分完成 | 常量名已更名（`STATUZ_OPEN_SIDEBAR_ACTION_ID`），但字符串值仍为 `void.sidebar.open` 等 |
| ViewContainer ID 重命名 | 🟡 部分完成 | 常量名已更名（`STATUZ_VIEW_CONTAINER_ID`），但字符串值仍为 `workbench.view.void` |
| UI 字符串清理 | 🟡 部分完成 | 部分用户可见字符串仍包含 "Void" |
| IPC channel ID 重命名 | 🟡 部分完成 | 部分 channel ID 仍为 `void-channel-*` |
| `.voidrules` 重命名 | 🟡 部分完成 | 文件名和方法名仍为 `.voidrules` / `_getVoidRulesFileContents` |
| `voidVersion` 移除 | 🟡 部分完成 | `product.ts` 仍保留 `voidVersion` 字段 |
| App 图标替换 | ⬜ 未开始 | 等待设计师提供 `.ico` 和 `.icns` 文件 |

**总体状态**：🟡 部分完成。核心重命名工作已完成，但存在大量残留需要清理。详见 `BRAND_DEBT.md`。

### Phase 2: 启动体验

| 任务 | 状态 | 说明 |
|------|------|------|
| Onboarding 流程 | ✅ 已实现 | `browser/react/src/statuz-onboarding/` |
| 首次配置引导 | ✅ 已实现 | Settings 面板集成 |
| 快捷键提示 | ✅ 已实现 | `Ctrl+L` / `Ctrl+K` |

### Phase 3: AI 基础设施

| 任务 | 状态 | 说明 |
|------|------|------|
| MCP 协议服务 | ✅ 已实现 | `common/mcpService.ts` |
| LLM 消息服务 | ✅ 已实现 | `common/sendLLMMessageService.ts` |
| Chat 线程管理 | ✅ 已实现 | `browser/chatThreadService.ts` |
| 代码编辑服务 | ✅ 已实现 | `browser/editCodeService.ts` |
| Board 画布 | ⬜ 未开始 | 设计见 `DESIGN.md`，无代码实现 |
| A2A 智能体模式 | ⬜ 未开始 | 设计见 `DESIGN.md`，无代码实现 |

---

## 待办清单

### 高优先级

| # | 任务 | 参考文档 |
|---|------|---------|
| 1 | 修复 P0 品牌残留（C1-C2、M1-M5） | `BRAND_DEBT.md` |
| 2 | 建立 CI guard，防止新的品牌残留进入代码库 | `BRAND_DEBT.md` |
| 3 | 清理 `src2/` 和 `out/` 本地残留文件，重新执行构建 | `ARCHITECTURE.md` |
| 4 | 修复 Engine stub 编译隐患 | `BRAND_DEBT.md` M5 |

### 中优先级

| # | 任务 | 参考文档 |
|---|------|---------|
| 5 | 实现 Board 画布 MVP（Canvas + CardNode + Edge + Toolbar） | `DESIGN.md` |
| 6 | 实现 A2A 基础协议（Registry + Message Bus） | `DESIGN.md` |
| 7 | 替换 App 图标（`.ico` / `.icns`） | 设计师提供 |
| 8 | 修复 P1 卫生项（`as any`、`console.log`、错误链接） | `BRAND_DEBT.md` |

### 低优先级

| # | 任务 | 参考文档 |
|---|------|---------|
| 9 | Phase 4：快捷键与菜单集成 | — |
| 10 | 多智能体协作高级功能 | `DESIGN.md` |
| 11 | 性能优化（14K 行的 `SidebarChat.tsx` 拆分） | `ARCHITECTURE.md` |

---

*最后更新：基于代码库验证状态*
