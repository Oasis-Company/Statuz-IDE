# 品牌债务清单

> **验证方法**：本文档中每条债务均附带精确的 `file:line` 引用和实际代码片段。所有引用均通过对代码库的直接读取验证。若某条信息暂时无法验证，将明确标注 "未验证"。
> 
> **验证范围**：`src/vs/workbench/contrib/statuz/` 及其子目录，以及 `src/vs/base/common/product.ts`、`src/vs/code/electron-main/app.ts` 等涉及 Statuz 功能的相关文件。

---

## P0 — 发布阻断项

以下问题会直接导致用户将 Statuz IDE 识别为 Void，或导致安全/功能故障。在修复前，**不可发布**。

### C1: 自动更新获取 Void 的二进制文件

**位置**：`src/vs/workbench/contrib/statuz/electron-main/statuzUpdateMainService.ts:98`

**代码片段**：
```typescript
const response = await fetch('https://api.github.com/repos/voideditor/binaries/releases/latest');
```

**影响**：若启用自动更新，应用将下载并提示安装 Void Editor 的二进制文件，可能覆盖 Statuz IDE 或导致功能异常。Oasis-Company 的仓库从未被咨询。

**附加问题**：
- 同文件第115行：`message = 'A new version of Void is available! ...'`
- 同文件第119行：`message = 'Void is up-to-date!'`
- 同文件第130行：`message = 'A new version of Void is available! ...'`
- 同文件第82行：`return { message: 'Restart Void to update!', action: 'restart' } as const`

**类型名残留**：
- `src/vs/workbench/contrib/statuz/common/statuzUpdateServiceTypes.ts:6`：`export type VoidCheckUpdateRespose = { ... }`（拼写错误：Respose 应为 Response）

**修复方向**：
1. 将 endpoint 从 `voideditor/binaries` 改为 Oasis-Company 的二进制仓库地址。
2. 将所有用户可见消息中的 "Void" 替换为 "Statuz"。
3. 重命名类型 `VoidCheckUpdateRespose` 为 `StatuzCheckUpdateResponse`，并同步更新所有引用处。

---

### C2: 运行中的 UI 仍显示 "Void"

以下列表包含所有用户可见的 "Void" 字符串残留，按文件归类。

#### Action 标题与 ID

**位置**：`src/vs/workbench/contrib/statuz/browser/sidebarActions.ts`

| 行号 | 代码片段 |
|------|---------|
| 64 | `const STATUZ_OPEN_SIDEBAR_ACTION_ID = 'void.sidebar.open'` |
| 67 | `title: localize2('voidOpenSidebar', 'Void: Open Sidebar')` |
| 84 | `title: localize2('voidCmdL', 'Void: Add Selection to Chat')` |
| 147 | `const STATUZ_CMD_SHIFT_L_ACTION_ID = 'void.cmdShiftL'` |
| 212 | `id: 'void.historyAction'` |
| 242 | `id: 'void.settingsAction', title: 'Void\'s Settings'` |

**位置**：`src/vs/workbench/contrib/statuz/browser/actionIDs.ts`

| 行号 | 代码片段 |
|------|---------|
| 4 | `export const STATUZ_CTRL_L_ACTION_ID = 'void.ctrlLAction'` |
| 6 | `export const STATUZ_CTRL_K_ACTION_ID = 'void.ctrlKAction'` |
| 8 | `export const STATUZ_ACCEPT_DIFF_ACTION_ID = 'void.acceptDiff'` |
| 10 | `export const STATUZ_REJECT_DIFF_ACTION_ID = 'void.rejectDiff'` |
| 12 | `export const STATUZ_GOTO_NEXT_DIFF_ACTION_ID = 'void.goToNextDiff'` |
| 14 | `export const STATUZ_GOTO_PREV_DIFF_ACTION_ID = 'void.goToPrevDiff'` |
| 16 | `export const STATUZ_GOTO_NEXT_URI_ACTION_ID = 'void.goToNextUri'` |
| 18 | `export const STATUZ_GOTO_PREV_URI_ACTION_ID = 'void.goToPrevUri'` |
| 20 | `export const STATUZ_ACCEPT_FILE_ACTION_ID = 'void.acceptFile'` |
| 22 | `export const STATUZ_REJECT_FILE_ACTION_ID = 'void.rejectFile'` |
| 24 | `export const STATUZ_ACCEPT_ALL_DIFFS_ACTION_ID = 'void.acceptAllDiffs'` |
| 26 | `export const STATUZ_REJECT_ALL_DIFFS_ACTION_ID = 'void.rejectAllDiffs'` |

