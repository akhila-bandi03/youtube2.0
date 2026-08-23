import React from "react";
import Videogrid from "@/components/Videogrid";
import { PlaySquare, Sparkles } from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SubscriptionsPage() {
  const { user } = useUser();

  return (
    <main className="flex-1 p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <PlaySquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscriptions</h1>
            <p className="text-xs text-slate-500">Latest uploads from your subscribed channels</p>
          </div>
        </div>

        <Link href="/upgrade">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white text-xs flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Manage Subscription Plans
          </Button>
        </Link>
      </div>

      <div>
        <Videogrid />
      </div>
    </main>
  );
}
