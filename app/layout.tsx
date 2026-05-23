import type { Metadata } from "next";
import Script from "next/script";
import { Pacifico, Playfair_Display, Outfit } from "next/font/google";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

const pacifico = Pacifico({ weight: '400', subsets: ['latin'], variable: '--font-pacifico' });
const playfair = Playfair_Display({
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-playfair',
});
const outfit = Outfit({ weight: ['300', '400', '500', '600', '700'], subsets: ['latin'], variable: '--font-outfit' });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.boldnbeautiful.store';
const siteName = 'Bold & Beautiful';
const siteTagline = 'Curated Fashion, Beauty & Home in Takoradi, Ghana';
const siteDescription =
  'Shop curated fashion, beauty, fragrance and home collections at Bold & Beautiful — Takoradi\'s premier lifestyle boutique. Discover elegant pieces for every part of your lifestyle with fast delivery across Ghana.';
const storePhone = '+233241766703';
const storeEmail = 'pobeenina2@gmail.com';
const storeAddress = {
  street: '16 Davis Street, Anaji',
  city: 'Takoradi',
  region: 'Western Region',
  country: 'GH',
  postalCode: 'WS-447-0013',
};
const storeGeo = { latitude: 4.8975, longitude: -1.7550 };

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | ${siteTagline}`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    'Bold and Beautiful Takoradi',
    'Bold & Beautiful Ghana',
    'online fashion store Ghana',
    'boutique Takoradi',
    'fashion store Takoradi',
    'beauty products Takoradi Ghana',
    'perfume shop Ghana',
    'home decor Ghana',
    'lifestyle store Western Region Ghana',
    'designer clothing Ghana',
    'gift shop Takoradi',
    'Anaji boutique Takoradi',
    'fashion boutique Ghana',
    'home and living Ghana',
    'beauty products Ghana',
    'wigs and hair Ghana',
    'fragrance shop Ghana',
  ],
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  category: 'Fashion & Lifestyle',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  manifest: '/manifest.json',
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    url: siteUrl,
    title: `${siteName} | ${siteTagline}`,
    description: siteDescription,
    siteName: siteName,
    images: [
      {
        url: '/og-home.png',
        width: 1200,
        height: 630,
        alt: `${siteName} — Curated Lifestyle Collection Ghana`,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} | ${siteTagline}`,
    description: siteDescription,
    images: [{ url: '/og-home.png', alt: `${siteName} — Curated Lifestyle Collection Ghana` }],
    creator: '@boldnbeautiful',
    site: '@boldnbeautiful',
  },
  alternates: {
    canonical: siteUrl,
  },
  other: {
    'theme-color': '#000000',
    'msapplication-TileColor': '#000000',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': siteName,
    'format-detection': 'telephone=no',
  },
};

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
// Google reCAPTCHA v3 Site Key
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GH">
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        {/* Organization Schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Bold & Beautiful",
          "alternateName": ["Bold and Beautiful", "Bold & Beautiful Takoradi", "Bold and Beautiful Ghana"],
          "url": siteUrl,
          "logo": { "@type": "ImageObject", "url": `${siteUrl}/logo.png`, "width": 1024, "height": 1024 },
          "image": `${siteUrl}/og-home.png`,
          "description": "Takoradi's premier destination for curated fashion, beauty, fragrance and home collections. Located at 16 Davis Street, Anaji.",
          "foundingDate": "2020",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": storeAddress.street,
            "addressLocality": storeAddress.city,
            "addressRegion": storeAddress.region,
            "postalCode": storeAddress.postalCode,
            "addressCountry": storeAddress.country
          },
          "contactPoint": [
            {
              "@type": "ContactPoint",
              "telephone": storePhone,
              "contactType": "customer service",
              "email": storeEmail,
              "availableLanguage": ["English"],
              "areaServed": "GH",
              "hoursAvailable": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "opens": "08:30",
                "closes": "18:00"
              }
            }
          ],
          "sameAs": [],
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Curated Lifestyle Collection",
            "itemListElement": [
              { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Tailored Apparel" } },
              { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Fragrances" } },
              { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Beauty Essentials" } },
              { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "HD Lace Wigs & Hair" } },
              { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Home & Living" } }
            ]
          }
        })}} />

        {/* WebSite Schema with SearchAction */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Bold & Beautiful",
          "alternateName": "Bold and Beautiful",
          "url": siteUrl,
          "description": "Takoradi's premier lifestyle destination — fashion, beauty, fragrance and home collections.",
          "inLanguage": "en-GH",
          "publisher": { "@type": "Organization", "name": "Bold & Beautiful", "url": siteUrl },
          "potentialAction": {
            "@type": "SearchAction",
            "target": { "@type": "EntryPoint", "urlTemplate": `${siteUrl}/shop?search={search_term_string}` },
            "query-input": "required name=search_term_string"
          }
        })}} />

        {/* FAQ Schema for rich results */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "What kind of products does Bold & Beautiful sell?", "acceptedAnswer": { "@type": "Answer", "text": "Bold & Beautiful curates fashion, beauty, fragrance, HD lace wigs and homeware so you can style every part of your life from one place — located at 16 Davis Street, Anaji, Takoradi." } },
            { "@type": "Question", "name": "Do you ship across Ghana?", "acceptedAnswer": { "@type": "Answer", "text": "Yes! We offer fast delivery across all regions of Ghana including Accra, Kumasi, Tamale, Takoradi and more. Free store pickup is also available at our Anaji, Takoradi location." } },
            { "@type": "Question", "name": "Where is Bold & Beautiful located?", "acceptedAnswer": { "@type": "Answer", "text": "Bold & Beautiful is located at 16 Davis Street, Anaji, Takoradi, Western Region, Ghana. Our store is open Tuesday to Saturday, 8:30 AM to 6:00 PM." } },
            { "@type": "Question", "name": "Do you offer styling or gifting advice?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely — our team can recommend outfits, fragrances, wigs, home pieces and gifts that match your taste and budget. Contact us on WhatsApp or visit our store." } },
            { "@type": "Question", "name": "Can I shop both in-store and online?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, you can browse and order online or visit us at 16 Davis Street, Anaji, Takoradi. Your account and orders stay in sync." } },
            { "@type": "Question", "name": "What payment methods do you accept?", "acceptedAnswer": { "@type": "Answer", "text": "We accept Mobile Money (MTN, Vodafone, AirtelTigo), bank transfers, and cash payments at our Takoradi store." } }
          ]
        })}} />

        {/* LocalBusiness / Store Schema — Google My Business optimized */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["Store", "ClothingStore"],
          "@id": `${siteUrl}/#store`,
          "name": "Bold & Beautiful",
          "alternateName": ["Bold and Beautiful", "Bold & Beautiful Takoradi"],
          "description": "Takoradi's premier lifestyle boutique — curated fashion, beauty, fragrance, HD lace wigs and home essentials. Visit us at 16 Davis Street, Anaji or shop online with fast delivery across Ghana.",
          "url": siteUrl,
          "image": [
            `${siteUrl}/og-home.png`,
            `${siteUrl}/logo.png`
          ],
          "logo": `${siteUrl}/logo.png`,
          "telephone": storePhone,
          "email": storeEmail,
          "priceRange": "$$",
          "currenciesAccepted": "GHS",
          "paymentAccepted": "Mobile Money, Bank Transfer, Cash",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": storeAddress.street,
            "addressLocality": storeAddress.city,
            "addressRegion": storeAddress.region,
            "postalCode": storeAddress.postalCode,
            "addressCountry": storeAddress.country
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": storeGeo.latitude,
            "longitude": storeGeo.longitude
          },
          "openingHoursSpecification": [
            {
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
              "opens": "08:30",
              "closes": "18:00"
            }
          ],
          "openingHours": "Tu-Sa 08:30-18:00",
          "areaServed": [
            { "@type": "Country", "name": "Ghana" },
            { "@type": "City", "name": "Takoradi" },
            { "@type": "City", "name": "Sekondi" },
            { "@type": "State", "name": "Western Region" }
          ],
          "hasMap": `https://www.google.com/maps/search/?api=1&query=${storeGeo.latitude},${storeGeo.longitude}`,
          "isAccessibleForFree": true,
          "sameAs": [],
          "potentialAction": {
            "@type": "OrderAction",
            "target": { "@type": "EntryPoint", "urlTemplate": `${siteUrl}/shop` },
            "deliveryMethod": { "@type": "DeliveryMethod", "name": "OnSitePickup" }
          }
        })}} />

        {/* BreadcrumbList Schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": siteUrl },
            { "@type": "ListItem", "position": 2, "name": "Shop", "item": `${siteUrl}/shop` },
            { "@type": "ListItem", "position": 3, "name": "Categories", "item": `${siteUrl}/categories` }
          ]
        })}} />
      </head>

      {/* Google Analytics */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/* Google reCAPTCHA v3 */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      <body className={`antialiased font-sans overflow-x-hidden ${pacifico.variable} ${playfair.variable} ${outfit.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-gray-900 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <CartProvider>
          <WishlistProvider>
            <div id="main-content">
              {children}
            </div>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
