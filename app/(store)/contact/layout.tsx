import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us — Bold & Beautiful Takoradi',
  description: 'Get in touch with Bold & Beautiful at 16 Davis Street, Anaji, Takoradi. Contact us for product enquiries, styling advice, wholesale questions or any support. Open Tue–Sat, 8:30 AM – 6 PM.',
  keywords: [
    'contact Bold and Beautiful', 'Bold Beautiful Takoradi contact', 'boutique Takoradi Ghana',
    'fashion shop contact Takoradi', 'beauty store Anaji Takoradi', 'lifestyle store Western Region Ghana',
    'Bold & Beautiful phone number', 'Bold Beautiful address',
  ].join(', '),
  openGraph: {
    title: 'Contact Bold & Beautiful | Takoradi, Ghana',
    description: 'Visit us at 16 Davis Street, Anaji, Takoradi or contact us for product enquiries, styling advice and support.',
    images: [{ url: '/og-home.png', width: 1200, height: 630, alt: 'Contact Bold & Beautiful Takoradi', type: 'image/png' }],
    url: '/contact',
    locale: 'en_GH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Bold & Beautiful | Takoradi, Ghana',
    description: 'Contact us at 16 Davis Street, Anaji, Takoradi for fashion, beauty, fragrance and home collections.',
    images: ['/og-home.png'],
  },
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
