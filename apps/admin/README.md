# @peopleclaw/admin

PeopleClaw admin SPA: Vite + React 19 + React Router 7 + Tailwind v4 + shadcn/ui.
Backend: Express + Prisma + Turso (libSQL). Auth: Logto SSO.

## Routes
| Path | Description |
|------|-------------|
| `/` | Public landing / sign-in entry |
| `/signin` → `/callback` | Logto OIDC flow |
| `/dashboard` | Authenticated home |
| `/workflows` | Workflow editor (React Flow canvas, sidebar of all workflows) |
| `/workflows/:id` | Specific workflow loaded in the editor |
| `/cases` | All cases list |
| `/cases/:id` | Single case detail (P3 placeholder) |

## Stack
- UI primitives: shadcn/ui (Radix + Tailwind v4). No DaisyUI.
- Workflow canvas: `@xyflow/react` 12.x
- State: local component state + `localStorage` (`peopleclaw-workflows`) — server persistence is P5.

## data-testid Convention (for Playwright e2e)

| Element                   | Pattern                                    |
|---------------------------|--------------------------------------------|
| Sidebar workflow item     | `sidebar-workflow-{workflowId}`            |
| Sidebar category          | `sidebar-category-{categoryName}`          |
| Sidebar search input      | `sidebar-search`                           |
| Step node (React Flow)    | `step-node-{stepId}`                       |
| Step status indicator     | `step-status-{stepId}`                     |
| Step subflow toggle       | `step-action-toggle-{stepId}`              |
| Subflow group container   | `subflow-group-{label}`                    |
| Subflow collapse button   | `subflow-collapse`                         |
| Add step button           | `add-step-button`                          |
| Add step modal            | `add-step-modal`                           |
| Step type option          | `step-type-{type}`                         |
| Detail panel container    | `detail-panel`                             |
| Detail panel field        | `step-detail-{fieldName}` (e.g. `step-detail-name`, `step-detail-assignee`, `step-detail-description`, `step-detail-estimatedTime`, `step-detail-type`) |
| Save / Cancel / Delete    | `action-save` / `action-cancel` / `action-delete` |
| Tab                       | `tab-{name}` (`tab-workflow`, `tab-cases`) |
| Cases table / grid        | `cases-table`                              |
| Case row                  | `case-row-{caseId}`                        |
| Case banner (in canvas)   | `case-banner`                              |
| Case detail page          | `case-detail-{caseId}`                     |
| Top-nav workflows link    | `nav-workflows`                            |
| Top-nav cases link        | `nav-cases`                                |

## Build
```
pnpm --filter @peopleclaw/admin build
```
Outputs SPA to `dist/` and Express server to `api-dist/`.

## Dev
```
pnpm --filter @peopleclaw/admin dev
```
