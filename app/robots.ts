import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.boldnbeautiful.store';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/checkout',
          '/cart',
          '/account/',
          '/order-success',
          '/pwa-settings',
          '/offline',
          '/maintenance',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/admin/', '/api/', '/checkout', '/cart', '/account/'],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/og-home.png', '/og-shop.png', '/logo.png', '/_next/image'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
