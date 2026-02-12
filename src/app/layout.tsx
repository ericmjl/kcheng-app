import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "./components/Nav";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "China Trip Planner",
  description: "Plan your China trip: calendar, contacts, meetings, trains, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen text-[var(--text)] antialiased`}
        style={{ background: "var(--wall)" }}
      >
        <div className="relative z-10">
          <ServiceWorkerRegister />
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
