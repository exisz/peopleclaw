/**
 * PLANET-1196 — Table Parser (read_table node)
 * Parses .xlsx / .csv files using SheetJS, maps columns via v1 synonym dictionary,
 * validates rows with zod, and returns ok_rows + error_rows + unmapped_columns.
 */
import * as XLSX from 'xlsx';
import { z } from 'zod';

// ── v1 synonym dictionary (PLANET-1196 + PLANET-1200 expanded) ───────────────
const SYNONYM_MAP: Record<string, string> = {
  // product_name
  商品名: 'product_name',
  商品名称: 'product_name',
  品名: 'product_name',
  名称: 'product_name',
  产品名: 'product_name',
  产品名称: 'product_name',
  product: 'product_name',
  name: 'product_name',
  title: 'product_name',
  productname: 'product_name',
  product_name: 'product_name',
  // price
  价格: 'price',
  售价: 'price',
  单价: 'price',
  价格元: 'price',
  price: 'price',
  // stock
  库存: 'stock',
  数量: 'stock',
  stock: 'stock',
  qty: 'stock',
  quantity: 'stock',
  // image_url
  图片: 'image_url',
  商品图: 'image_url',
  图片链接: 'image_url',
  image: 'image_url',
  img: 'image_url',
  photo: 'image_url',
  imageurl: 'image_url',
  image_url: 'image_url',
  // sku (PLANET-1200)
  sku: 'sku',
  编号: 'sku',
  货号: 'sku',
  商品编号: 'sku',
  // description (PLANET-1200)
  描述: 'description',
  简短描述: 'description',
  简介: 'description',
  商品描述: 'description',
  desc: 'description',
  description: 'description',
  // category (PLANET-1200)
  分类: 'category',
  品类: 'category',
  类别: 'category',
  category: 'category',
  // color_variants (PLANET-1345)
  颜色: 'color',
  色: 'color',
  颜色分类: 'color',
  color: 'color',
  colors: 'color',
  colour: 'color',
};

/** Normalise a raw column header to a lookup key */
function normaliseHeader(h: string): string {
  return h.trim()
    .replace(/[\(\)（）\[\]]/g, '') // strip parentheses/brackets
    .replace(/\s*元\s*$/g, '')            // strip trailing "元"
    .toLowerCase()
    .replace(/[\s_\-]/g, '');
}

// ── Row validation schema ─────────────────────────────────────────────────────
const rowSchema = z.object({
  product_name: z.string().min(1, '商品名不能为空').max(200, '商品名不得超过200字'),
  price: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .pipe(z.number().min(0, '价格不能为负')),
  stock: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .pipe(
      z
        .number()
        .int('库存必须为整数')
        .min(0, '库存不能为负'),
    ),
  image_url: z
    .string()
    .optional()
    .transform((v) => (v === '' || v == null ? undefined : v))
    .pipe(
      z
        .string()
        .url('image_url 必须是合法 URL（http/https）')
        .optional(),
    ),
  // Optional extended fields (PLANET-1200)
  sku: z.union([z.string(), z.number()]).optional().transform((v) => (v == null || v === '' ? undefined : String(v))),
  description: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  category: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  // PLANET-1345: color column — "白色/绿色" or "白色,绿色" format
  color: z.string().optional().transform((v) => (v === '' || v == null ? undefined : v)),
});

export type OkRow = {
  row: number;
  product_name: string;
  price: number;
  stock: number;
  image_url?: string;
  sku?: string;
  description?: string;
  category?: string;
  color?: string;
};

export type ErrorRow = {
  row: number;
  column: string;
  value: string;
  reason: string;
};

export type ParseResult = {
  ok_rows: OkRow[];
  error_rows: ErrorRow[];
  unmapped_columns: string[];
};

// ── Main parser ───────────────────────────────────────────────────────────────
export function parseTableBuffer(buffer: Buffer, filename: string): ParseResult {
  const fileType = filename.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';

  const wb = XLSX.read(buffer, {
    type: 'buffer',
    // For CSV, dense mode is fine; SheetJS auto-detects
    ...(fileType === 'csv' ? { type: 'buffer' } : {}),
  });

  // v1: only first sheet
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('文件中没有找到工作表');
  const ws = wb.Sheets[sheetName];

  // Convert to array-of-arrays (header row first)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  if (rows.length === 0) throw new Error('文件为空');

  const headerRow = rows[0] as string[];
  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell !== '' && cell != null));

  // v1 hard limit: 50 rows
  const capped = dataRows.slice(0, 50);

  // Build column mapping: raw header → standard field (or null if unmapped)
  const colMap: Array<string | null> = headerRow.map((h) => {
    const key = normaliseHeader(String(h));
    return SYNONYM_MAP[key] ?? null;
  });

  const unmapped_columns: string[] = headerRow
    .filter((_, i) => colMap[i] === null)
    .map((h) => String(h));

  const ok_rows: OkRow[] = [];
  const error_rows: ErrorRow[] = [];

  capped.forEach((row, i) => {
    const rowNum = i + 1; // 1-based (data row 1 = spreadsheet row 2)
    // Build a mapped object
    const mapped: Record<string, unknown> = {};
    headerRow.forEach((_, colIdx) => {
      const field = colMap[colIdx];
      if (field) {
        mapped[field] = (row as unknown[])[colIdx];
      }
    });

    const result = rowSchema.safeParse(mapped);
    if (result.success) {
      const d = result.data;
      const okRow: OkRow = { row: rowNum, product_name: d.product_name, price: d.price, stock: d.stock };
      if (d.image_url) okRow.image_url = d.image_url;
      if (d.sku) okRow.sku = d.sku;
      if (d.description) okRow.description = d.description;
      if (d.category) okRow.category = d.category;
      if (d.color) okRow.color = d.color;
      ok_rows.push(okRow);
    } else {
      // Report the first error per row
      const issue = result.error.issues[0];
      const column = issue.path[0] as string | undefined;
      const rawValue = column ? String(mapped[column] ?? '') : '';
      error_rows.push({
        row: rowNum,
        column: column ?? '(unknown)',
        value: rawValue,
        reason: issue.message,
      });
    }
  });

  return { ok_rows, error_rows, unmapped_columns };
}
