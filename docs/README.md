# Statuz IDE 文档

> **项目定位**：Statuz IDE = VS Code (Shell + Editor) + Statuz (Sidebar AI)
>
> 所有 Statuz 代码位于 `src/vs/workbench/contrib/statuz/`，不修改 VS Code 核心。

---

## 项目概述

**项目名称**：Statuz IDE

**项目定位**：Statuz IDE 是一款专为 AI 编程设计的代码编辑器，基于 VS Code 构建，在右侧边栏（AuxiliaryBar）集成了强大的 AI 助手功能。它保留了 VS Code 的核心编辑体验，同时提供了 Chat、Quick Edit、Board 等 AI 增强功能。

**核心公式**：
```
Statuz IDE = VS Code (Shell + Editor) + Statuz (Sidebar AI)
```

**项目历史**：Statuz IDE 基于 Oasis 理念从 Void IDE 演进而来，在保留原有架构的同时，正在推进品牌一致性和功能增强。

---

## 产品愿景

**最终愿景**：VS Code + AI 侧边栏 = 最好的 AI 原生 IDE

**核心理念**：
- 保留 VS Code 的核心编辑体验（不修改核心）
- 在右侧边栏（AuxiliaryBar）提供 AI 增强功能
- 支持多种 LLM Provider（Ollama、OpenAI、Anthropic 等）
- 通过 MCP 协议连接外部工具
- 多智能体协作（Chat Agent、Board Agent、未来更多）

---

## 路线图

| Phase | 目标 | 状态 |
|-------|------|------|
| Phase 1 | 品牌一致性（版权头、文件名、组件名、UI 文本） | 🟡 部分完成（详见 `BRAND_DEBT.md`） |
| Phase 2 | 启动体验（Onboarding、首次配置） | ✅ 已实现 |
| Phase 3 | AI 基础设施（MCP 协议、Board 画布、多智能体） | 🟡 进行中 |
| Phase 4 | 快捷键与菜单集成 | ⬜ 未开始 |

**状态说明**：
- ✅ 已实现：代码已合入主干，功能可用
- 🟡 部分完成 / 进行中：核心功能已实现，但存在已知问题或待完善
- ⬜ 未开始：尚未进入开发阶段

**重要提醒**：Phase 1 品牌清理在旧文档中被错误标记为"已完成"，但实际代码库中存在大量品牌残留。详见 `BRAND_DEBT.md` 中的逐项清单。

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/vs/workbench/contrib/statuz/browser/sidebarPane.ts` | VS Code ViewPane 注册 |
| `src/vs/workbench/contrib/statuz/browser/sidebarActions.ts` | Action 注册（打开 Sidebar、Ctrl+L 等） |
| `src/vs/workbench/contrib/statuz/browser/react/src/sidebar-tsx/Sidebar.tsx` | Sidebar 根 React 组件 |
| `src/vs/workbench/contrib/statuz/browser/react/src/util/services.tsx` | React-VS Code 服务桥接 |
| `src/vs/workbench/contrib/statuz/browser/chatThreadService.ts` | Chat 线程状态管理 |
| `src/vs/workbench/contrib/statuz/browser/editCodeService.ts` | 代码编辑与 Diff 操作 |
| `src/vs/workbench/contrib/statuz/common/sendLLMMessageService.ts` | LLM 消息发送接口 |
| `src/vs/workbench/contrib/statuz/common/mcpService.ts` | MCP 协议服务 |
| `src/vs/workbench/contrib/statuz/browser/react/build.js` | React 构建脚本 |
| `src/vs/workbench/contrib/statuz/browser/react/tsup.config.js` | tsup 打包配置 |

---

## 文档导航

| 文档 | 内容 | 读者 |
|------|------|------|
| `ARCHITECTURE.md` | 现有代码架构（Sidebar、ViewPane、Build、Services、State） | 开发者 |
| `DESIGN.md` | 前瞻性设计（A2A 智能体、Board 系统、Sandboxer 参考） | 架构师、设计师 |
| `BRAND_DEBT.md` | 品牌残留问题清单（P0 阻断性、P1 卫生项） | 维护者、发布负责人 |
| `PROGRESS.md` | 已完成工作、已知偏差、待办清单 | 项目经理、开发者 |
| `TROUBLESHOOTING.md` | 构建错误、运行时错误、性能建议 | 开发者、用户 |
| `appendix/GLOSSARY.md` | 术语表 | 所有读者 |
| `appendix/PATH_INDEX.md` | 完整文件路径索引 | 开发者 |
| `appendix/REFERENCES.md` | 外部参考资源 | 开发者 |
| `appendix/CSS_VARIABLES.md` | CSS 变量系统定义 | 前端开发者 |

---

*文档体系版本：v1.0（基于代码库验证状态）*
