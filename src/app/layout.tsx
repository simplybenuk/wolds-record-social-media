import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: {
    default: "Wolds Social Studio",
    template: "%s | Wolds Social Studio",
  },
  description: "Create and review Wolds Record social campaigns locally.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <header className="site-header">
          <div className="site-shell">
            <p className="brand-name">Wolds Social Studio</p>
          </div>
        </header>
        <main className="site-shell page-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
