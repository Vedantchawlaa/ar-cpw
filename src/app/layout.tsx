import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CPW CRM",
  description: "Comprehensive management system for CPW.",
};

import { RealtimeObserver } from "@/components/layout/RealtimeObserver";
import AuthProvider from "@/components/providers/AuthProvider";

import { auth } from "@/auth";
import { AIChatbot } from "@/components/shop/AIChatbot";

import { DeadlineReminder } from "@/components/reminders/DeadlineReminder";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={`${inter.className} bg-slate-50`}>
        <AuthProvider session={session}>
          <RealtimeObserver />
          <DeadlineReminder />
          {children}
          <AIChatbot />
        </AuthProvider>
      </body>
    </html>
  );
}
