import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claw Copilot — OpenClaw Deployment Assistant",
  description:
    "AI-powered assistant for deploying OpenClaw agents to Nebius Cloud",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
