import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Our Show',
  description: 'Find something we all want to watch.',
  icons: { icon: '/artwork/icons/sprout.svg' }
};

export const viewport: Viewport = { themeColor: '#fbf6ed' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
