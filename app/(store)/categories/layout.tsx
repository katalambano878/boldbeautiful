import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop by Category — Fashion, Beauty, Wigs, Home & More',
  description:
    'Explore all categories at Bold & Beautiful Takoradi. Shop clothing, accessories, fragrances, HD lace wigs, beauty essentials, home decor and more with delivery across Ghana.',
  keywords: [
    'Bold and Beautiful categories', 'shopping categories Takoradi Ghana', 'fashion categories Ghana',
    'HD lace wigs Ghana', 'home decor categories Ghana', 'beauty product categories Ghana',
    'fragrance categories Ghana', 'accessories Takoradi', 'Bold Beautiful shop by category',
  ].join(', '),
  openGraph: {
    title: 'Shop by Category | Bold & Beautiful',
    description: 'All categories — fashion, beauty, fragrance, wigs, home and more at Bold & Beautiful Takoradi.',
    images: [{ url: '/og-shop.png', width: 1200, height: 630, alt: 'Shop by Category — Bold & Beautiful', type: 'image/png' }],
    url: '/categories',
    locale: 'en_GH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shop by Category | Bold & Beautiful',
    description: 'All product categories at Bold & Beautiful Takoradi, Ghana.',
    images: ['/og-shop.png'],
  },
  alternates: { canonical: '/categories' },
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
