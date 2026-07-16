# 完整文件路径索引

> **说明**：以下路径均相对于 `src/vs/workbench/contrib/statuz/`。完整绝对路径前缀为 `d:\github projects\Statuz-IDE\src\vs\workbench\contrib\statuz\`。

## 核心文件

| 简写路径 | 完整路径 | 职责 |
|----------|----------|------|
| `browser/sidebarPane.ts` | `src/vs/workbench/contrib/statuz/browser/sidebarPane.ts` | VS Code ViewPane 注册 |
| `browser/sidebarActions.ts` | `src/vs/workbench/contrib/statuz/browser/sidebarActions.ts` | Action 注册 |
| `browser/actionIDs.ts` | `src/vs/workbench/contrib/statuz/browser/actionIDs.ts` | Action ID 常量 |
| `browser/chatThreadService.ts` | `src/vs/workbench/contrib/statuz/browser/chatThreadService.ts` | Chat 线程状态管理 |
| `browser/editCodeService.ts` | `src/vs/workbench/contrib/statuz/browser/editCodeService.ts` | 代码编辑与 Diff |
| `browser/fileService.ts` | `src/vs/workbench/contrib/statuz/browser/fileService.ts` | 文件系统操作 |
| `browser/statuzSCMService.ts` | `src/vs/workbench/contrib/statuz/browser/statuzSCMService.ts` | SCM 集成 |
| `browser/terminalToolService.ts` | `src/vs/workbench/contrib/statuz/browser/terminalToolService.ts` | Terminal 工具 |
| `browser/convertToLLMMessageService.ts` | `src/vs/workbench/contrib/statuz/browser/convertToLLMMessageService.ts` | 消息格式转换 |

## React 组件

| 简写路径 | 完整路径 | 职责 |
|----------|----------|------|
| `browser/react/src/sidebar-tsx/Sidebar.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/sidebar-tsx/Sidebar.tsx` | Sidebar 根组件 |
| `browser/react/src/sidebar-tsx/SidebarChat.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/sidebar-tsx/SidebarChat.tsx` | Chat 面板（~14K 行） |
| `browser/react/src/util/services.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/util/services.tsx` | 服务桥接 |
| `browser/react/src/statuz-settings-tsx/Settings.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/statuz-settings-tsx/Settings.tsx` | 设置面板 |
| `browser/react/src/statuz-editor-widgets-tsx/index.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/statuz-editor-widgets-tsx/index.tsx` | 编辑器 widgets |
| `browser/react/src/quick-edit-tsx/index.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/quick-edit-tsx/index.tsx` | Quick edit |
| `browser/react/src/statuz-onboarding/index.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/statuz-onboarding/index.tsx` | Onboarding |
| `browser/react/src/statuz-tooltip/index.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/statuz-tooltip/index.tsx` | Tooltip |
| `browser/react/src/diff/index.tsx` | `src/vs/workbench/contrib/statuz/browser/react/src/diff/index.tsx` | Diff 视图 |

## 共享代码

| 简写路径 | 完整路径 | 职责 |
|----------|----------|------|
| `common/statuzSettingsService.ts` | `src/vs/workbench/contrib/statuz/common/statuzSettingsService.ts` | 设置状态 |
| `common/sendLLMMessageService.ts` | `src/vs/workbench/contrib/statuz/common/sendLLMMessageService.ts` | LLM 消息接口 |
| `common/mcpService.ts` | `src/vs/workbench/contrib/statuz/common/mcpService.ts` | MCP 协议 |
| `common/metricsService.ts` | `src/vs/workbench/contrib/statuz/common/metricsService.ts` | Metrics |
| `common/statuzUpdateService.ts` | `src/vs/workbench/contrib/statuz/common/statuzUpdateService.ts` | 自动更新接口 |
| `common/statuzUpdateServiceTypes.ts` | `src/vs/workbench/contrib/statuz/common/statuzUpdateServiceTypes.ts` | 自动更新类型 |
| `common/engine/statuzEngineService.ts` | `src/vs/workbench/contrib/statuz/common/engine/statuzEngineService.ts` | Engine stub |

## 主进程

| 简写路径 | 完整路径 | 职责 |
|----------|----------|------|
| `electron-main/statuzUpdateMainService.ts` | `src/vs/workbench/contrib/statuz/electron-main/statuzUpdateMainService.ts` | 自动更新逻辑 |
| `electron-main/metricsMainService.ts` | `src/vs/workbench/contrib/statuz/electron-main/metricsMainService.ts` | Metrics 主进程 |
| `electron-main/llmMessage/sendLLMMessage.impl.ts` | `src/vs/workbench/contrib/statuz/electron-main/llmMessage/sendLLMMessage.impl.ts` | LLM 消息实现 |
| `electron-main/llmMessage/sendLLMMessage.ts` | `src/vs/workbench/contrib/statuz/electron-main/llmMessage/sendLLMMessage.ts` | LLM 消息接口 |
| `electron-main/mcpChannel.ts` | `src/vs/workbench/contrib/statuz/electron-main/mcpChannel.ts` | MCP channel |
| `electron-main/sendLLMMessageChannel.ts` | `src/vs/workbench/contrib/statuz/electron-main/sendLLMMessageChannel.ts` | LLM message channel |

## 构建配置

| 简写路径 | 完整路径 | 职责 |
|----------|----------|------|
| `browser/react/tsup.config.js` | `src/vs/workbench/contrib/statuz/browser/react/tsup.config.js` | tsup 配置 |
| `browser/react/build.js` | `src/vs/workbench/contrib/statuz/browser/react/build.js` | 构建脚本 |
| `browser/react/styles.css` | `src/vs/workbench/contrib/statuz/browser/react/styles.css` | CSS 变量 |
| `browser/react/package.json` | `src/vs/workbench/contrib/statuz/browser/react/package.json` | React 子项目依赖 |
