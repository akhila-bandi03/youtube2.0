import React, { useState } from "react";
import { Button } from "./ui/button";
const tabs = [
  { id: "home", label: "Home" },
  { id: "videos", label: "Videos" },
  { id: "shorts", label: "Shorts" },
  { id: "playlists", label: "Playlists" },
  { id: "community", label: "Community" },
  { id: "about", label: "About" },
];
const Channeltabs = ({ activeTab, setActiveTab }: any) => {
  return (
    <div className="border-b px-4 border-slate-200 dark:border-slate-800">
      <div className="flex gap-8 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            className={`px-0 py-4 border-b-2 rounded-none font-medium text-sm transition-all duration-200 ${
              activeTab === tab.id
                ? "border-violet-600 text-violet-600 dark:text-violet-400"
                : "border-transparent text-slate-500 hover:text-slate-950 dark:hover:text-slate-100"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Channeltabs;
