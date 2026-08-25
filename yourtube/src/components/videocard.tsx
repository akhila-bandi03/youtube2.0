"use client";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { getBackendUrl } from "@/lib/axiosinstance";

export default function VideoCard({ video }: any) {
  const backendBase = getBackendUrl();
  const isShort = video?.videotitle?.toLowerCase().includes("#shorts");

  if (isShort) {
    // Beautiful vertical style for Shorts (9:16 aspect ratio)
    const cleanTitle = video?.videotitle?.replace(/#shorts/gi, "").trim();
    return (
      <Link href={`/watch/${video?._id}`} className="group block">
        <div className="space-y-2">
          <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-900 shadow-md">
            <video
              src={`${backendBase}/${video?.filepath}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              muted
              playsInline
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
              <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug drop-shadow-md">
                {cleanTitle}
              </h3>
              <p className="text-xs text-slate-300 mt-1 drop-shadow-md">
                {video?.views.toLocaleString()} views
              </p>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Regular Video horizontal layout (16:9 aspect ratio)
  return (
    <Link href={`/watch/${video?._id}`} className="group">
      <div className="space-y-3">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-900">
          <video
            src={`${backendBase}/${video?.filepath}`}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded font-mono">
            10:24
          </div>
        </div>
        <div className="flex gap-3">
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarFallback>{video?.videochanel?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm line-clamp-2 text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
              {video?.videotitle}
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{video?.videochanel}</p>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {video?.views.toLocaleString()} views •{" "}
              {video?.createdAt ? formatDistanceToNow(new Date(video.createdAt)) + " ago" : ""}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
