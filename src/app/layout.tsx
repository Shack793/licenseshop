import './globals.css';

const siteUrl = process.env.NEXTAUTH_URL || 'https://blackjacklab.us';
const description =
  'Hi-Opt II blackjack trainer & table assistant: track the shoe, running and true count, ace side count and the correct play for every hand. 3-day free trial, $19.99 lifetime license.';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Hi-Opt II Counter — Hi-Opt II Blackjack Trainer & Table Assistant',
  description,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Hi-Opt II Counter',
    description,
    url: siteUrl,
    siteName: 'Hi-Opt II Counter',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Hi-Opt II Counter', description, images: ['/og.png'] },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f231c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
