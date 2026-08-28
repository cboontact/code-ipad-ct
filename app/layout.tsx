import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/noto-sans-thai";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import "./globals.css";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

config.autoAddCss = false;

export async function generateMetadata():Promise<Metadata>{
  const requestHeaders=await headers(),host=requestHeaders.get("x-forwarded-host")??requestHeaders.get("host")??"localhost:3000",protocol=requestHeaders.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https"),origin=`${protocol}://${host}`;
  const title="ระบบลงทะเบียนรับ iPad ยืมเรียนฟรี สำหรับครูและนักเรียนโรงเรียนจอมทอง",description="ระบบลงทะเบียนรับ iPad ยืมเรียนฟรี ภายใต้โครงการ Anywhere Anytime โรงเรียนจอมทอง";
  const socialImage=`${origin}/og-registration-2026-v3.png`;
  return {title:{default:title,template:"%s | โรงเรียนจอมทอง"},description,icons:{icon:"/api/public/logo",shortcut:"/api/public/logo"},openGraph:{url:origin,siteName:"ระบบลงทะเบียนรับ iPad ยืมเรียน",title,description,type:"website",locale:"th_TH",images:[{url:socialImage,width:1200,height:630,alt:title}]},twitter:{card:"summary_large_image",title,description,images:[socialImage]}};
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
