import './globals.css';

export const metadata = {
  title: 'Shoepilot Pro',
  description: 'License and download Shoepilot Pro',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
