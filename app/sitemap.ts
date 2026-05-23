import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.boldnbeautiful.store').replace(/\/+$/, '');
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                              lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/shop`,                    lastModified: now, changeFrequency: 'daily',   priority: 0.95 },
    { url: `${baseUrl}/categories`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${baseUrl}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/blog`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.75 },
    { url: `${baseUrl}/pre-orders`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.75 },
    { url: `${baseUrl}/faqs`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/help`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${baseUrl}/shipping`,                lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/returns`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/refund-policy`,           lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/order-tracking`,          lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/academia`,                lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/privacy`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/terms`,                   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/shop?category=fashion`,   lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/shop?category=beauty`,    lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/shop?category=fragrance`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/shop?category=home`,      lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];

  let productPages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const [productsRes, categoriesRes] = await Promise.allSettled([
        supabase.from('products').select('slug, updated_at').eq('status', 'active'),
        supabase.from('categories').select('slug, updated_at').eq('status', 'active'),
      ]);

      if (productsRes.status === 'fulfilled' && productsRes.value.data) {
        productPages = productsRes.value.data.map((product) => ({
          url: `${baseUrl}/product/${product.slug}`,
          lastModified: new Date(product.updated_at),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }));
      }

      if (categoriesRes.status === 'fulfilled' && categoriesRes.value.data) {
        categoryPages = categoriesRes.value.data.map((category) => ({
          url: `${baseUrl}/shop?category=${category.slug}`,
          lastModified: new Date(category.updated_at),
          changeFrequency: 'weekly' as const,
          priority: 0.75,
        }));
      }
    } catch (error) {
      console.error('Sitemap: Supabase fetch failed, returning static pages only:', error);
    }
  }

  return [...staticPages, ...productPages, ...categoryPages];
}
