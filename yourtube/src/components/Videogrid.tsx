import React, { useEffect, useState } from "react";
import Videocard from "./videocard";
import axiosInstance from "@/lib/axiosinstance";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  music: ["music", "song", "sing", "sound", "audio", "lyric", "beat", "remix", "tune", "podcast", "vdo", "pasta"],
  gaming: ["game", "play", "stream", "twitch", "xbox", "ps5", "gaming", "minecraft", "fortnite"],
  technology: ["tech", "quantum", "database", "developer", "react", "next.js", "code", "rust", "programming", "tutorial", "launch"],
  comedy: ["funny", "laugh", "comedy", "joke", "meme", "prank"],
  news: ["news", "break", "politics", "update", "world"],
  sports: ["sport", "football", "soccer", "basketball", "cricket", "goal", "match"],
  movies: ["movie", "trailer", "cinema", "film", "actor", "review"],
  education: ["learn", "how to", "tutorial", "course", "class", "science", "math", "essential", "guide"],
  science: ["science", "quantum", "physics", "universe", "nature", "space"],
  travel: ["travel", "vlog", "trip", "world", "explore", "nature"],
  food: ["food", "cooking", "recipe", "pasta", "kitchen", "chef", "eat"],
  fashion: ["fashion", "style", "wear", "clothes", "design"],
};

const Videogrid = ({ activeCategory }: { activeCategory: string }) => {
  const [videos, setvideo] = useState<any[]>([]);
  const [loading, setloading] = useState(true);

  useEffect(() => {
    const fetchvideo = async () => {
      try {
        const res = await axiosInstance.get("/video/getall");
        if (res.data && Array.isArray(res.data)) {
          setvideo(res.data);
        } else {
          setvideo([]);
        }
      } catch (error) {
        console.log(error);
      } finally {
        setloading(false);
      }
    };
    fetchvideo();

    // Poll for new videos every 10 seconds to make it real-time
    const interval = setInterval(fetchvideo, 10000);
    return () => clearInterval(interval);
  }, []);

  // 1. Separate regular videos and shorts
  const allRegular = videos.filter((v: any) => !v.videotitle?.toLowerCase().includes("#shorts"));
  const allShorts = videos.filter((v: any) => v.videotitle?.toLowerCase().includes("#shorts"));

  // 2. Filter by Category
  const filterByRules = (list: any[]) => {
    if (activeCategory === "All") return list;
    const keywords = CATEGORY_KEYWORDS[activeCategory.toLowerCase()] || [];
    return list.filter((item: any) => {
      const title = item.videotitle?.toLowerCase() || "";
      const chanel = item.videochanel?.toLowerCase() || "";
      return keywords.some((kw) => title.includes(kw) || chanel.includes(kw));
    });
  };

  const filteredVideos = filterByRules(allRegular);
  const filteredShorts = filterByRules(allShorts);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
        <span className="ml-3 text-slate-500 dark:text-slate-400 font-medium">Loading YouTube...</span>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ─── Regular Videos Grid (First part) ─── */}
      {filteredVideos.length === 0 && filteredShorts.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <p className="text-lg font-medium mb-1">No videos found for "{activeCategory}"</p>
          <p className="text-sm">Try uploading a video or selecting another category.</p>
        </div>
      ) : (
        filteredVideos.length > 0 && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredVideos.map((video: any) => (
                <Videocard key={video._id} video={video} />
              ))}
            </div>
          </div>
        )
      )}

      {/* ─── YouTube Shorts Shelf (Horizontal Scrollable Row) ─── */}
      {filteredShorts.length > 0 && (
        <div className="border-t border-b border-slate-200 dark:border-slate-800 py-6 my-6">
          <div className="flex items-center gap-2 mb-4 px-1">
            {/* Red YouTube Shorts Logo Icon */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-600 fill-current">
              <path d="M17.77,10.32l-1.2-.5a2.48,2.48,0,0,0-3.17,1.24l-1,2.4-1.2-.5A2.47,2.47,0,0,0,8,14.2l1,2.4a2.46,2.46,0,0,0,3.16-1.24l1-2.4,1.2.5A2.48,2.48,0,0,0,17.77,10.32ZM2,12A10,10,0,1,1,12,22,10,10,0,0,1,2,12Z"/>
              <polygon points="10 9 15 12 10 15 10 9" className="text-white fill-current" />
            </svg>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Shorts</h2>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory">
            {filteredShorts.map((short: any) => (
              <div key={short._id} className="w-[180px] sm:w-[200px] shrink-0 snap-start">
                <Videocard video={short} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Videogrid;
