import './globals.css';

export const metadata = {
  title: 'Social Pvot — Multi-Platform Social Media Feed Aggregator',
  description: 'Aggregate your Instagram, Twitter, and Facebook posts into one unified, beautiful feed. Auto-sync every 30 minutes. Filter by platform, search posts, and discover trending hashtags.',
  keywords: 'social media, feed aggregator, Instagram, Twitter, Facebook, SaaS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
