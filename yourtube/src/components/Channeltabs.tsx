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
const Channeltabs = () => {
  const [activeTab, setActiveTab] = useState("videos");
  return (
    <div className="border-b px-4">
      <div className="flex gap-8 overflow-x-auto">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            className={`px-0 py-4 border-b-2 rounded-none ${
              activeTab === tab.id
                ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
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
