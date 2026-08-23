"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";

// Plan limits for quota display
const PLAN_LIMITS: Record<string, number> = {
  free: 1, bronze: 3, silver: 5, gold: 50, premium: 10
};

export default function DownloadsContent() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  // Use NEXT_PUBLIC_ env var — works in browser (Req #4 fix)
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    if (user) loadDownloads();
  }, [user]);

  const loadDownloads = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get(`/api/downloads/${user._id}`, {
        headers: { "x-user-id": user._id }
      });
      // Handle new API shape: { downloads: [...], todayCount: N }
      if (res.data?.downloads) {
        setDownloads(res.data.downloads);
        setTodayCount(res.data.todayCount || 0);
      } else {
        // Fallback for old array shape
        setDownloads(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error("Error loading downloads:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Download className="w-16 h-16 mx-auto text-gray-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access your offline library</h2>
        <p className="text-gray-500">Sign in to view your downloaded videos.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-slate-400 py-6 animate-pulse">Loading downloads...</div>;
  }

  const plan      = (user.plan || "free") as string;
  const planLimit = PLAN_LIMITS[plan] ?? 1;
  const remaining = Math.max(0, planLimit - todayCount);

  return (
    <div className="space-y-4">
      {/* Header with quota indicator */}
      <div className="flex flex-wrap justify-between items-center pb-3 border-b border-slate-800 gap-2">
        <p className="text-sm text-slate-400">{downloads.length} total downloads</p>
        <div className="flex items-center gap-3">
          {/* Daily quota remaining */}
          <div className={`text-xs px-3 py-1 rounded-full font-semibold border ${
            remaining === 0
              ? "bg-red-950/40 border-red-800/50 text-red-400"
              : "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
          }`}>
            {remaining === 0
              ? "⛔ Daily limit reached"
              : `⬇️ ${remaining} download${remaining === 1 ? "" : "s"} left today`}
          </div>
          <span className="text-xs px-2.5 py-1 bg-violet-950 text-violet-400 border border-violet-800/50 rounded-full font-bold uppercase">
            {plan} Plan
          </span>
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Download className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No downloaded videos yet</h2>
          <p className="text-gray-500">Videos you download will appear here for offline access.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((item) => {
            const video = item.videoId;   // populated from DB
            const title = video?.videotitle || item.videoTitle || "Unknown Video";
            const channel = video?.videochanel || "Unknown Channel";
            const filepath = video?.filepath;

            return (
              <div
                key={item._id}
                className="flex gap-4 group p-2 rounded-lg hover:bg-slate-900/30 transition border border-transparent hover:border-slate-800/50"
              >
                {/* Thumbnail — link to watch page */}
                {video ? (
                  <Link href={`/watch/${video._id}`} className="flex-shrink-0">
                    <div className="relative w-40 aspect-video bg-black rounded-lg overflow-hidden">
                      {filepath ? (
                        <video
                          src={`${backendBase}/${filepath}`}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <Download className="w-8 h-8 text-slate-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                  </Link>
                ) : (
                  // Video was deleted — show fallback
                  <div className="w-40 aspect-video bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-800">
                    <div className="text-center">
                      <Download className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-600">Deleted</span>
                    </div>
                  </div>
                )}

                {/* Download info */}
                <div className="flex-1 min-w-0">
                  {video ? (
                    <Link href={`/watch/${video._id}`}>
                      <h3 className="font-bold text-slate-200 text-sm line-clamp-2 hover:text-blue-400 mb-1 transition-colors">
                        {title}
                      </h3>
                    </Link>
                  ) : (
                    <h3 className="font-bold text-slate-400 text-sm line-clamp-2 mb-1 italic">
                      {title} <span className="text-red-500/70 text-[10px] not-italic">(video removed)</span>
                    </h3>
                  )}

                  <p className="text-xs text-slate-400 font-medium">{channel}</p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800">
                      Plan: <span className="font-bold text-violet-400 uppercase ml-1">{item.userPlan || "free"}</span>
                    </span>
                    <span className="text-slate-600">
                      Downloaded {formatDistanceToNow(new Date(item.downloadedAt))} ago
                    </span>
                    {filepath && (
                      <a
                        href={`${backendBase}/${filepath}`}
                        download={`${title}.mp4`}
                        className="flex items-center gap-1 text-violet-500 hover:text-violet-300 transition font-medium"
                      >
                        <Download className="w-3 h-3" /> Re-download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
