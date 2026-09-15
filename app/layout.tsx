import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { AppProviders } from "@/components/providers";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WorkVibe",
  description: "Customer notifications — templates, workflows, broadcasts and per-subscriber preferences.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  // The workspace list is read by the Admin and User layouts, not here, so the demo
  // password page never receives it. Those layouts resolve this cookie against it.
  const initialWorkspace = store.get("wv_workspace")?.value ?? "";

  // Seed the actor from the cookie only; the client resolves it against the live
  // roster (per workspace) after fetching /api/users, falling back to the first user.
  const initialActor = store.get("wv_actor")?.value ?? "";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full">
        <AppProviders initialWorkspace={initialWorkspace} initialActor={initialActor}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
