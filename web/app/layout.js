import './globals.css';

export const metadata = {
  title: 'Integral Christianity • Bluesky bots',
  description: 'Seven stage-persona feeds (Miracle → Holistic) reacting to the news.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
