/**
 * Centralized data-testid registry.
 * All test locators MUST use TID.xxx — no hardcoded strings in specs.
 * (PLANET-1423)
 */
export const TID = {
  // Top bar
  topBar: 'top-bar',
  tenantSwitcher: 'tenant-switcher',

  // App selector bar
  appSelector: 'app-selector',
  newAppBtn: 'new-app-btn',
  templateEcommerceBtn: 'template-ecommerce-btn',

  // Chat
  chatInput: 'chat-input',
  chatSendBtn: 'chat-send-btn',
  chatMessage: (idx: number) => `chat-message-${idx}`,

  // Canvas
  canvasPane: 'canvas-pane',
  canvasNode: (id: string) => `canvas-node-${id}`,
  canvasNodeRunBtn: (id: string) => `canvas-node-${id}-run-btn`,
  canvasNodeStatus: (id: string, status: string) => `canvas-node-${id}-status-${status}`,

  // Tabs
  tabComponentDetail: 'tab-component-detail',
  tabFlowGraph: 'tab-flow-graph',

  // Detail panel
  detailMetaName: 'detail-meta-name',
  detailProbeStep: (nodeName: string) => `detail-probe-step-${nodeName}`,
  detailResultJson: 'detail-result-json',
  detailFullstackPreview: 'detail-fullstack-preview',

  // Module list
  moduleListDrawerToggle: 'module-list-drawer-toggle',
  moduleListRow: (id: string) => `module-list-row-${id}`,
  moduleListStatus: (id: string) => `module-list-status-${id}`,
} as const;
