import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";

const bodySans = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const headingSerif = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inner Garden Photo Queue",
  description:
    "Streamlined holiday photo queue for the Inner Garden Christmas party.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bodySans.variable} ${headingSerif.variable} antialiased bg-ig-forest text-ig-ink`}
      >
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#174730,#0f291d_45%),linear-gradient(135deg,#1d5a42,#0b2416)] text-ig-ink">
          {children}
        </div>
      </body>
    </html>
  );
}
