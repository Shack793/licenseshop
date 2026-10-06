import './globals.css';

export const metadata = {
  title: 'Hi-Opt II Counter',
  description: 'License and download Hi-Opt II Counter',
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
