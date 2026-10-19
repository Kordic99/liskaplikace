import type { Metadata,Viewport } from "next";
import "./archive.css";

export const metadata: Metadata = {
  title: "Dračí archiv · Tvá soukromá knihovna",
  description: "Místo pro tvé knihy, příští dobrodružství a myšlenky mezi řádky.",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"Dračí archiv",statusBarStyle:"black-translucent"},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple:"/apple-touch-icon.png",
  },
};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#141214"};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}
