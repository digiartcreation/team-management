import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digiart Creation",
  description: "Digiart Creation dashboard",
  icons: {
    icon: "/digiart-logo.jpg",
    shortcut: "/digiart-logo.jpg",
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
