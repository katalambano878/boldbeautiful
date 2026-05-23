import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop Bold & Beautiful Collections',
  description:
    "Browse Bold & Beautiful's full collection of fashion, beauty, fragrance, HD lace wigs and home essentials — all available for fast delivery across Ghana from Takoradi.",
  keywords: [
    'Bold and Beautiful shop', 'online fashion store Ghana', 'perfume shop Takoradi Ghana',
    'home decor shop Ghana', 'beauty products Takoradi', 'HD lace wigs Ghana',
    'gift shop Takoradi', 'lifestyle store Western Region', 'boutique Ghana',
    'Bold Beautiful collections',
  ].join(', '),
  openGraph: {
    title: 'Shop Collections | Bold & Beautiful',
    description: 'Browse our full range of fashion, beauty, fragrance, wigs and home collections with fast delivery across Ghana.',
    images: [{ url: '/og-shop.png', width: 1200, height: 630, alt: 'Shop Bold & Beautiful Collections', type: 'image/png' }],
    url: '/shop',
    type: 'website',
    locale: 'en_GH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shop Collections | Bold & Beautiful',
    description: 'Browse fashion, beauty, fragrance, wigs and home collections at Bold & Beautiful Takoradi.',
    images: [{ url: '/og-shop.png', alt: 'Shop Bold & Beautiful Collections' }],
  },
  alternates: { canonical: '/shop' },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
