# PeopleClaw 前端架构文档

> 陛下 2026-04-25 要求梳理。本文档是前端架构的 Source of Truth，任何重写/重构以此为准。
> Last updated: 2026-04-25

---

## 一、现状诊断

### 1.1 文件结构（前端 client，7660 行）

```
apps/admin/src/client/
├── main.tsx                    # 路由 + 全局 Provider（ThemeProvider / BrowserRouter / Toaster）
├── components/
│   ├── AppLayout.tsx           # AppTopBar + <Outlet />
│   ├── AppTopBar.tsx           # 全局导航条（我的/工作流/模板库/设置 → Dialog）
│   ├── ErrorBoundary.tsx       # 错误边界（路由级 + CasesPanel 级）
│   ├── DashboardDialog.tsx     # 仪表盘弹窗
│   ├── SettingsDialog.tsx      # 设置弹窗
│   ├── TemplateLibraryDialog.tsx # 模板库弹窗
│   ├── ui/                     # shadcn/ui 组件（Radix 封装）
│   └── workflow/
│       ├── WorkflowEditor.tsx  # 770L — 编辑器容器（画布 + 右侧面板）
│       ├── CasesPanel.tsx      # 770L — 💩 案例列表 + CRUD + 弹窗 + 批量选择
│       ├── CasePayloadDialog   # 204L — 属性编辑浮层（已脱离 Radix）
│       ├── CaseStepsDialog     # 158L — 步骤记录浮层
│       ├── Canvas.tsx          # 323L — ReactFlow 画布
│       ├── Sidebar.tsx         # 514L — 左侧工作流列表 + 步骤模板
│       ├── PropertiesPanel.tsx # 404L — 节点属性编辑
│       ├── RunsPanel.tsx       # 210L — 运行历史
│       └── nodes/StepNode.tsx  # 176L — 自定义 ReactFlow 节点
├── pages/
│   ├── Workflows.tsx           # 518L — 工作流页面（列表 + 路由 + CRUD Dialog）
│   ├── Cases.tsx               # 482L — 独立案例页面（未使用？）
│   ├── Dashboard.tsx           # 246L
│   ├── Settings.tsx            # 98L + sub-pages
│   └── ...
├── types/index.ts              # 类型定义（⚠️ Case 类型过时）
└── lib/
    ├── api.ts                  # apiClient 封装
    └── logto.ts                # Logto SDK
```

### 1.2 核心问题

| # | 问题 | 影响 |
|---|------|------|
| **P1** | **CasesPanel 是 God Component** (770L) | 列表渲染 / CRUD / 弹窗状态 / 批量选择 / 过滤排序 / 下拉菜单 全在一个文件。改一处牵全身。 |
| **P2** | **Radix Portal 炸弹** | CasesPanel 每行一个 `DropdownMenu`（Portal 渲染到 body），state 刷新时 Portal 节点与表格 DOM 冲突 → React `insertBefore` crash。今天打了 16 个补丁没治好。 |
| **P3** | **无 Data Layer** | 每个组件自己调 `apiClient.get/post`，无 cache、无乐观更新、多处 `setCases` 竞态。 |
| **P4** | **类型定义与后端脱节** | `types/index.ts` 的 `Case` interface status 是 `active|completed|paused`，后端实际是 `running|waiting_review|done|failed|...` |
| **P5** | **Workflows.tsx 也过重** (518L) | 混着 Radix Dialog / AlertDialog / Tooltip + 路由逻辑 + CRUD，同类 Portal 问题潜伏 |
| **P6** | **sonner (toast) Portal 冲突** | `<Toaster>` 在全局 main.tsx，任何 toast 调用都走 Portal，与表格刷新竞态 |

### 1.3 数据流（现状）

```
                    Workflows.tsx (fetch workflows)
                         │
              ┌──────────┴──────────┐
              │                     │
         Sidebar.tsx          WorkflowEditor.tsx
         (workflows list)     (selected workflow)
                              ┌────────┬────────┐
                              │        │        │
                          Canvas   CasesPanel  PropertiesPanel
                          (画布)   (fetch cases   (编辑节点属性)
                                   自己调 API)
```

**问题**: CasesPanel 自己 fetch + 管理 cases state，和 Workflows.tsx 里的 workflows state 独立。没有共享的 data layer。

---

## 二、后端架构（已基本合理）

### 2.1 执行引擎

```
executor.ts
├── parseDef()        — 解析 workflow definition JSON → { nodes[], edges[] }
├── advanceCase()     — 推进 case 一步（auto 节点跑 handler → waiting_review）
├── submitHumanStep() — 人工节点提交产物 → 继续推进
└── listCaseSteps()   — 列出 case 的执行记录

handlers/
├── index.ts          — handler registry（dispatch key → handler fn）
├── publishShopify.ts — 💰 真实上架 Shopify（用 case payload 字段）
├── aiGenerateTitle.ts
├── aiImageGenerate.ts
├── aiDescription.ts
├── aiGenerateSkus.ts
└── shopify*.ts, generic*.ts, ai*.ts
```

### 2.2 API 路由

