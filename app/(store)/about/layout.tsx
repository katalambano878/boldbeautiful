import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us — Bold & Beautiful Takoradi',
  description:
    "Learn about Bold & Beautiful — Takoradi's premier lifestyle boutique. We curate fashion, beauty, fragrance, HD lace wigs and home pieces that elevate everyday living with quality, elegance and expertise.",
  keywords: [
    'about Bold and Beautiful', 'Bold Beautiful Takoradi story', 'lifestyle brand Takoradi Ghana',
    'fashion boutique Takoradi', 'home decor Ghana brand', 'trusted online store Ghana',
    'Takoradi lifestyle brand', 'Anaji boutique Ghana', 'Bold & Beautiful history',
  ].join(', '),
  openGraph: {
    title: "About Bold & Beautiful | Takoradi's Premier Lifestyle Boutique",
    description: "Takoradi's trusted lifestyle brand — fashion, beauty, fragrance, wigs and home collections.",
    images: [{ url: '/og-home.png', width: 1200, height: 630, alt: 'About Bold & Beautiful Takoradi', type: 'image/png' }],
    url: '/about',
    locale: 'en_GH',
  },
  twitter: {
    card: 'summary_large_image',
    title: "About Bold & Beautiful | Takoradi's Premier Lifestyle Boutique",
    description: "Takoradi's trusted fashion, beauty, wigs and home destination.",
    images: ['/og-home.png'],
  },
  alternates: { canonical: '/about' },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
