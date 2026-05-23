import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ProductDetailClient from './ProductDetailClient';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.boldnbeautiful.store';
const SITE_NAME = 'Bold & Beautiful';

async function getProduct(slug: string) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from('products')
      .select('name, description, images, price, category_id, metadata')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: 'Product Not Found | Bold & Beautiful',
      robots: { index: false, follow: false },
    };
  }

  const productUrl = `${SITE_URL}/product/${slug}`;
  const ogImage = product.images?.[0]?.url || '/og-shop.png';
  const title = `${product.name} | ${SITE_NAME}`;
  const description = product.description
    ? `${product.description.slice(0, 155)}...`
    : `Shop ${product.name} at Bold & Beautiful Takoradi — curated quality with fast delivery across Ghana.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title,
      description,
      url: productUrl,
      type: 'article',
      siteName: SITE_NAME,
      locale: 'en_GH',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${product.name} — ${SITE_NAME}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical: productUrl },
    keywords: [
      product.name,
      `${product.name} Ghana`,
      `buy ${product.name} Ghana`,
      `${product.name} Takoradi`,
      'Bold and Beautiful',
      'online fashion store Ghana',
      'lifestyle store Takoradi Ghana',
      SITE_NAME,
    ].join(', '),
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
