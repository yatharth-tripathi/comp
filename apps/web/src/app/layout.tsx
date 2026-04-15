import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-loaded",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SalesContent AI — Sales enablement that field teams actually use",
    template: "%s · SalesContent AI",
  },
  description:
    "AI-powered, WhatsApp-native sales enablement for Indian BFSI, Insurance, Pharma, and Automotive field teams. Compliance-aware content, role-play coaching, and manager analytics built for the mid-market.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0E1A",
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${manrope.variable} ${jetBrainsMono.variable}`}
      style={{
        /* Bind next/font CSS vars to the names the stylesheet expects */
        ["--font-display" as string]: "var(--font-display-loaded), Georgia, serif",
        ["--font-body" as string]: "var(--font-body-loaded), system-ui, sans-serif",
        ["--font-mono" as string]: "var(--font-mono-loaded), ui-monospace, monospace",
      }}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            {children}
            <Toaster richColors position="top-right" />
            <ServiceWorkerRegister />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
