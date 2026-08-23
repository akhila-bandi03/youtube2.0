import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Home, Compass, PlaySquare, Download, Sparkles } from "lucide-react";

export default function MobileNav() {
  const router = useRouter();
  const currentPath = router.pathname;

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Explore", href: "/explore", icon: Compass },
    { label: "Subscriptions", href: "/subscriptions", icon: PlaySquare },
    { label: "Downloads", href: "/downloads", icon: Download },
    { label: "Upgrade", href: "/upgrade", icon: Sparkles, special: true },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
              item.special
                ? "text-violet-600 dark:text-violet-400 font-bold"
                : isActive
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
