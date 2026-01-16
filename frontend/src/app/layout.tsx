import type { Metadata } from 'next';
import { Space_Grotesk, Poppins } from 'next/font/google';
import '@/app/globals.css';
import PrivyProviderWrapper from '@/components/providers/PrivyProviderWrapper';
import QueryProvider from '@/components/providers/QueryProvider';

const poppinsFont = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ninah',
  description: 'Private Payment For Rupiah',
  other: {
    'base:app_id': '6969328a8b0e0e7315e206fd',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className='dark' suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${poppinsFont.variable} antialiased`} suppressHydrationWarning>
        <QueryProvider>
          <PrivyProviderWrapper>{children}</PrivyProviderWrapper>
        </QueryProvider>
      </body>
    </html>
  );
}
