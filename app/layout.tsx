import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LM — Life Management',
  description: 'Your family. Organized.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>{children}</body>
    </html>
  )
}
