# 排错指南

> **文档性质**：本文档记录 Statuz IDE 开发和运行中可能遇到的常见问题及解决方案。所有错误示例中的 ID 和字符串与当前代码实际状态一致。

---

## 构建错误

### ViewContainer 'workbench.view.void' already exists

**原因**：ViewContainer ID 冲突。当前代码中 `STATUZ_VIEW_CONTAINER_ID = 'workbench.view.void'`（`sidebarPane.ts:104`），是品牌残留。

**解决**：确保 `sidebarPane.ts` 中 `STATUZ_VIEW_CONTAINER_ID` 的值唯一。若需重命名，需同步更新所有引用处（包括 keybindings、menus、view container 注册）。

### Cannot find module '@xyflow/react'

**原因**：依赖缺失。`@xyflow/react` 尚未添加到 `browser/react/package.json`。

**解决**：
```bash
cd src/vs/workbench/contrib/statuz/browser/react
npm install @xyflow/react @dagrejs/dagre
```

### scope-tailwind 未生成 src2/

**原因**：首次构建时 `src2/` 目录不存在。

**解决**：手动执行一次构建：
```bash
cd src/vs/workbench/contrib/statuz/browser/react
node build.js
```

或在 watch 模式下，build.js 会自动检测并执行初始构建（`build.js:86-98`）。

### src2/ 中存在旧文件（如 VoidCommandBar.tsx）

**原因**：`src2/` 是生成的，但旧文件未被清理。`.gitignore` 已排除 `src2/`，但本地残留了之前的生成结果。

**解决**：
```bash
cd src/vs/workbench/contrib/statuz/browser/react
rm -rf src2/ out/
node build.js
```

---

## 运行时错误

### Sidebar 空白或 React 未挂载

**排查步骤**：
1. 检查 `browser/react/out/sidebar-tsx/index.js` 是否存在
2. 检查浏览器控制台是否有 React 错误
3. 检查 `sidebarPane.ts:83` 的 `mountSidebar` 是否成功返回 `dispose` 函数

### Action ID 冲突

当前 Action ID 仍以 `void.` 为前缀（如 `void.sidebar.open`、`void.ctrlLAction`）。若与其他扩展冲突，需重命名并同步更新：
- `browser/actionIDs.ts`
- `browser/sidebarActions.ts`
- `browser/sidebarPane.ts`
- VS Code 的 `keybindings` 和 `menus` contribution

### IPC channel 不匹配

当前 IPC channel ID 仍为 `void-channel-*`（如 `void-channel-metrics`、`void-channel-llmMessage`）。若主进程和渲染进程中的 channel 字符串不一致，会导致通信失败。

**关键位置**：
- 主进程注册：`src/vs/code/electron-main/app.ts:1242-1256`
- 渲染进程消费：`common/metricsService.ts:34`、`common/statuzUpdateService.ts:33`、`common/sendLLMMessageService.ts:71`、`browser/statuzSCMService.ts:63`、`common/mcpService.ts:87`

### 自动更新拉取 Void 二进制文件

**原因**：`statuzUpdateMainService.ts:98` 的 endpoint 仍为 `https://api.github.com/repos/voideditor/binaries/releases/latest`。

**解决**：在发布前必须将该 endpoint 更改为 Statuz 的二进制仓库地址。详见 `BRAND_DEBT.md` C1。

---

## 性能建议

### SidebarChat.tsx 体积过大

`browser/react/src/sidebar-tsx/SidebarChat.tsx` 约 14K 行，建议拆分为：
- `SidebarChatHeader.tsx`
- `SidebarChatMessages.tsx`
- `SidebarChatInput.tsx`
- `SidebarChatToolbar.tsx`

### 构建输出体积

当前构建输出总大小约 3.73 MB（7 个 ESM bundle）。可通过以下方式优化：
- 开启 `splitting: true`（当前为 `false`）
- 对不常用的组件使用动态导入
- 检查 `noExternal` 配置，排除不必要的 npm 依赖

### React 重渲染优化

`services.tsx` 中的全局发布-订阅模式在状态变更时会通知所有监听器。建议：
- 使用 `React.memo` 包裹纯展示组件
- 使用 `useMemo` 缓存计算结果
- 避免在 `useEffect` 中直接订阅 VS Code 服务事件（应通过 `services.tsx` 的监听器间接订阅）

---

*最后更新：基于代码库验证状态*
