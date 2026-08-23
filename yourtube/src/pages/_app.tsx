import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { UserProvider } from "../lib/AuthContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-white dark:bg-slate-950 text-black dark:text-white transition-colors">
        <title>YourTube</title>
        <Header />
        <Toaster />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 w-full pb-16 md:pb-0 min-w-0">
            <Component {...pageProps} />
          </div>
        </div>
        <MobileNav />
      </div>
    </UserProvider>
  );
}
