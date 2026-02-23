import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ClinicOS Admin Portal",
  description: "Clinic queue management for staff",
  icons: {
    icon: "/CinicOS_Icon_.ico",
    apple: "/ClinicOS_icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