#### ViewContainer ID

**位置**：`src/vs/workbench/contrib/statuz/browser/sidebarPane.ts:104`

```typescript
export const STATUZ_VIEW_CONTAINER_ID = 'workbench.view.void'
```

**附加注释**：同文件第111行注释明确说明了历史遗留问题：
```typescript
title: nls.localize2('statuzContainer', 'Chat'), // this is used to say "Void" (Ctrl + L)
```

#### Metrics 与调试信息

**位置**：`src/vs/workbench/contrib/statuz/common/metricsService.ts`

| 行号 | 代码片段 |
|------|---------|
| 34 | `this.metricsService = ProxyChannel.toService<IMetricsService>(mainProcessService.getChannel('void-channel-metrics'));` |
| 62 | `title: localize2('voidMetricsDebug', 'Void: Log Debug Info')` |
| 71 | `notifService.info(`Void Debug info:\n${JSON.stringify(debugProperties, null, 2)}`)` |

#### LLM 消息与错误提示

**位置**：`src/vs/workbench/contrib/statuz/electron-main/llmMessage/sendLLMMessage.ts:81`

```typescript
errorMessage = `Failed to fetch from ${displayInfoOfProviderName(providerName).title}. This likely means you specified the wrong endpoint in Void's Settings, or your local model provider like Ollama is powered off.`
```

**位置**：`src/vs/workbench/contrib/statuz/electron-main/llmMessage/sendLLMMessage.impl.ts`

| 行号 | 代码片段 |
|------|---------|
| 171 | `throw new Error(`Void providerName was invalid: ${providerName}.`)` |
| 375 | `onError({ message: 'Void: Response from model was empty.', fullError: null })` |
| 820 | `onError({ message: 'Void: Response from model was empty.', fullError: null })` |

#### 文件服务与代码编辑

**位置**：`src/vs/workbench/contrib/statuz/browser/fileService.ts:20`

```typescript
title: localize2('voidCopyPrompt', 'Void: Copy Prompt')
```

**位置**：`src/vs/workbench/contrib/statuz/browser/editCodeService.ts`

| 行号 | 代码片段 |
|------|---------|
| 746 | `label: 'Void Agent'` |
| 1000 | `throw new Error(`Void: diff.type not recognized on: ${lastDiff}`)` |
| 1379 | `throw new Error(`Void: diff.type not recognized on: ${from}`)` |
| 1971 | `this._notificationService.info(`Void: We ran Fast Apply, but the LLM didn't output any changes.`)` |

**位置**：`src/vs/workbench/contrib/statuz/browser/terminalToolService.ts`

| 行号 | 代码片段 |
|------|---------|
| 56 | `if (id === '1') return 'Void Agent'` |
| 57 | `return `Void Agent (${id})`` |
| 60 | `if (name === 'Void Agent') return '1'` |
| 62 | `const match = name.match(/Void Agent \((\d+)\)/)` |

#### IPC Channel 错误消息

**位置**：`src/vs/workbench/contrib/statuz/electron-main/mcpChannel.ts:104`

```typescript
throw new Error(`Void sendLLM: command "${command}" not recognized.`)
```

**位置**：`src/vs/workbench/contrib/statuz/electron-main/sendLLMMessageChannel.ts:84`

```typescript
throw new Error(`Void sendLLM: command "${command}" not recognized.`)
```

#### React UI 中的 .voidrules 提示

**位置**：`src/vs/workbench/contrib/statuz/browser/react/src/statuz-settings-tsx/Settings.tsx:1499`

```tsx
Alternatively, place a `.voidrules` file in the root of your workspace.
```

**位置**：`src/vs/workbench/contrib/statuz/browser/react/src/sidebar-tsx/SidebarChat.tsx:3100`

```tsx
'Create a .voidrules file for me'
```

**修复方向**：
1. 对所有用户可见字符串（localize、title、message、label）执行全局替换，将 "Void" 改为 "Statuz"。
2. 对所有 action ID 和 ViewContainer ID 执行重命名（`void.*` → `statuz.*`）。
3. 同步更新 VS Code 的 keybindings、menus 和 view container 注册处的引用。
4. 添加 CI guard：构建失败若 `src/vs/workbench/contrib/statuz/` 中出现未在允许列表中的 `Void` / `voideditor` 字符串。

**修复状态更新**（2026-07-16）：本次批量修复已处理 C2 中所有用户可见字符串、Action ID、ViewContainer ID、类型名、product 字段和 React UI 提示。详见 commit `fix: complete brand cleanup and initial setup experience`。以下债务已解决：

- ✅ C2 Action 标题与 ID（全部重命名 `void.*` → `statuz.*`）
- ✅ C2 ViewContainer ID（`workbench.view.void` → `workbench.view.statuz`）
- ✅ C2 Metrics 与调试信息（`Void: Log Debug Info` → `Statuz: Log Debug Info`）
- ✅ C2 LLM 消息与错误提示（`Void's Settings` → `Statuz's Settings` 等）
- ✅ C2 文件服务与代码编辑（`Void Agent` → `Statuz Agent` 等）
- ✅ C2 Terminal Tool Service（`Void Agent` → `Statuz Agent`）
- ✅ C2 IPC Channel 错误消息（`Void sendLLM` → `Statuz sendLLM`）
- ✅ C2 React UI .voidrules（`.voidrules` → `.statuzrules`）
- ✅ M3 product.ts `voidVersion` → `statuzVersion`

---

## P0 — 关键修复项

以下问题不会直接暴露给用户，但会在内部造成品牌不一致、维护隐患或功能故障。

### M1: IPC channel ID 仍为 `void-channel-*`

**位置**：`src/vs/code/electron-main/app.ts`

| 行号 | 代码片段 |
|------|---------|
| 1242 | `mainProcessElectronServer.registerChannel('void-channel-metrics', metricsChannel);` |
| 1245 | `mainProcessElectronServer.registerChannel('void-channel-update', voidUpdatesChannel);` |
| 1248 | `mainProcessElectronServer.registerChannel('void-channel-llmMessage', sendLLMMessageChannel);` |
| 1252 | `mainProcessElectronServer.registerChannel('void-channel-scm', voidSCMChannel);` |
| 1256 | `mainProcessElectronServer.registerChannel('void-channel-mcp', mcpChannel);` |

**消费端位置**：

| 文件 | 行号 | 代码片段 |
|------|------|---------|
| `common/metricsService.ts` | 34 | `mainProcessService.getChannel('void-channel-metrics')` |
| `common/statuzUpdateService.ts` | 33 | `mainProcessService.getChannel('void-channel-update')` |
| `common/sendLLMMessageService.ts` | 71 | `this.mainProcessService.getChannel('void-channel-llmMessage')` |
| `browser/statuzSCMService.ts` | 63 | `mainProcessService.getChannel('void-channel-scm')` |
| `common/mcpService.ts` | 87 | `this.mainProcessService.getChannel('void-channel-mcp')` |

**修复方向**：统一将主进程和渲染进程的 channel ID 更名为 `statuz-channel-*`，确保字符串完全一致。

---

### M2: `.voidrules` 重命名未完成

**位置**：`src/vs/workbench/contrib/statuz/browser/convertToLLMMessageService.ts:549`

```typescript
private _getVoidRulesFileContents(): string {
    // ...
    const uri = URI.joinPath(folder.uri, '.voidrules')
}
```

**附加位置**：
- `browser/react/src/statuz-settings-tsx/Settings.tsx:1499`：提示文本 `.voidrules`
- `browser/react/src/sidebar-tsx/SidebarChat.tsx:3100`：建议按钮文本 `Create a .voidrules file for me`

**修复方向**：
1. 将文件名从 `.voidrules` 改为 `.statuzrules`。
2. 重命名方法 `_getVoidRulesFileContents` → `_getStatuzRulesFileContents`。
3. 更新 React UI 中的所有提示文本。
4. 评估是否需要向后兼容逻辑（读取 `.voidrules` 作为 fallback）。

---

### M3: `product.ts` 残留 `voidVersion` 字段

**位置**：`src/vs/base/common/product.ts:60`

```typescript
readonly voidVersion?: string;
```

**消费端**：`src/vs/workbench/contrib/statuz/electron-main/metricsMainService.ts:102,110`

```typescript
const { commit, version, voidVersion, release, quality } = this._productService
// ...
voidVersion: voidVersion,
```

**修复方向**：
1. 将 `voidVersion` 重命名为 `statuzVersion`。
2. 同步更新 `metricsMainService.ts` 中的字段引用。
3. 检查 `product.json` 中是否仍有 `voidVersion` 字段并同步更新。

---

### M4: `src2/` 本地残留 Void 品牌文件名

**说明**：`browser/react/.gitignore` 已排除 `src2/` 和 `out/`，但本地 `src2/` 目录中仍存在旧生成文件，文件名包含 "Void"。

**位置**：`src/vs/workbench/contrib/statuz/browser/react/src2/`

**残留文件**：
- `src2/statuz-editor-widgets-tsx/VoidCommandBar.tsx`
- `src2/statuz-editor-widgets-tsx/VoidSelectionHelper.tsx`
- `src2/statuz-onboarding/VoidOnboarding.tsx`
- `src2/statuz-tooltip/VoidTooltip.tsx`

**影响**：`tsup.config.js` 的入口点引用 `./src2/...`，旧文件可能导致构建污染或混淆。

**修复方向**：
1. 删除 `src2/` 和 `out/` 目录。
2. 重新执行 `node build.js`，确保生成结果与当前 `src/` 完全一致。
3. 验证新生成的 `src2/` 中不再包含 "Void" 文件名。

---

### M5: Engine stub 存在编译隐患

**位置**：`src/vs/workbench/contrib/statuz/common/engine/statuzEngineService.ts:143-159`

```typescript
private async _callEngine<T>(method: StatuzEngineMethod, args: unknown[]): Promise<T> {
    // TODO: Uncomment when native module is integrated in Phase 1 Milestone 1.4
    // const channel = this._mainProcessService.getChannel(STATUZ_ENGINE_CHANNEL_NAME);
    // ...
    throw new Error(`${STUB_ERROR_MESSAGE} (method: ${method})`);
}
```

**问题**：注释掉的代码引用 `this._mainProcessService`，但构造函数仅注入 `ILogService`：

```typescript
constructor(
    @ILogService private readonly _logService: ILogService,
) { ... }
```

**影响**：取消注释后将产生 TypeScript 编译错误（`Property '_mainProcessService' does not exist`）。

**修复方向**：
1. 补全构造函数注入 `IMainProcessService`，或
2. 移除已注释的死代码，待需要时重新实现。

---

## P1 — 卫生项

以下问题不会直接影响品牌识别，但属于代码质量缺陷，应在常规开发中逐步清理。

### `as any` 类型安全问题

**位置**：`src/vs/workbench/contrib/statuz/common/statuzSettingsService.ts:314`

```typescript
readS.settingsOfProvider[providerName] = {
    ...defaultSettingsOfProvider[providerName],
    ...readS.settingsOfProvider[providerName],
} as any
```

**位置**：`src/vs/workbench/contrib/statuz/browser/chatThreadService.ts`

| 行号 | 代码片段 |
|------|---------|
| 678 | `const { result, interruptTool } = await this._toolsService.callTool[toolName](toolParams as any)` |
| 712 | `toolResultStr = this._toolsService.stringOfResult[toolName](toolParams as any, toolResult as any)` |

**位置**：`src/vs/workbench/contrib/statuz/browser/react/src/statuz-settings-tsx/Settings.tsx`

| 行号 | 代码片段 |
|------|---------|
| 1107 | `chatThreadsService.dangerousSetState(json as any)` |
| 1110 | `voidSettingsService.dangerousSetState(json as any)` |

**修复方向**：为动态工具调用和 settings merge 补充正确的 TypeScript 类型定义，逐步消除 `as any`。

---

### `console.log` 残留

**位置**：`src/vs/workbench/contrib/statuz/electron-main/metricsMainService.ts`

| 行号 | 代码片段 |
|------|---------|
| 128 | `console.log('User is opted out of basic Void metrics?', didOptOut)` |
| 138 | `console.log('Void posthog metrics info:', JSON.stringify(identifyMessage, null, 2))` |

**修复方向**：将 `console.log` 替换为 `ILogService` 的适当日志级别调用，或删除生产路径中的调试输出。

---

### 错误的支持链接

**位置**：`src/vs/workbench/contrib/statuz/browser/editCodeService.ts:293`

```typescript
source: details ? `... feel free to [report](https://github.com/voideditor/void/issues/new) it.` : undefined
```

**说明**：该代码当前被注释，但若未来取消注释，链接仍指向 Void Editor 的 issue 页面。

**修复方向**：将链接更新为 Statuz IDE 的支持地址。

---

### 拼写错误 `VoidCheckUpdateRespose`

**位置**：`src/vs/workbench/contrib/statuz/common/statuzUpdateServiceTypes.ts:6`

```typescript
export type VoidCheckUpdateRespose = { ... }
```

**修复方向**：重命名为 `StatuzCheckUpdateResponse`（同时修复品牌名和拼写：Respose → Response）。

---

### 内部变量名残留 `voidSettingsService` / `voidCommandBarService` / `voidSCM`

**位置**：`src/vs/workbench/contrib/statuz/browser/statuzSCMService.ts:55,63`

```typescript
@IStatuzSettingsService private readonly voidSettingsService: IStatuzSettingsService,
// ...
this.voidSCM = ProxyChannel.toService<IStatuzSCMService>(mainProcessService.getChannel('void-channel-scm'))
```

**位置**：`src/vs/workbench/contrib/statuz/browser/react/src/util/services.tsx:101,106`

```typescript
voidCommandBarService: accessor.get(IStatuzCommandBarService),
// ...
const { ..., voidCommandBarService, ... } = stateServices
```

**位置**：`src/vs/workbench/contrib/statuz/common/mcpService.ts:84,87`

```typescript
@IStatuzSettingsService private readonly voidSettingsService: IStatuzSettingsService,
// ...
this.channel = this.mainProcessService.getChannel('void-channel-mcp')
```

**修复方向**：将内部变量名中的 `void` 前缀替换为 `statuz` 前缀，保持与接口名一致。

---

## 验证状态

| 检查项 | 状态 | 方法 |
|--------|------|------|
| C1 自动更新 endpoint | 已验证 | `Read` 读取 `statuzUpdateMainService.ts:98` |
| C2 Action IDs | 已验证 | `Read` 读取 `actionIDs.ts` 和 `sidebarActions.ts` |
| C2 ViewContainer ID | 已验证 | `Read` 读取 `sidebarPane.ts:104` |
| C2 UI 字符串 | 已验证 | `Grep` 搜索 `Void` 关键词，逐条读取对应文件 |
| M1 IPC channel IDs | 已验证 | `Read` 读取 `app.ts:1242-1256` 及消费端 |
| M2 `.voidrules` | 已验证 | `Read` 读取 `convertToLLMMessageService.ts:549` |
| M3 `voidVersion` | 已验证 | `Read` 读取 `product.ts:60` 和 `metricsMainService.ts:102` |
| M4 `src2/` 残留 | 已验证 | `Glob` 搜索 `src2/` 中 `Void*` 文件 |
| M5 Engine stub | 已验证 | `Read` 读取 `statuzEngineService.ts:125,143` |
| P1 `as any` | 已验证 | `Grep` 搜索 `as any` 并读取对应位置 |
| P1 `console.log` | 已验证 | `Read` 读取 `metricsMainService.ts:128,138` |
| P1 拼写错误 | 已验证 | `Read` 读取 `statuzUpdateServiceTypes.ts:6` |
