# CSS 变量系统定义

> **位置**：`src/vs/workbench/contrib/statuz/browser/react/src/styles.css`
>
> Statuz 使用 CSS 自定义属性映射到 VS Code 的主题变量，确保与当前主题无缝融合。

## 背景色

| 变量 | VS Code 源变量 | 用途 |
|------|----------------|------|
| `--statuz-bg-1` | `--vscode-input-background` | 输入框背景 |
| `--statuz-bg-1-alt` | `--vscode-badge-background` | Badge 背景 |
| `--statuz-bg-2` | `--vscode-sideBar-background` | Sidebar 主背景 |
| `--statuz-bg-2-alt` | `color-mix(in srgb, var(--vscode-editor-background) 30%, var(--vscode-sideBar-background) 70%)` | Sidebar 交替背景 |
| `--statuz-bg-2-hover` | `color-mix(in srgb, var(--vscode-editor-foreground) 2%, var(--vscode-sideBar-background) 98%)` | Sidebar hover 背景 |
| `--statuz-bg-3` | `--vscode-editor-background` | 编辑器背景 |

## 前景色

| 变量 | VS Code 源变量 | 用途 |
|------|----------------|------|
| `--statuz-fg-0` | `color-mix(in srgb, var(--vscode-tab-activeForeground) 90%, black 10%)` | 主标题文字 |
| `--statuz-fg-1` | `--vscode-editor-foreground` | 主内容文字 |
| `--statuz-fg-2` | `--vscode-input-foreground` | 输入框文字 |
| `--statuz-fg-3` | `--vscode-input-placeholderForeground` | 占位符文字 |
| `--statuz-fg-4` | `--vscode-list-deemphasizedForeground` | 弱化文字 |

## 边框与强调色

| 变量 | 值 / 源变量 | 用途 |
|------|-------------|------|
| `--statuz-border-1` | `--vscode-commandCenter-activeBorder` | 活跃边框 |
| `--statuz-border-2` | `--vscode-commandCenter-border` | 普通边框 |
| `--statuz-border-3` | `--vscode-commandCenter-inactiveBorder` | 非活跃边框 |
| `--statuz-border-4` | `--vscode-editorGroup-border` | 编辑器组边框 |
| `--statuz-ring-color` | `#007FD4` | Focus ring 颜色 |
| `--statuz-link-color` | `#007FD4` | 链接颜色 |
| `--statuz-warning` | `--vscode-charts-yellow` | 警告色 |

## Tailwind 作用域

所有 Tailwind 类名在构建时被 `scope-tailwind` 添加 `statuz-` 前缀，避免与 VS Code 的内置样式冲突。React 组件的根元素使用 `@@statuz-scope` 类名（构建后替换为 `statuz-scope`）来激活作用域。

示例：
- `w-full` → `statuz-w-full`
- `bg-blue-500` → `statuz-bg-blue-500`
- `text-sm` → `statuz-text-sm`
