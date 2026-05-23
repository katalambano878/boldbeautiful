import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Boutique Academy',
  description: 'Boutique Academy is evolving into a broader lifestyle education hub. Check back soon for styling, branding and home curation sessions.',
  robots: { index: false, follow: true },
};

export default function AcademiaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
