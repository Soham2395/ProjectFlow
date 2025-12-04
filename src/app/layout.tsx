import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/components/auth-provider";
import { OrganizationProvider } from "@/components/organization";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProjectFlow - Modern Project Management",
  description: "A modern, scalable project management tool built with Next.js",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="projectflow-theme"
          enableColorScheme
        >
          <AuthProvider session={session}>
            <OrganizationProvider>
              <div className="relative flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1">{children}</main>
                <footer className="border-t bg-background/50 py-4 text-sm">
                  <div className="container mx-auto flex max-w-7xl items-center justify-between px-4">
                    <div className="text-muted-foreground">
                      © {new Date().getFullYear()} Soham. All rights reserved.
                    </div>
                    <div className="flex items-center gap-4">
                      <a
                        href="https://github.com/Soham2395"
                        className="transition hover:text-foreground text-muted-foreground"
                        target="_blank"
                        rel="noreferrer"
                      >
                        GitHub
                      </a>
                      <a
                        href="https://www.linkedin.com/in/soham-chakraborty-108450255/"
                        className="transition hover:text-foreground text-muted-foreground"
                        target="_blank"
                        rel="noreferrer"
                      >
                        LinkedIn
                      </a>
                    </div>
                  </div>
                </footer>
              </div>
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

