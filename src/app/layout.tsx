import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "GCO Office Management",
  description: "Guidance & Counseling Office - Laguna State Polytechnic University",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GCO System" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#1e3a8a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-screen flex flex-col font-sans antialiased safe-area-padding">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
