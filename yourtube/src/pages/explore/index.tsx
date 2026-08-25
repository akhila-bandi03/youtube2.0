import React, { useState } from "react";
import CategoryTabs from "@/components/category-tabs";
import Videogrid from "@/components/Videogrid";
import { Compass } from "lucide-react";

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <main className="flex-1 p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Explore Trending</h1>
          <p className="text-xs text-slate-500">Discover popular and trending videos across all genres</p>
        </div>
      </div>

      <CategoryTabs activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
      <Videogrid activeCategory={activeCategory} />
    </main>
  );
}