| Endpoint | 用途 |
|----------|------|
| `POST /api/cases` | 创建 case（带 default payload） |
| `GET /api/cases?workflowId=` | 列出 workflow 的 cases |
| `GET /api/cases/:id` | 获取单个 case |
| `DELETE /api/cases/:id` | 删除 case |
| `PATCH /api/cases/:id/payload` | 更新 case payload |
| `POST /api/cases/:id/advance` | 执行一步（内部用） |
| `POST /api/cases/:id/continue` | 从 waiting_review 继续 |
| `POST /api/cases/:id/run-ai` | 重跑当前步 AI handler |
| `GET /api/workflows` | 列出 workflows |
| `PUT /api/workflows/:id` | 更新 workflow definition |

### 2.3 数据模型（Prisma + Turso/SQLite）

```
Tenant → Workflow → Case → CaseStep
                           ├── status: running|waiting_review|waiting_human|done|failed|cancelled|awaiting_fix
                           ├── payload: JSON (累积型数据对象)
                           ├── currentStepId
                           └── batchId (批次导入)
```

**后端基本没问题。问题全在前端。**

---

## 三、目标架构

### 3.1 设计原则

1. **零 Portal 在动态列表中** — 列表行内不允许 Radix Portal 组件（DropdownMenu / Tooltip / Popover）。用 `position: absolute` 的 non-portal 替代。
2. **Data Hook 单一数据源** — 每类数据一个 hook（`useCases`、`useWorkflows`），内部管 fetch / cache / 乐观更新。组件只消费。
3. **组件拆到 < 200 行** — 超过 200 行必须拆。
4. **类型与后端对齐** — 前端 interface 从 Prisma schema 推导，不自己编。
5. **Toast 安全使用** — 只在不触发列表重渲染的操作中用 toast（如设置保存、连接配置）。列表操作用 inline 状态反馈。

### 3.2 文件结构（目标）

```
apps/admin/src/client/
├── main.tsx
├── hooks/
│   ├── useCases.ts            # 案例数据 hook（fetch/create/delete/continue/runAi/batch）
│   ├── useWorkflows.ts        # 工作流数据 hook
│   └── useStepTemplates.ts    # 步骤模板数据 hook
├── components/
│   ├── AppLayout.tsx
│   ├── AppTopBar.tsx
│   ├── ErrorBoundary.tsx
│   ├── ui/                    # shadcn/ui（保留，但列表场景不用 Portal 组件）
│   ├── common/
│   │   ├── InlineMenu.tsx     # 非 Portal 下拉菜单（position:absolute）
│   │   ├── InlineConfirm.tsx  # 非 Portal 确认弹窗
│   │   └── StatusBadge.tsx    # 状态徽章
│   └── workflow/
│       ├── WorkflowEditor.tsx # ~300L — 只管布局和面板切换
│       ├── Canvas.tsx         # ~300L — ReactFlow 画布
│       ├── cases/
│       │   ├── CasesPanel.tsx     # ~150L — 容器（连接 hook + 布局）
│       │   ├── CasesTable.tsx     # ~200L — 表格渲染
│       │   ├── CaseRow.tsx        # ~100L — 单行 + InlineMenu
│       │   ├── CaseFilters.tsx    # ~80L  — 过滤标签
│       │   ├── CaseBatchBar.tsx   # ~60L  — 批量操作栏
│       │   ├── CasePayloadEditor.tsx  # ~200L — 属性编辑（内联或浮层）
│       │   └── CaseStepsViewer.tsx    # ~150L — 步骤记录
│       ├── Sidebar.tsx        # ~300L — 拆掉模板拖拽逻辑
│       ├── PropertiesPanel.tsx # ~300L
│       └── nodes/StepNode.tsx # ~150L
├── pages/
│   ├── Workflows.tsx          # ~200L — 只管路由和顶层状态
│   └── ...
└── types/
    ├── case.ts                # CaseRecord / CaseStepRecord（对齐 Prisma）
    ├── workflow.ts            # Workflow / WorkflowStep
    └── index.ts               # re-export
```

### 3.3 数据流（目标）

```
                     useWorkflows() ────────────────────────┐
                          │                                 │
                Workflows.tsx (消费 workflows)              │
                    ┌─────┴──────┐                         │
                    │            │                          │
              Sidebar       WorkflowEditor                 │
                            ┌───┬───┬───┐                  │
                            │   │   │   │                  │
                        Canvas │ Props  │                  │
                               │       │                  │
                          CasesPanel ←── useCases(workflowId)
                          ┌────┬─────┐
                          │    │     │
                      Filters Table BatchBar
                               │
                            CaseRow ← InlineMenu (no Portal)
```

**关键**: `useCases(workflowId)` 是唯一的案例数据源。所有 CRUD 操作在 hook 内完成，组件只调 hook 返回的方法。

### 3.4 useCases hook 设计

