import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Clock,
  Download,
  MoreHorizontal,
  Share,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { useRouter } from "next/router";

const VideoInfo = ({ video }: any) => {
  const router = useRouter();
  const [likes, setlikes] = useState(video.Like || 0);
  const [dislikes, setDislikes] = useState(video.Dislike || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const { user, togglePlan } = useUser();
  const [isWatchLater, setIsWatchLater] = useState(false);

  const handleCreateWatchParty = () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/watch-party/${roomId}?videoId=${video._id}`);
  };

  const handleDownload = async () => {
    if (!user) {
      alert("Please login / sign in first to download videos.");
      return;
    }

    try {
      // NOTE: userPlan is intentionally NOT sent — the backend looks it up
      // from the database to prevent plan spoofing (Req #15)
      const res = await axiosInstance.post("/api/downloads", {
        userId:  user._id,
        videoId: video._id,
        // userPlan: DO NOT send — server fetches from DB
      });

      if (res.data) {
        // Use NEXT_PUBLIC_ prefixed var so it's available in the browser (Req #4)
        const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const videoUrl = `${backendBase}/${video.filepath}`;

        const link = document.createElement("a");
        link.href = videoUrl;
        link.setAttribute("download", `${video.videotitle || "video"}.mp4`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const remaining = res.data.remainingToday ?? "?";
        const plan = (res.data.userPlan || user.plan || "free").toUpperCase();
        alert(`✅ Download started!\nPlan: ${plan} | Remaining today: ${remaining}`);
      }
    } catch (error: any) {
      console.error(error);
      if (error.response?.status === 403) {
        const msg = error.response.data.error || "Daily download limit reached.";
        const upgrade = window.confirm(`${msg}\n\nGo to Upgrade page?`);
        if (upgrade) router.push("/upgrade");
      } else if (error.response?.status === 401) {
        alert("Authentication required. Please log in again.");
      } else {
        alert("Download failed. Please try again.");
      }
    }
  };

  // const user: any = {
  //   id: "1",
  //   name: "John Doe",
  //   email: "john@example.com",
  //   image: "https://github.com/shadcn.png?height=32&width=32",
  // };
  useEffect(() => {
    setlikes(video.Like || 0);
    setDislikes(video.Dislike || 0);
    setIsLiked(false);
    setIsDisliked(false);
  }, [video]);

  useEffect(() => {
    const handleviews = async () => {
      if (user) {
        try {
          return await axiosInstance.post(`/history/${video._id}`, {
            userId: user?._id,
          });
        } catch (error) {
          return console.log(error);
        }
      } else {
        return await axiosInstance.post(`/history/views/${video?._id}`);
      }
    };
    handleviews();
  }, [user]);
  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });
      if (res.data.liked) {
        if (isLiked) {
          setlikes((prev: any) => prev - 1);
          setIsLiked(false);
        } else {
          setlikes((prev: any) => prev + 1);
          setIsLiked(true);
          if (isDisliked) {
            setDislikes((prev: any) => prev - 1);
            setIsDisliked(false);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleWatchLater = async () => {
    try {
      const res = await axiosInstance.post(`/watch/${video._id}`, {
        userId: user?._id,
      });
      if (res.data.watchlater) {
        setIsWatchLater(!isWatchLater);
      } else {
        setIsWatchLater(false);
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleDislike = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });
      if (!res.data.liked) {
        if (isDisliked) {
          setDislikes((prev: any) => prev - 1);
          setIsDisliked(false);
        } else {
          setDislikes((prev: any) => prev + 1);
          setIsDisliked(true);
          if (isLiked) {
            setlikes((prev: any) => prev - 1);
            setIsLiked(false);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{video.videotitle}</h1>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-10 h-10">
            <AvatarFallback>{video.videochanel?.[0] || "C"}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">{video.videochanel}</h3>
            <p className="text-xs text-gray-500">1.2M subscribers</p>
            {user && (
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${user.plan === 'premium' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
                  Plan: {user.plan || "free"}
                </span>
                <button onClick={togglePlan} className="text-violet-600 hover:underline">
                  (Toggle Plan)
                </button>
              </div>
            )}
          </div>
          <Button className="ml-auto sm:ml-4 text-xs h-8 px-3">Subscribe</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center bg-gray-100 rounded-full">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-l-full"
              onClick={handleLike}
            >
              <ThumbsUp
                className={`w-5 h-5 mr-2 ${
                  isLiked ? "fill-black text-black" : ""
                }`}
              />
              {likes.toLocaleString()}
            </Button>
            <div className="w-px h-6 bg-gray-300" />
            <Button
              variant="ghost"
              size="sm"
              className="rounded-r-full"
              onClick={handleDislike}
            >
              <ThumbsDown
                className={`w-5 h-5 mr-2 ${
                  isDisliked ? "fill-black text-black" : ""
                }`}
              />
              {dislikes.toLocaleString()}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`bg-gray-100 rounded-full ${
              isWatchLater ? "text-primary" : ""
            }`}
            onClick={handleWatchLater}
          >
            <Clock className="w-5 h-5 mr-2" />
            {isWatchLater ? "Saved" : "Watch Later"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="bg-gray-100 rounded-full"
          >
            <Share className="w-5 h-5 mr-2" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="bg-gray-100 rounded-full hover:bg-gray-200 transition"
          >
            <Download className="w-5 h-5 mr-2" />
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateWatchParty}
            className="bg-gray-100 rounded-full hover:bg-gray-200 transition text-violet-600 font-semibold flex items-center"
          >
            🎉 Create Watch Party
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-gray-100 rounded-full"
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div className="bg-gray-100 rounded-lg p-4">
        <div className="flex gap-4 text-sm font-medium mb-2">
          <span>{video.views.toLocaleString()} views</span>
          <span>{formatDistanceToNow(new Date(video.createdAt))} ago</span>
        </div>
        <div className={`text-sm ${showFullDescription ? "" : "line-clamp-3"}`}>
          <p>
            Sample video description. This would contain the actual video
            description from the database.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 p-0 h-auto font-medium"
          onClick={() => setShowFullDescription(!showFullDescription)}
        >
          {showFullDescription ? "Show less" : "Show more"}
        </Button>
      </div>
    </div>
  );
};

export default VideoInfo;
