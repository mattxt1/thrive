import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "thrive | a veritas brand",
  description: "modern personal banking for everyone",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              <span className="lowercase">thrive</span> <span className="text-gray-400">|</span>{" "}
              <span className="lowercase text-gray-600">a veritas brand</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/about" className="hover:underline">
                about
              </Link>
              <Link href="/auth/signin" className="rounded-md border px-3 py-1.5 hover:bg-gray-50">
                sign in
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-md bg-black px-3 py-1.5 text-white hover:opacity-90"
              >
                create account
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-gray-500">
          © {new Date().getFullYear()} thrive · a veritas brand
        </footer>
      </body>
    </html>
  );
}
