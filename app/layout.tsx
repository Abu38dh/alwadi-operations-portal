import type React from "react"
import { RequestProvider } from "@/contexts/request-context"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import "./globals.css"

const cairo = Cairo({ subsets: ["arabic"] })

export const metadata: Metadata = {
  title: "شركة الوادي لقطع غيار السيارات - نظام المعاملات",
  description: "نظام إدارة المعاملات الإلكترونية والعمليات الإدارية - شركة الوادي لقطع غيار السيارات",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/* <CHANGE> Added Cairo font for Arabic support and RTL direction */}
      <body suppressHydrationWarning className={`${cairo.className} font-sans antialiased bg-background text-foreground`}>
        <RequestProvider>
          {children}
          <Toaster />
          <SonnerToaster />
        </RequestProvider>
      </body>
    </html>
  )
}

