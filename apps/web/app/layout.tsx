import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = {
  title: 'GRS Signal · Procurement intelligence',
  description: 'The opportunities worth your attention.',
  icons: { icon: '/guided-reach-mark.png' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
