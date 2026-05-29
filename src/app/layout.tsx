import type { Metadata } from "next";
import { Source_Serif_4, DM_Sans } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AlboMonitor Bedollo – Albo Pretorio Semplificato",
  description:
    "Monitora automaticamente l'albo pretorio del comune di Bedollo. Ricevi riassunti AI dei nuovi bandi direttamente nella tua email.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${sourceSerif.variable} ${dmSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