```typescript
interface UseCasesReturn {
  cases: CaseRecord[];
  loading: boolean;
  error: string | null;
  
  // 选择
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // CRUD（全部乐观更新）
  createCase: (title: string) => Promise<CaseRecord>;
  deleteCase: (id: string) => Promise<void>;
  deleteBatch: (ids: string[]) => Promise<void>;
  
  // 执行
  continueCase: (id: string) => Promise<void>;
  continueBatch: (ids: string[]) => Promise<void>;
  runAi: (id: string) => Promise<void>;
  
  // Payload
  updatePayload: (id: string, fields: Record<string, unknown>) => Promise<void>;
  
  // 刷新
  refresh: () => Promise<void>;
}

function useCases(workflowId: string | null): UseCasesReturn { ... }
```

### 3.5 InlineMenu 设计（替代 Radix DropdownMenu）

```typescript
// 关键: 不用 Portal。用 position:absolute 相对于 trigger 定位。
// 用 click-outside 关闭。用 z-index 叠在表格上方。
// 不依赖 Radix，不注入 body，不与 React reconciliation 冲突。
```

---

## 四、执行引擎现状 & 改进点

### 4.1 现状（基本合理）

- `advanceCase()` 已实现 PLANET-1260 单步执行 + `waiting_review` 暂停
- Handler registry 完整（AI handlers 有 placeholder，Shopify publish 真实可用）
- `parseDef()` 能处理 steps[] → nodes[] 合并

### 4.2 遗留问题

| # | 问题 | 影响 |
|---|------|------|
| E1 | `workflowRun.ts` SSE endpoint 还在 — 创建空 case 空跑全部步骤 | 上架垃圾商品。应该废弃或重定向到 case-based 流程 |
| E2 | Shopify publish 用 case payload 字段但 AI handler 可能覆盖用户填的值 | 用户填了 product_name，AI handler 也写 product_name → 覆盖 |
| E3 | 没有 dry-run 模式 | 用户测试流程必须真上架 |

### 4.3 Shopify 上架数据流（S1 场景核心路径）

```
用户创建 case → 填 payload {product_name, price, stock, image_url, description, category}
     │
     ▼ advanceCase() step 1: ai.generate_title
     │  → AI 生成标题 → 写入 payload.generated_title
     │  → 暂停 waiting_review
     │
     ▼ continue → step 2: ai.image_generate
     │  → AI 生成图片 → 写入 payload.generated_image_url
     │  → 暂停 waiting_review
     │
     ▼ continue → step 3: ai.product_description
     │  → AI 生成描述 → 写入 payload.generated_description
     │  → 暂停 waiting_review
     │
     ▼ continue → step 4: ai.generate_skus
     │  → AI 生成 SKU → 写入 payload.generated_skus
     │  → 暂停 waiting_review
     │
     ▼ continue → step 5: shopify.update_inventory
     │  → ??? (库存管理，可能不需要在新流程)
     │  → 暂停 waiting_review
     │
     ▼ continue → step 6: publish_shopify
     │  → 读取 payload.product_name / price / stock / image_url / description / category
     │  → 调用 Shopify Admin API 创建商品
     │  → 写入 payload.productPublicUrl / productAdminUrl
     │  → case 完成 (done)
```

**问题**: publish_shopify 读的是 `payload.product_name` / `payload.description` 等**原始字段**。但中间 AI 步骤写的是 `payload.generated_title` / `payload.generated_description` 等**不同字段名**。两者没有合并逻辑。

**修复方向**: AI handler 应该**覆盖同名字段**（如果用户想用 AI 结果），或者 publish_shopify 应该**优先取 generated_* 字段**，fall back 到原始字段。

---

## 五、执行路线

### Phase 0: 稳定当前版本（紧急，1-2h）
- [ ] 废弃 `workflowRun.ts` SSE endpoint（或重定向到 case-based）
- [ ] CasesPanel 里的 DropdownMenu 换成 non-portal 方案（不自建组件——用 Radix 的 `modal={false}` + 自定义 container，或用 headlessui `Menu`）
- [ ] 验证保存/创建/继续操作不再崩溃

### Phase 1: 数据层（3-4h）
- [ ] 创建 `hooks/useCases.ts`
- [ ] 所有 case 操作从 CasesPanel 移入 hook
- [ ] 乐观更新

### Phase 2: 组件拆分（3-4h）  
- [ ] CasesPanel → cases/ 目录（6 个文件）
- [ ] WorkflowEditor 瘦身
- [ ] Workflows.tsx 瘦身

### Phase 3: 类型对齐（1h）
- [ ] 新建 `types/case.ts` 和 `types/workflow.ts`
- [ ] 全局替换

### Phase 4: 引擎修复（2-3h）
- [ ] 废弃 SSE endpoint
- [ ] AI handler 输出字段名对齐 publish_shopify 期望
- [ ] 测试完整 S1 路径（创建 case → 填属性 → 6 步执行 → Shopify 真实上架正确商品）

---

## 六、决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-04-25 | 不自建 UI 组件库 | 陛下指示 |
| 2026-04-25 | 移除 5s polling | 与 Radix Portal 冲突是崩溃根因 |
| 2026-04-25 | CasePayloadDialog 脱离 Radix | 减少 Portal 冲突面 |
| 2026-04-25 | ErrorBoundary 拆到路由级 | 崩溃不影响导航条 |
