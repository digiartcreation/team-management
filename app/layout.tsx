import type { Metadata } from "next";
import { LOGO_ICON_DATA_URL } from "@/lib/digiartLogo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digiart Creation",
  description: "Digiart Creation dashboard",
  // The tab icon is the logo's SVG, built in code (lib/digiartLogo.ts) and
  // sharp at any size; older browsers that cannot show one use
  // app/favicon.ico, which Next adds on its own. iPhones need a bitmap for the
  // home screen, so that one stays the JPG.
  icons: {
    icon: { url: LOGO_ICON_DATA_URL, type: "image/svg+xml" },
    apple: "/digiart-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* No next-auth SessionProvider: nothing reads the session in the
          browser (pages get it from auth() on the server), and the provider
          fetched /api/auth/session on every page load and tab switch. */}
      <body>{children}</body>
    </html>
  );
}
