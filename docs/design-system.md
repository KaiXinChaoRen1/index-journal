# 设计系统：Claude 风格模仿指南

本项目 UI 风格模仿 Claude 官方界面（claude.ai）。以下是已实现和待改进的设计规范。

## 核心特征

### 色彩系统

| 角色 | 值 | 用途 |
|------|-----|------|
| `--bg` | `#f4efe6` | 页面主背景 |
| `--bg-accent` | `#ded3c1` | 强调背景 |
| `--surface` | `rgba(255, 250, 242, 0.86)` | 卡片/浮层背景（毛玻璃） |
| `--surface-strong` | `#fffaf2` | 强背景色 |
| `--text` | `#241d16` | 主文本（深褐黑） |
| `--muted` | `#746655` | 次要文本（暖灰褐） |
| `--positive` | `#0b7a43` | 正向/成功（深绿） |
| `--negative` | `#a43c24` | 负向/错误（砖红） |
| `--border` | `rgba(58, 46, 32, 0.14)` | 边框（低对比度） |

**背景渐变**：
```css
background:
  radial-gradient(circle at top left, rgba(186, 149, 92, 0.22), transparent 28%),
  linear-gradient(160deg, var(--bg), #f7f2eb 42%, #e9dfd0 100%);
```

### 排版

- **主字体**：`Georgia, "Times New Roman", serif` - 衬线字体营造温暖人文感
- **标签/小字**：大写 + 宽字间距 (`letter-spacing: 0.08em~0.18em`)
- **标题尺寸**：使用 `clamp()` 实现响应式，如 `clamp(2.6rem, 5vw, 4.8rem)`

### 形状语言

| 元素 | 圆角 | 说明 |
|------|------|------|
| 大卡片 | `28px` | 主要信息容器 |
| 中等卡片 | `24px` | 次级容器、菜单浮层 |
| 小卡片/输入框 | `18px~20px` | 内部模块 |
| 按钮/标签 | `999px` | Pill 形状，完全圆角 |
| 小按钮 | `10px~14px` | 紧凑操作 |

### 阴影系统

```css
--shadow: 0 24px 60px rgba(49, 38, 23, 0.12);
/* 悬停时加深 */
box-shadow: 0 16px 34px rgba(49, 38, 23, 0.14);
```

### 毛玻璃效果

所有浮层/卡片使用统一毛玻璃：
```css
backdrop-filter: blur(18px);
background: var(--surface);
border: 1px solid var(--border);
box-shadow: var(--shadow);
```

### 动效规范

**过渡时长**：`180ms ease` - 快速响应
**入场动画**：
```css
@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* 使用: animation: rise-in 560ms ease both; */
/* 错开: nth-child(2) { animation-delay: 90ms; } */
```

**悬停效果**：
- 按钮：轻微上浮 `translateY(-1px)` + 阴影加深
- 链接：右移 `translateX(2px)` + 背景变化

## 可改进之处（更像 Claude 官方）

### 1. 字体系统

**当前**：统一使用衬线字体

**建议改进**：
- 标题保持衬线字体（Georgia）
- 正文使用无衬线字体（Inter / system-ui）提高可读性
- 代码/数据使用等宽字体（Monaco / Menlo）

```css
/* 建议添加 */
--font-serif: Georgia, "Times New Roman", serif;
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: "SF Mono", Monaco, "Cascadia Code", monospace;

body {
  font-family: var(--font-sans);
}

h1, h2, h3, .hero {
  font-family: var(--font-serif);
}
```

### 2. 色彩微调

**当前**：偏黄褐色

**建议改进**：
- 向更中性的 beige 调整，减少黄色成分
- 参考 Claude：更偏灰的暖色

```css
/* 建议调整 */
--bg: #f5f1eb;        /* 更中性 */
--surface: rgba(255, 253, 248, 0.9);
--text: #1a1612;      /* 更深，偏冷 */
--muted: #6b6259;     /* 更灰 */
```

### 3. 间距系统

**当前**：较为随意

**建议**：建立 4px 基线系统

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

### 4. 交互反馈

**当前**：简单的悬停效果

**建议添加**：

```css
/* 点击涟漪效果 */
.button:active {
  transform: scale(0.98);
}

/* 焦点环 */
:focus-visible {
  outline: 2px solid rgba(47, 104, 64, 0.3);
  outline-offset: 2px;
}

/* 加载骨架屏 */
.skeleton {
  background: linear-gradient(90deg, var(--surface) 25%, #e8e0d5 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### 5. 微细节

**分隔线**：使用 `dashed` 而非 `solid`，更柔和
```css
border-bottom: 1px dashed rgba(58, 46, 32, 0.12);
```

**大写字母标签**：
```css
.label {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
```

**链接样式**：
```css
a {
  text-decoration: underline;
  text-underline-offset: 0.18em;
  text-decoration-thickness: 1px;
}
```

### 6. 响应式断点

**当前**：单一断点 `900px`

**建议**：
```css
/* 移动端优先 */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

### 7. 组件一致性

**按钮层级**：
- 主按钮：深色背景 + 浅色文字
- 次按钮：浅色背景 + 边框
- 幽灵按钮：无边框，仅文字

**输入框**：
- 聚焦时绿色光晕
- 占位符使用 `--muted`

## 参考检查清单

添加新组件时检查：

- [ ] 使用 CSS 变量而非硬编码颜色
- [ ] 圆角符合形状系统（28px/24px/20px/999px）
- [ ] 添加 `backdrop-filter: blur(18px)`（如果是浮层）
- [ ] 阴影使用 `--shadow` 变量
- [ ] 过渡使用 `180ms ease`
- [ ] 标签文字使用大写 + 宽字间距
- [ ] 响应式考虑（移动端优先）
- [ ] 焦点状态可见

## 参考资源

- Claude 官方：https://claude.ai
- 设计风格：Warm minimalism, Organic modernism
- 关键词：Cream, Beige, Serif, Glassmorphism, Soft shadows
