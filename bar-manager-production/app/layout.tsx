import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EasyMO Bar Manager',
  description: 'Bar Manager Desktop App - Order & Menu Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-gray-900 text-white p-4">
          <div className="container mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold">🍹 EasyMO Bar Manager</h1>
            <div className="flex gap-4">
              <a href="/" className="hover:text-blue-400">Orders</a>
              <a href="/menu" className="hover:text-blue-400">Menu</a>
              <a href="/promos" className="hover:text-blue-400">Promos</a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
