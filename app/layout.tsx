import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: {
    default: "Gymbro's",
    template: "%s · Gymbro's",
  },
  description: 'Track your grind. See your progress.',
  applicationName: "Gymbro's",
  appleWebApp: {
    capable: true,
    title: "Gymbro's",
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#121210' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
