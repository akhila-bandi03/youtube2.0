import CategoryTabs from "@/components/category-tabs";
import Videogrid from "@/components/Videogrid";
import React, { useState } from "react";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <main className="flex-1 p-4">
      <CategoryTabs activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
      <Videogrid activeCategory={activeCategory} />
    </main>
  );
}
