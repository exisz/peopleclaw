import type { Case } from './types';

export const cases: Case[] = [
  // 跨境电商
  {
    id: 'c1', workflowId: 'ecommerce', name: '蓝牙耳机TWS-X1上新', status: 'active', currentStepId: 'e8', startedAt: '2026-03-20',
    stepStatuses: { e0: 'done', e1: 'done', e2: 'done', e3: 'done', e4: 'done', e5: 'done', e6: 'done', e7: 'done', e8: 'in-progress', e9: 'pending', e10: 'pending', e11: 'pending', e12: 'pending' },
  },
  {
    id: 'c2', workflowId: 'ecommerce', name: '瑜伽垫新款选品', status: 'active', currentStepId: 'e3', startedAt: '2026-04-01',
    stepStatuses: { e0: 'done', e1: 'done', e2: 'done', e3: 'in-progress', e4: 'pending', e5: 'pending', e6: 'pending', e7: 'pending', e8: 'pending', e9: 'pending', e10: 'pending', e11: 'pending', e12: 'pending' },
  },
  {
    id: 'c3', workflowId: 'ecommerce', name: '智能手表第三批', status: 'completed', currentStepId: 'e12', startedAt: '2026-02-15',
    stepStatuses: { e0: 'done', e1: 'done', e2: 'done', e3: 'done', e4: 'done', e5: 'done', e6: 'done', e7: 'done', e8: 'done', e9: 'done', e10: 'done', e11: 'done', e12: 'done' },
  },
  // 社交媒体
  {
    id: 'c4', workflowId: 'social-media', name: '4月春季促销Campaign', status: 'active', currentStepId: 's5', startedAt: '2026-04-01',
    stepStatuses: { s0: 'done', s1: 'done', s2: 'done', s3: 'done', s4: 'done', s5: 'in-progress', s6: 'pending', s7: 'pending', s8: 'pending' },
  },
  {
    id: 'c5', workflowId: 'social-media', name: '品牌周年庆内容', status: 'paused', currentStepId: 's3', startedAt: '2026-03-25',
    stepStatuses: { s0: 'done', s1: 'done', s2: 'done', s3: 'blocked', s4: 'pending', s5: 'pending', s6: 'pending', s7: 'pending', s8: 'pending' },
    notes: { s3: '等待品牌方确认主视觉方向' },
  },
  // 房产
  {
    id: 'c6', workflowId: 'rental', name: 'Burwood 2房公寓出租', status: 'active', currentStepId: 'r5', startedAt: '2026-04-05',
    stepStatuses: { r0: 'done', r1: 'done', r2: 'done', r3: 'done', r4: 'done', r5: 'in-progress', r6: 'pending', r7: 'pending', r8: 'pending', r9: 'pending' },
  },
  // 报价
  {
    id: 'c7', workflowId: 'quotation', name: 'Melbourne餐厅装修报价', status: 'active', currentStepId: 'q6', startedAt: '2026-04-02',
    stepStatuses: { q0: 'done', q1: 'done', q2: 'done', q3: 'done', q4: 'done', q5: 'done', q6: 'in-progress', q7: 'pending', q8: 'pending', q9: 'pending' },
  },
  {
    id: 'c8', workflowId: 'quotation', name: 'Sydney办公室IT基础设施报价', status: 'active', currentStepId: 'q3', startedAt: '2026-04-10',
    stepStatuses: { q0: 'done', q1: 'done', q2: 'done', q3: 'in-progress', q4: 'pending', q5: 'pending', q6: 'pending', q7: 'pending', q8: 'pending', q9: 'pending' },
  },
  // 入职
  {
    id: 'c9', workflowId: 'onboarding', name: '张伟-前端开发入职', status: 'active', currentStepId: 'o6', startedAt: '2026-04-08',
    stepStatuses: { o0: 'done', o1: 'done', o2: 'done', o3: 'done', o4: 'done', o5: 'done', o6: 'in-progress', o7: 'pending', o8: 'pending' },
  },
  // IT支持
  {
    id: 'c10', workflowId: 'it-support', name: '公司VPN无法连接', status: 'active', currentStepId: 'it5', startedAt: '2026-04-14',
    stepStatuses: { it0: 'done', it1: 'done', it2: 'done', it3: 'done', it4: 'done', it5: 'in-progress', it6: 'pending', it7: 'pending', it8: 'pending', it9: 'pending' },
  },
  {
    id: 'c11', workflowId: 'it-support', name: '邮箱迁移至O365', status: 'active', currentStepId: 'it4', startedAt: '2026-04-12',
    stepStatuses: { it0: 'done', it1: 'done', it2: 'done', it3: 'done', it4: 'blocked', it5: 'pending', it6: 'pending', it7: 'pending', it8: 'pending', it9: 'pending' },
    notes: { it4: '等待O365管理员权限审批' },
  },
  // 仓库
  {
    id: 'c12', workflowId: 'inventory', name: 'Q2季度备货', status: 'active', currentStepId: 'inv3', startedAt: '2026-04-01',
    stepStatuses: { inv0: 'done', inv1: 'done', inv2: 'done', inv3: 'in-progress', inv4: 'pending', inv5: 'pending', inv6: 'pending', inv7: 'pending', inv8: 'pending' },
  },
  // 设计
  {
    id: 'c13', workflowId: 'design', name: 'ABC咖啡品牌VI设计', status: 'active', currentStepId: 'd6', startedAt: '2026-03-15',
    stepStatuses: { d0: 'done', d1: 'done', d2: 'done', d3: 'done', d4: 'done', d5: 'done', d6: 'in-progress', d7: 'pending', d8: 'pending', d9: 'pending' },
  },
  {
    id: 'c14', workflowId: 'design', name: '线上教育平台UI重设计', status: 'active', currentStepId: 'd4', startedAt: '2026-04-05',
    stepStatuses: { d0: 'done', d1: 'done', d2: 'done', d3: 'done', d4: 'in-progress', d5: 'pending', d6: 'pending', d7: 'pending', d8: 'pending', d9: 'pending' },
  },
  // 财务
  {
    id: 'c15', workflowId: 'finance', name: '2026年3月结算', status: 'active', currentStepId: 'f5', startedAt: '2026-04-01',
    stepStatuses: { f0: 'done', f1: 'done', f2: 'done', f3: 'done', f4: 'done', f5: 'in-progress', f6: 'pending', f7: 'pending', f8: 'pending' },
  },
  // 产品发布
  {
    id: 'c16', workflowId: 'launch', name: 'PeopleClaw v0.1 发布', status: 'active', currentStepId: 'l3', startedAt: '2026-04-10',
    stepStatuses: { l0: 'done', l1: 'done', l2: 'done', l3: 'in-progress', l4: 'pending', l5: 'pending', l6: 'pending', l7: 'pending', l8: 'pending', l9: 'pending' },
  },
  {
    id: 'c17', workflowId: 'launch', name: 'API v2.0 灰度发布', status: 'completed', currentStepId: 'l9', startedAt: '2026-03-01',
    stepStatuses: { l0: 'done', l1: 'done', l2: 'done', l3: 'done', l4: 'done', l5: 'done', l6: 'done', l7: 'done', l8: 'done', l9: 'done' },
  },
];
