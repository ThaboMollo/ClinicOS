import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicOS — Patient Queue",
  description: "Join your clinic's queue and track your position in real time.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen">{children}</body>
    </html>
  );
}
