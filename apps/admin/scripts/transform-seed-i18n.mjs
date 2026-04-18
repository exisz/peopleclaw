#!/usr/bin/env node
/**
 * One-time transformation of seed-demo.data.json:
 * - Translate workflow-level `name`, `category`, `description` to English (stored as canonical value)
 * - Use stable English category slugs matching `apps/admin/src/client/i18n/locales/en/workflow.json:categories.*`
 * - Add `name_i18n`, `category_i18n`, `description_i18n` = { en, zh } so frontend can pick
 * - Step-level Chinese text inside `steps[]` is preserved as-is for now (future work, P3.7.1)
 *
 * Run:  node apps/admin/scripts/transform-seed-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('./seed-demo.data.json', import.meta.url);
const data = JSON.parse(readFileSync(path, 'utf8'));

// Workflow id → English translation
const WF_TR = {
  'ecommerce':    { name: 'Cross-border E-commerce Listing',     category: 'ecommerce',  description: 'Cross-border E-commerce Product Listing — from market research to store listing' },
  'social-media': { name: 'Social Media Content Operations',     category: 'marketing',  description: 'Social media content production and distribution — from ideation to publishing' },
  'rental':       { name: 'Property Rental Management',          category: 'asset',      description: 'End-to-end property rental management — from listing to handover' },
  'quotation':    { name: 'Customer Quotation Flow',             category: 'sales',      description: 'Customer quotation and approval flow — from RFQ to signed quote' },
  'onboarding':   { name: 'Employee Onboarding',                 category: 'hr',         description: 'New-hire onboarding flow — paperwork, accounts, equipment, training' },
  'it-support':   { name: 'IT Support Ticket',                   category: 'support',    description: 'IT support ticket lifecycle — intake, triage, resolution' },
  'inventory':    { name: 'Warehouse Inventory',                 category: 'supply',     description: 'Warehouse inventory in/out tracking — purchasing, receiving, dispatch' },
  'design':       { name: 'Design Project Delivery',             category: 'design',     description: 'Design project delivery — from brief to final assets' },
  'finance':      { name: 'Monthly Financial Closing',           category: 'finance',    description: 'Monthly financial close — reconciliation, journals, reports' },
  'launch':       { name: 'Product Launch',                      category: 'product',    description: 'Product launch flow — readiness, marketing, release' },
};

// Original Chinese category → English slug key
const CAT_ZH_TO_KEY = {
  '电商运营': 'ecommerce',
  '营销推广': 'marketing',
  '资产管理': 'asset',
  '销售管理': 'sales',
  '人力资源': 'hr',
  '技术支持': 'support',
  '供应链': 'supply',
  '创意设计': 'design',
  '财务管理': 'finance',
  '产品研发': 'product',
};

let transformed = 0;
for (const w of data.workflows) {
  const tr = WF_TR[w.id];
  if (!tr) {
    console.warn(`[transform] no translation for workflow id=${w.id}, skipping`);
    continue;
  }
  // Save original Chinese
  const zhName = w.name;
  const zhCategory = w.category;
  const zhDescription = w.description;
  // Replace top-level with English
  w.name = tr.name;
  w.category = tr.category; // store stable English key in DB
  w.description = tr.description;
  // Store i18n object inline at workflow level (will be moved into definition by seed script)
  w.name_i18n = { en: tr.name, zh: zhName };
  w.category_i18n = { en: tr.category, zh: zhCategory };
  w.description_i18n = { en: tr.description, zh: zhDescription };
  transformed += 1;
}
console.log(`[transform] translated ${transformed} workflows`);

// Sanity: every category present should map to a key
for (const w of data.workflows) {
  const key = CAT_ZH_TO_KEY[w.category_i18n?.zh];
  if (!key || key !== w.category) {
    console.warn(`[transform] category mismatch on ${w.id}: ${w.category_i18n?.zh} → ${w.category}`);
  }
}

writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('[transform] wrote', path.pathname);
