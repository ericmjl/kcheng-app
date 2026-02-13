import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import "./globals.css";
import { ConvexProviderWithWorkOS } from "./components/ConvexProviderWithWorkOS";
import { Nav } from "./components/Nav";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { TripAssistantBubble } from "./components/TripAssistantBubble";
import { getInitialAuth } from "@/lib/workos-auth";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialAuth = await getInitialAuth();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen text-[var(--text)] antialiased`}
        style={{ background: "var(--wall)" }}
      >
        <AuthKitProvider initialAuth={initialAuth}>
          <ConvexProviderWithWorkOS>
            <div className="relative z-10">
              <ServiceWorkerRegister />
              <Nav />
              {children}
            </div>
            <TripAssistantBubble />
          </ConvexProviderWithWorkOS>
        </AuthKitProvider>
      </body>
    </html>
  );
}
