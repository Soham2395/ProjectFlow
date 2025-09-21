import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "../globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sign In | ProjectFlow",
  description: "Sign in to your ProjectFlow account",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Do NOT redefine <html> or <body> in nested layouts. This allows
  // the root layout to control ThemeProvider and preserve dark mode.
  return (
    <div className={inter.className}>
      {children}
    </div>
  )
}