// src/app/layout.tsx
'use client';

import React from "react";
import { AuthProvider } from "context/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ChatToggle from "./components/ChatToggle"; // ✅ added here
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>autobooks finance</title>
      </head>
      <body
        className="bg-cover bg-center bg-no-repeat min-h-screen"
        style={{ backgroundImage: "url('/images/bg.jpg')" }}
      >
        <div className="bg-black bg-opacity-40 min-h-screen relative">
          <AuthProvider>
            <Header />
            <main className="layoutMain">{children}</main>
            <Footer />

            {/*  Single floating bot globally */}
            <ChatToggle />
          </AuthProvider>
        </div>

        <Analytics />
      </body>
    </html>
  );
}
