import type { Metadata } from "next";
import "@fontsource-variable/newsreader";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import { AppProvider } from "@/components/app";
export const metadata: Metadata = {
  title: {
    default: "Afterimage — A little less forgotten",
    template: "%s · Afterimage",
  },
  description:
    "Your personal research companion. Follow a thread, keep the idea, come back to what matters.",
  metadataBase: new URL("https://afterimage.aarushagarwal.dev"),
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
