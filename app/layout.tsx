import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://food-preorder.ru"),
  title: "ReFreshTech — ассортимент на следующую неделю",
  description:
    "Анонимно выбирайте товары, которые хотите видеть в ассортименте ReFreshTech на следующей неделе.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "ReFreshTech",
    title: "Выберите ассортимент ReFreshTech на следующую неделю",
    description:
      "Отметьте продукты и готовые блюда, которые хотите видеть в минимаркете. Анонимно и без регистрации.",
    images: [
      {
        url: "/social-preview.png",
        width: 1200,
        height: 630,
        alt: "ReFreshTech — выбирайте ассортимент на следующую неделю",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Выберите ассортимент ReFreshTech на следующую неделю",
    description:
      "Отметьте продукты и готовые блюда, которые хотите видеть в минимаркете.",
    images: ["/social-preview.png"],
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [
      { url: "/brand-favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand-favicon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/brand-favicon-32.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
