import type { Metadata } from "next";
import localFont from "next/font/local";
import { Orbitron } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import Header from "@/components/Header";
import ChatBox from "@/components/ChatBox";
import { Analytics } from "@vercel/analytics/next";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "AutoMon - Monster Battling on Monad",
  description: "Collect monster cards, battle for MON wagers, let AI play for you",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased bg-gray-950 text-white min-h-screen`}
      >
        <WalletProvider>
          <Header />
          <main>{children}</main>
          <ChatBox />
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
