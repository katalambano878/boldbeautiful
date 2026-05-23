import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bold & Beautiful',
    short_name: 'Bold & Beautiful',
    description: "Takoradi's premier destination for curated fashion, beauty, fragrance and home collections — 16 Davis Street, Anaji.",
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    categories: ['shopping', 'beauty', 'lifestyle'],
    lang: 'en-GH',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    screenshots: [
      { src: '/og-home.png', sizes: '1200x630', type: 'image/png', label: 'Bold & Beautiful Homepage' },
      { src: '/og-shop.png', sizes: '1200x630', type: 'image/png', label: 'Shop Bold & Beautiful Collections' },
    ],
    shortcuts: [
      { name: 'Shop Fashion', short_name: 'Fashion', description: 'Browse clothing & accessories', url: '/shop', icons: [{ src: '/logo.png', sizes: '96x96' }] },
      { name: 'Shop Home', short_name: 'Home', description: 'Browse home & living', url: '/shop?category=home', icons: [{ src: '/logo.png', sizes: '96x96' }] },
      { name: 'Shop Beauty', short_name: 'Beauty', description: 'Browse beauty & fragrance', url: '/shop?category=beauty', icons: [{ src: '/logo.png', sizes: '96x96' }] },
    ],
    related_applications: [],
    prefer_related_applications: false,
  };
}
