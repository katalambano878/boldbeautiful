'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import { StructuredData, generateProductSchema, generateBreadcrumbSchema } from '@/components/SEOHead';
import { notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { asNumber, money } from '@/lib/format-money';

// Map common color names to hex values for the swatch preview
function colorNameToHex(name: string): string {
  const map: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', pink: '#ec4899', black: '#111827',
    white: '#ffffff', gray: '#6b7280', grey: '#6b7280', brown: '#92400e',
    navy: '#1e3a5f', gold: '#d4a017', silver: '#c0c0c0', beige: '#f5f5dc',
    maroon: '#800000', teal: '#14b8a6', coral: '#ff7f50', ivory: '#fffff0',
    cream: '#fffdd0', burgundy: '#800020', lavender: '#e6e6fa', cyan: '#06b6d4',
    magenta: '#d946ef', olive: '#84cc16', peach: '#ffcba4', mint: '#98f5e1',
    rose: '#f43f5e', wine: '#722f37', charcoal: '#374151', sky: '#0ea5e9',
  };
  return map[name.toLowerCase().trim()] || '#d1d5db';
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  usePageTitle(product?.name || 'Product');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        // Fetch main product (cached for 2 minutes)
        const { data: productData, error } = await cachedQuery<{ data: any; error: any }>(
          `product:${slug}`,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name),
                product_variants(*),
                product_images(url, position, alt_text)
              `);

            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

            if (isUUID) {
              query = query.or(`id.eq.${slug},slug.eq.${slug}`);
            } else {
              query = query.eq('slug', slug);
            }

            query = query.eq('status', 'active');

            return query.single() as any;
          },
          2 * 60 * 1000 // 2 minutes
        );

        if (error || !productData) {
          console.error('Error fetching product:', error);
          setLoading(false);
          return;
        }

        // Transform product data
        // Color may be option1 or option2 depending on option_names order
        const optionNamesMeta: string[] = productData.metadata?.option_names || [];
        const colorOptIndex = optionNamesMeta.findIndex((n: string) => /color/i.test(String(n)));
        const colorKey =
          colorOptIndex === 0 ? 'option1' :
          colorOptIndex === 1 ? 'option2' :
          colorOptIndex === 2 ? 'option3' :
          'option1';

        const rawVariants = (productData.product_variants || []).map((v: any) => ({
          ...v,
          price: asNumber(v.price, asNumber(productData.price)),
          quantity: asNumber(v.quantity),
          color: v[colorKey] || v.option1 || v.option2 || '',
          colorHex: v.metadata?.color_hex || ''
        }));

        // Build a color-to-hex map from variants (prefer stored hex, fallback to colorNameToHex)
        const colorHexMap: Record<string, string> = {};
        rawVariants.forEach((v: any) => {
          if (v.color) {
            const plain = String(v.color).split('|')[0];
            if (!colorHexMap[plain]) {
              colorHexMap[plain] = v.colorHex || colorNameToHex(plain);
            }
          }
        });

        const transformedProduct = {
          ...productData,
          images: productData.product_images?.sort((a: any, b: any) => a.position - b.position).map((img: any) => img.url) || [],
          category: productData.categories?.name || 'Shop',
          rating: asNumber(productData.rating_avg),
          reviewCount: 0,
          stockCount: asNumber(productData.quantity),
          moq: productData.moq || 1,
          colors: [...new Set(rawVariants.map((v: any) => String(v.color).split('|')[0]).filter(Boolean))],
          colorHexMap,
          variants: rawVariants,
          sizes: rawVariants.map((v: any) => v.name) || [],
          features: ['Premium Quality', 'Authentic Design'],
          featured: ['Premium Quality', 'Authentic Design'],
          care: 'Handle with care.',
          preorderShipping: productData.metadata?.preorder_shipping || null
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['https://via.placeholder.com/800x800?text=No+Image'];
        }

        setProduct(transformedProduct);

        // Set initial quantity to MOQ
        if (transformedProduct.moq > 1) {
          setQuantity(transformedProduct.moq);
        }

        // If variants exist, do NOT pre-select — force user to choose
        setSelectedVariant(null);
        setSelectedOptions({});

        // Fetch related products (cached for 5 minutes)
        if (productData.category_id) {
          const { data: related } = await cachedQuery<{ data: any; error: any }>(
            `related:${productData.category_id}:${productData.id}`,
            (() => supabase
              .from('products')
              .select('*, product_images(url, position), product_variants(id, name, price, quantity)')
              .eq('category_id', productData.category_id)
              .neq('id', productData.id)
              .limit(4)) as any,
            5 * 60 * 1000
          );

          if (related) {
            setRelatedProducts(related.map((p: any) => {
              const variants = p.product_variants || [];
              const hasVariants = variants.length > 0;
              const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
              const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
              const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
              return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.product_images?.[0]?.url || 'https://via.placeholder.com/800?text=No+Image',
                rating: p.rating_avg || 0,
                reviewCount: 0,
                inStock: effectiveStock > 0,
                maxStock: effectiveStock || 50,
                moq: p.moq || 1,
                hasVariants,
                minVariantPrice
              };
            }));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const hasVariants = product?.variants?.length > 0;
  const optionNames: string[] = product?.metadata?.option_names || [];

  // Build all selectable option groups from metadata
  const productOptions: Record<string, { values: string[]; generatesVariants?: boolean }> = product?.metadata?.product_options || {};
  const customOptionGroups: { name: string; values: string[]; generatesVariants?: boolean }[] = product?.metadata?.custom_option_groups || [];

  // All option labels for display (variant-generating come from optionNames, selection-only from metadata)
  const allOptionLabels: { name: string; values: string[]; isColor: boolean; generatesVariants: boolean }[] = [];

  // Map of default key -> label
  const defaultKeyToLabel: Record<string, string> = {
    color: 'Color', lace_type: 'Lace Type', lace_length: 'Lace Length',
    length: 'Length', wig_size: 'Wig Size', density: 'Density',
  };

  // Add from product_options (default groups stored by key)
  Object.entries(productOptions).forEach(([key, opt]) => {
    const label = defaultKeyToLabel[key] || key;
    allOptionLabels.push({
      name: label,
      values: opt.values || [],
      isColor: key === 'color' || /color/i.test(label),
      generatesVariants: opt.generatesVariants ?? optionNames.includes(label),
    });
  });

  // Add custom option groups
  customOptionGroups.forEach(g => {
    if (!allOptionLabels.some(o => o.name === g.name)) {
      allOptionLabels.push({
        name: g.name,
        values: g.values,
        isColor: /color/i.test(g.name),
        generatesVariants: g.generatesVariants ?? optionNames.includes(g.name),
      });
    }
  });

  // Seeded / admin products often store option_names + variants but not product_options.
  // Derive selectable values from variant option1/option2/option3 so UI always appears.
  if (hasVariants && optionNames.length > 0) {
    optionNames.forEach((name, idx) => {
      const existing = allOptionLabels.find(o => o.name === name);
      const key = `option${idx + 1}`;
      const values = [...new Set(
        (product.variants || [])
          .map((v: any) => v[key])
          .filter((v: any) => v != null && String(v).trim() !== '')
          .map((v: any) => String(v).split('|')[0].trim())
      )];
      if (!values.length) return;
      if (existing) {
        if (!existing.values.length) existing.values = values;
        existing.generatesVariants = true;
      } else {
        allOptionLabels.push({
          name,
          values,
          isColor: /color/i.test(name),
          generatesVariants: true,
        });
      }
    });
  }

  // Also accept products.options jsonb: [{ name, values }]
  if (Array.isArray(product?.options)) {
    for (const g of product.options) {
      if (!g?.name || !Array.isArray(g.values) || !g.values.length) continue;
      const existing = allOptionLabels.find(o => o.name === g.name);
      if (existing) {
        if (!existing.values.length) existing.values = g.values.map((v: string) => String(v).split('|')[0]);
      } else {
        allOptionLabels.push({
          name: g.name,
          values: g.values.map((v: string) => String(v).split('|')[0]),
          isColor: /color/i.test(g.name),
          generatesVariants: optionNames.includes(g.name) || optionNames.length === 0,
        });
      }
    }
  }

  const variantOptionNames = optionNames.length > 0
    ? optionNames
    : allOptionLabels.filter(o => o.generatesVariants && o.values.length > 0).map(o => o.name);

  const allOptionsSelected = (() => {
    const required = allOptionLabels.filter(o => o.values.length > 0);
    return required.length === 0 || required.every(o => selectedOptions[o.name]);
  })();
  const needsVariantSelection = hasVariants && !selectedVariant;

  const handleOptionSelect = (optName: string, val: string) => {
    // Color swatches may store "Name|#hex" — match variants on the plain name
    const plainVal = String(val).split('|')[0].trim();
    const newOpts = { ...selectedOptions, [optName]: plainVal };
    setSelectedOptions(newOpts);
    // Auto-find matching variant when all variant-generating options are selected
    if (variantOptionNames.length > 0) {
      const allVarSelected = variantOptionNames.every(n => newOpts[n]);
      if (allVarSelected && product?.variants) {
        const match = product.variants.find((v: any) =>
          variantOptionNames.every((n: string, idx: number) => {
            const optionKey = optionNames.length > 0
              ? `option${idx + 1}`
              : `option${allOptionLabels.findIndex(o => o.name === n) + 1}`;
            const variantVal = String(v[optionKey] ?? '').split('|')[0].trim();
            return variantVal === newOpts[n];
          })
        );
        setSelectedVariant(match || null);
      } else {
        setSelectedVariant(null);
      }
    }
  };

  // Determine the active price: variant price if selected, otherwise base price
  const activePrice = asNumber(selectedVariant?.price, asNumber(product?.price));
  const activeStock = selectedVariant
    ? asNumber(selectedVariant.stock ?? selectedVariant.quantity, asNumber(product?.stockCount))
    : asNumber(product?.stockCount);

  const handleAddToCart = () => {
    if (!product) return;
    if (needsVariantSelection) return; // Safety check

    // Build variant display string from selected options
    let variantLabel: string | undefined;
    if (selectedVariant) {
      const parts = variantOptionNames.map(n => selectedOptions[n]).filter(Boolean);
      variantLabel = parts.length > 0 ? parts.join(' / ') : (selectedVariant.name || undefined);
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: activePrice,
      image: product.images[0],
      quantity: quantity,
      variant: variantLabel,
      variantId: selectedVariant?.id,
      slug: product.slug,
      maxStock: activeStock,
      moq: product.moq || 1
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = '/checkout';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12 flex justify-center items-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-gray-700 animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white py-20 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h2>
          <Link href="/shop" className="text-gray-700 hover:underline">Return to Shop</Link>
        </div>
      </div>
    );
  }

  const compareAt = asNumber(product.compare_at_price, NaN);
  const discount = Number.isFinite(compareAt) && compareAt > 0
    ? Math.round((1 - activePrice / compareAt) * 100)
    : 0;
  const minVariantPrice = hasVariants
    ? Math.min(...product.variants.map((v: any) => asNumber(v.price, asNumber(product.price))))
    : asNumber(product.price);

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images[0],
    price: hasVariants ? minVariantPrice : product.price,
    currency: 'GHS',
    sku: product.sku,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availability: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
    category: product.category
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://www.boldnbeautiful.store');
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: 'Shop', url: `${baseUrl}/shop` },
    { name: product.category, url: `${baseUrl}/shop?category=${product.category.toLowerCase().replace(/\s+/g, '-')}` },
    { name: product.name, url: `${baseUrl}/product/${slug}` }
  ]);

  return (
    <>
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="min-h-screen bg-white">
        <section className="py-8 bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-2 text-sm flex-wrap gap-y-2">
              <Link href="/" className="text-gray-600 hover:text-gray-700 transition-colors">Home</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="/shop" className="text-gray-600 hover:text-gray-700 transition-colors">Shop</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="#" className="text-gray-600 hover:text-gray-700 transition-colors">{product.category}</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
            </nav>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                {(() => {
                  const isVid = /\.(mp4|webm|ogg|mov|avi)$/i.test(product.images[selectedImage] || '');
                  return (
                    <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 shadow-lg border border-gray-100">
                      {isVid ? (
                        <video
                          key={product.images[selectedImage]}
                          src={product.images[selectedImage]}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                          playsInline
                          controls
                        />
                      ) : (
                        <Image
                          src={product.images[selectedImage]}
                          alt={product.name}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          priority
                          quality={80}
                        />
                      )}
                      {discount > 0 && (
                        <span className="absolute top-6 right-6 bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-full">
                          Save {discount}%
                        </span>
                      )}
                    </div>
                  );
                })()}

                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {product.images.map((image: string, index: number) => {
                      const thumbIsVid = /\.(mp4|webm|ogg|mov|avi)$/i.test(image);
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImage === index ? 'border-gray-700 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          {thumbIsVid ? (
                            <>
                              <video src={image} className="w-full h-full object-cover" muted playsInline />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <i className="ri-play-circle-fill text-white text-2xl"></i>
                              </span>
                            </>
                          ) : (
                            <Image
                              src={image}
                              alt={`${product.name} view ${index + 1}`}
                              fill
                              className="object-cover object-center"
                              sizes="(max-width: 1024px) 25vw, 12vw"
                              quality={60}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm text-gray-500 font-medium mb-1 uppercase tracking-wider">{product.category}</p>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                  </div>
                  <button
                    onClick={() => setIsWishlisted(!isWishlisted)}
                    className="w-10 h-10 flex items-center justify-center border border-gray-200 hover:border-gray-700 rounded-full transition-colors cursor-pointer shrink-0 ml-4"
                  >
                    <i className={`${isWishlisted ? 'ri-heart-fill text-red-600' : 'ri-heart-line text-gray-700'} text-lg`}></i>
                  </button>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-baseline space-x-3">
                    {hasVariants && !selectedVariant ? (
                      <span className="text-2xl font-bold text-gray-900">
                        From GH₵{money(minVariantPrice)}
                      </span>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">GH₵{money(activePrice)}</span>
                    )}
                    {product.compare_at_price && product.compare_at_price > activePrice && (
                      <span className="text-lg text-gray-400 line-through">GH₵{money(product.compare_at_price)}</span>
                    )}
                  </div>
                  <div className="flex items-center">
                    <div className="flex items-center space-x-1 mr-2">
                      <i className="ri-star-fill text-amber-400 text-sm"></i>
                      <span className="text-gray-700 font-medium text-sm">{Number(product.rating).toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 leading-relaxed mb-6 text-sm">{product.description}</p>

                {/* Product Option Selectors */}
                {allOptionLabels.filter(o => o.values.length > 0).some(o => o.isColor) && (
                  <div className="mb-5">
                    {allOptionLabels.filter(o => o.values.length > 0 && o.isColor).map((opt) => {
                      const selected = selectedOptions[opt.name];
                      return (
                        <div key={opt.name}>
                          <div className="flex items-center justify-between mb-2">
                            <label className="font-semibold text-gray-900 text-sm">
                              {opt.name}
                              {selected
                                ? <span className="font-normal text-gray-600 ml-2">{selected.split('|')[0]}</span>
                                : <span className="text-red-500 font-normal text-xs ml-2">Required</span>
                              }
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {opt.values.map((val: string) => {
                              const [colorName, hexFromVal] = val.split('|');
                              const plain = (colorName || val).trim();
                              const hex = hexFromVal || product.colorHexMap?.[plain] || colorNameToHex(plain);
                              const isSelected = selected === plain || selected === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleOptionSelect(opt.name, val)}
                                  className="group relative flex flex-col items-center gap-1 cursor-pointer"
                                  title={plain}
                                >
                                  <span
                                    className={`w-9 h-9 rounded-full border-2 transition-all ${
                                      isSelected ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2' : 'border-gray-300 hover:border-gray-500'
                                    }`}
                                    style={{ backgroundColor: hex || '#d1d5db' }}
                                  />
                                  <span className="text-[10px] text-gray-600 max-w-[4.5rem] truncate">{plain}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Non-color options in a 2-column grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-6">
                  {allOptionLabels.filter(o => o.values.length > 0 && !o.isColor).map((opt) => {
                    const selected = selectedOptions[opt.name];
                    return (
                      <div key={opt.name}>
                        <label className="block font-semibold text-gray-900 mb-1.5 text-sm">
                          {opt.name}
                        </label>
                        <div className="relative">
                          <select
                            value={selected || ''}
                            onChange={(e) => handleOptionSelect(opt.name, e.target.value)}
                            className={`w-full appearance-none bg-white border text-gray-900 py-2.5 px-3 pr-8 rounded-md font-medium text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors cursor-pointer hover:border-gray-400 border-gray-300`}
                          >
                            <option value="" disabled>Select {opt.name}</option>
                            {opt.values.map((val: string) => (
                              <option key={val} value={val}>
                                {val}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
                            <i className="ri-arrow-down-s-line text-lg"></i>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fallback: legacy variant selector when no option groups could be built */}
                {hasVariants && allOptionLabels.every(o => o.values.length === 0) && (
                  <div className="mb-6">
                    <label className="block font-semibold text-gray-900 mb-2 text-sm">
                      Options
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant: any) => {
                        const isSelected = selectedVariant?.id === variant.id;
                        const variantStock = asNumber(variant.stock ?? variant.quantity);
                        const isOutOfStock = variantStock === 0;
                        return (
                          <button
                            key={variant.id || variant.name}
                            type="button"
                            onClick={() => setSelectedVariant(variant)}
                            disabled={isOutOfStock}
                            className={`px-4 py-2 rounded-md border font-medium text-sm transition-all cursor-pointer flex flex-col items-center ${
                              isSelected
                                ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                                : isOutOfStock
                                  ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                  : 'border-gray-300 text-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <span>{variant.name}</span>
                            {hasVariants && (
                              <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-gray-200' : 'text-gray-500'}`}>
                                GH₵{money(variant.price)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity and Actions Inline */}
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <div className="flex items-center border border-gray-300 rounded-md h-12 w-32 shrink-0">
                    <button
                      onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                      className="w-10 h-full flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      disabled={activeStock === 0 || quantity <= (product.moq || 1)}
                    >
                      <i className="ri-subtract-line"></i>
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(product.moq || 1, Math.min(activeStock, parseInt(e.target.value) || (product.moq || 1))))}
                      className="w-12 h-full text-center border-x border-gray-300 focus:outline-none text-base font-semibold"
                      min={product.moq || 1}
                      max={activeStock}
                      disabled={activeStock === 0}
                    />
                    <button
                      onClick={() => setQuantity(Math.min(activeStock, quantity + 1))}
                      className="w-10 h-full flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      disabled={activeStock === 0}
                    >
                      <i className="ri-add-line"></i>
                    </button>
                  </div>

                  <button
                    disabled={activeStock === 0 || needsVariantSelection}
                    className={`flex-1 h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-md font-semibold transition-colors flex items-center justify-center space-x-2 text-base whitespace-nowrap cursor-pointer ${(activeStock === 0 || needsVariantSelection) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleAddToCart}
                  >
                    <i className="ri-shopping-cart-line"></i>
                    <span>{activeStock === 0 ? 'Out of Stock' : needsVariantSelection ? 'Select Options' : 'Add to Cart'}</span>
                  </button>
                  
                  {activeStock > 0 && !needsVariantSelection && (
                    <button
                      onClick={handleBuyNow}
                      className="h-12 bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Buy Now
                    </button>
                  )}
                </div>

                {/* Stock Status */}
                <div className="flex items-center gap-4 mb-6 text-sm">
                  {product.moq > 1 && (
                    <span className="text-gray-600">
                      <i className="ri-information-line mr-1"></i>Min: {product.moq}
                    </span>
                  )}
                  {activeStock > 10 ? (
                    <span className="text-green-600 font-medium">
                      <i className="ri-checkbox-circle-line mr-1"></i>In Stock
                    </span>
                  ) : activeStock > 0 ? (
                    <span className="text-amber-600 font-medium">
                      <i className="ri-error-warning-line mr-1"></i>Only {activeStock} left
                    </span>
                  ) : (
                    <span className="text-red-600 font-medium">
                      <i className="ri-close-circle-line mr-1"></i>Out of Stock
                    </span>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-5 space-y-3">
                  <div className="flex items-center text-gray-700">
                    <i className="ri-store-2-line text-xl text-gray-700 mr-3"></i>
                    <span>Free store pickup available</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <i className="ri-arrow-left-right-line text-xl text-gray-700 mr-3"></i>
                    <span>24-hour return policy for faulty/damaged/wrong items—see Refund Policy</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <i className="ri-shield-check-line text-xl text-gray-700 mr-3"></i>
                    <span>Secure payment & buyer protection</span>
                  </div>
                  {product.sku && (
                    <div className="flex items-center text-gray-700">
                      <i className="ri-barcode-line text-xl text-gray-700 mr-3"></i>
                      <span>SKU: {product.sku}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="border-b border-gray-300 mb-8">
              <div className="flex space-x-8">
                {['description', 'features', 'care', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 font-semibold transition-colors relative whitespace-nowrap cursor-pointer ${activeTab === tab
                      ? 'text-gray-700 border-b-2 border-gray-700'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <p className="text-gray-700 text-lg leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'features' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h3>
                <ul className="grid md:grid-cols-2 gap-4">
                  {product.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <i className="ri-checkbox-circle-fill text-gray-700 text-xl mr-3 mt-1"></i>
                      <span className="text-gray-700 text-lg">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'care' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Care Instructions</h3>
                <p className="text-gray-700 text-lg leading-relaxed">{product.care}</p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div id="reviews">
                <ProductReviews productId={product.id} />
              </div>
            )}
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="py-20 bg-white" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">You May Also Like</h2>
                <p className="text-lg text-gray-600">Curated recommendations based on this product</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} {...p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
