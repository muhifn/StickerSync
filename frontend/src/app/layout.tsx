import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, DM_Mono } from "next/font/google";
import "./globals.css";
import { Cursor } from "@/components/Cursor";
import { GridBackground } from "@/components/GridBackground";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "StickerSync — TikTok comment stickers, straight to WhatsApp",
  description:
    "Paste a TikTok video link, find the stickers people dropped in the comments, and import them into WhatsApp as animated stickers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${dmMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <GridBackground />
        <Cursor />
        {children}
      </body>
    </html>
  );
}
