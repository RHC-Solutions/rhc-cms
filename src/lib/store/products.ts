import crypto from 'crypto';
import { getDriver } from '../cms/db';
import { ensureSchema } from '../cms/migrations';

/**
 * Product catalogue for the store module. Money is integer cents. A product may
 * carry optional variants (sizes/options) each with their own price/stock; when
 * a variant has a null priceCents it inherits the product price.
 */

const driver = getDriver();

export type ProductStatus = 'active' | 'draft' | 'archived';

export interface ProductVariant {
  id: string;
  productId: string;
  label: string;
  sku: string | null;
  priceCents: number | null;
  stock: number | null;
  position: number;
  createdAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  priceCents: number;
  currency: string;
  images: string[];
  category: string | null;
  trackStock: boolean;
  stock: number | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function mapProduct(r: any): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? null,
    status: (r.status as ProductStatus) ?? 'active',
    priceCents: Number(r.priceCents ?? 0),
    currency: r.currency ?? 'usd',
    images: safeParse<string[]>(r.images, []),
    category: r.category ?? null,
    trackStock: r.trackStock === 1 || r.trackStock === true,
    stock: r.stock == null ? null : Number(r.stock),
    metadata: r.metadata ? safeParse<Record<string, any>>(r.metadata, {}) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapVariant(r: any): ProductVariant {
  return {
    id: r.id,
    productId: r.productId,
    label: r.label,
    sku: r.sku ?? null,
    priceCents: r.priceCents == null ? null : Number(r.priceCents),
    stock: r.stock == null ? null : Number(r.stock),
    position: Number(r.position ?? 0),
    createdAt: r.createdAt,
  };
}

function slugify(input: string): string {
  // Bound the length BEFORE the regexes run: the trim regex (/^-+|-+$/) is
  // polynomial-backtracking on long dash runs, so cap input to 80 chars first.
  return input
    .toLowerCase()
    .trim()
    .slice(0, 80)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || crypto.randomUUID().slice(0, 8);
}

export interface ProductInput {
  name: string;
  slug?: string;
  description?: string;
  status?: ProductStatus;
  priceCents?: number;
  currency?: string;
  images?: string[];
  category?: string;
  trackStock?: boolean;
  stock?: number | null;
  metadata?: Record<string, any>;
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 50; i++) {
    const rows = await driver.query<any>('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
    if (!rows[0] || rows[0].id === excludeId) return slug;
    slug = `${slugify(base)}-${i + 2}`;
  }
  return `${slugify(base)}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function listProducts(opts: {
  status?: ProductStatus;
  category?: string;
  limit?: number;
  offset?: number;
  withVariants?: boolean;
} = {}): Promise<{ products: Product[]; total: number }> {
  await ensureSchema();
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  }
  if (opts.category) {
    conditions.push('category = ?');
    params.push(opts.category);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

  const totalRow = (
    await driver.query<{ count: any }>(`SELECT COUNT(*) as count FROM products${where}`, params)
  )[0];
  const total = Number(totalRow?.count ?? 0);

  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500);
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = await driver.query<any>(
    `SELECT * FROM products${where} ORDER BY "updatedAt" DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const products = rows.map(mapProduct);

  if (opts.withVariants && products.length) {
    for (const p of products) {
      p.variants = await listVariants(p.id);
    }
  }
  return { products, total };
}

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  await ensureSchema();
  const rows = await driver.query<any>(
    'SELECT * FROM products WHERE id = ? OR slug = ? LIMIT 1',
    [idOrSlug, idOrSlug],
  );
  if (!rows[0]) return null;
  const product = mapProduct(rows[0]);
  product.variants = await listVariants(product.id);
  return product;
}

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  await ensureSchema();
  const rows = await driver.query<any>(
    'SELECT * FROM product_variants WHERE "productId" = ? ORDER BY position ASC, "createdAt" ASC',
    [productId],
  );
  return rows.map(mapVariant);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await ensureSchema();
  if (!input.name?.trim()) throw new Error('name is required');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = await uniqueSlug(input.slug || input.name);
  await driver.run(
    `INSERT INTO products (id, slug, name, description, status, "priceCents", currency, images, category, "trackStock", stock, metadata, "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      input.name.trim(),
      input.description ?? null,
      input.status ?? 'active',
      Math.max(0, Math.round(input.priceCents ?? 0)),
      (input.currency ?? 'usd').toLowerCase(),
      JSON.stringify(input.images ?? []),
      input.category ?? null,
      input.trackStock ? 1 : 0,
      input.stock == null ? null : Math.max(0, Math.round(input.stock)),
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now,
    ],
  );
  return (await getProduct(id))!;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product | null> {
  await ensureSchema();
  const existing = await getProduct(id);
  if (!existing) return null;
  const slug = input.slug ? await uniqueSlug(input.slug, id) : existing.slug;
  const next = { ...existing, ...input, slug };
  await driver.run(
    `UPDATE products SET slug = ?, name = ?, description = ?, status = ?, "priceCents" = ?, currency = ?, images = ?, category = ?, "trackStock" = ?, stock = ?, metadata = ?, "updatedAt" = ?
     WHERE id = ?`,
    [
      next.slug,
      next.name,
      next.description ?? null,
      next.status,
      Math.max(0, Math.round(next.priceCents ?? 0)),
      (next.currency ?? 'usd').toLowerCase(),
      JSON.stringify(next.images ?? []),
      next.category ?? null,
      next.trackStock ? 1 : 0,
      next.stock == null ? null : Math.max(0, Math.round(next.stock)),
      next.metadata ? JSON.stringify(next.metadata) : null,
      new Date().toISOString(),
      id,
    ],
  );
  return getProduct(id);
}

export async function deleteProduct(id: string): Promise<boolean> {
  await ensureSchema();
  await driver.run('DELETE FROM product_variants WHERE "productId" = ?', [id]);
  const res = await driver.run('DELETE FROM products WHERE id = ?', [id]);
  return res.changes > 0;
}

export async function setVariants(
  productId: string,
  variants: Array<{ id?: string; label: string; sku?: string; priceCents?: number | null; stock?: number | null; position?: number }>,
): Promise<ProductVariant[]> {
  await ensureSchema();
  // Replace-all semantics keeps the admin editor simple and avoids orphans.
  await driver.run('DELETE FROM product_variants WHERE "productId" = ?', [productId]);
  let position = 0;
  for (const v of variants) {
    if (!v.label?.trim()) continue;
    await driver.run(
      `INSERT INTO product_variants (id, "productId", label, sku, "priceCents", stock, position, "createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        productId,
        v.label.trim(),
        v.sku ?? null,
        v.priceCents == null ? null : Math.max(0, Math.round(v.priceCents)),
        v.stock == null ? null : Math.max(0, Math.round(v.stock)),
        v.position ?? position++,
        new Date().toISOString(),
      ],
    );
  }
  return listVariants(productId);
}

/** Decrement stock for a product or variant. Best-effort, floors at 0. */
export async function decrementStock(productId: string, variantId: string | null, qty: number): Promise<void> {
  await ensureSchema();
  if (variantId) {
    await driver.run(
      'UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ? AND stock IS NOT NULL',
      [qty, variantId],
    );
  } else {
    await driver.run(
      'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ? AND stock IS NOT NULL AND "trackStock" = 1',
      [qty, productId],
    );
  }
}
