import type { Handler } from './index.js';

export const shopifyUploadHandler: Handler = async (input) => {
  const { payload } = input;
  const shop = process.env.SHOPIFY_DEV_SHOP;
  const token = process.env.SHOPIFY_DEV_ADMIN_TOKEN;
  const mock = process.env.SHOPIFY_MOCK === 'true';

  if (mock || !shop || !token) {
    return {
      output: {
        productId: 'mock_' + Date.now(),
        productAdminUrl: 'mock://admin',
        mock: true,
      },
    };
  }

  const body = {
    product: {
      title: (payload.title as string) || 'Untitled Product',
      body_html: (payload.description as string) || '',
      vendor: (payload.vendor as string) || 'PeopleClaw',
      product_type: (payload.product_type as string) || 'General',
    },
  };

  const res = await fetch(`https://${shop}/admin/api/2024-10/products.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json() as { product?: { id?: number; title?: string } };
  const productId = data.product?.id;
  // Shopify admin URL pattern: https://admin.shopify.com/store/{handle}/products/{id}
  // shop is e.g. claw-eb6xipji.myshopify.com → handle = claw-eb6xipji
  const handle = shop.replace(/\.myshopify\.com$/, '');
  return {
    output: {
      productId,
      productAdminUrl: productId
        ? `https://admin.shopify.com/store/${handle}/products/${productId}`
        : null,
      shopifyTitle: data.product?.title,
    },
  };
};
