import Comments from "@/components/Comments";
import RelatedVideos from "@/components/RelatedVideos";
import VideoInfo from "@/components/VideoInfo";
import Videopplayer from "@/components/Videopplayer";
import axiosInstance from "@/lib/axiosinstance";
import { notFound } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";

import { useUser } from "@/lib/AuthContext";

const index = () => {
  const router = useRouter();
  const { user } = useUser();
  const { id } = router.query;
  const [videos, setvideo] = useState<any>(null);
  const [video, setvide] = useState<any>(null);
  const [loading, setloading] = useState(true);
  useEffect(() => {
    const fetchvideo = async () => {
      if (!id || typeof id !== "string") return;
      try {
        const res = await axiosInstance.get("/video/getall");
        const video = res.data?.filter((vid: any) => vid._id === id);
        setvideo(video[0]);
        setvide(res.data);
      } catch (error) {
        console.log(error);
      } finally {
        setloading(false);
      }
    };
    fetchvideo();
  }, [id]);
  // const relatedVideos = [
  //   {
  //     _id: "1",
  //     videotitle: "Amazing Nature Documentary",
  //     filename: "nature-doc.mp4",
  //     filetype: "video/mp4",
  //     filepath: "/videos/nature-doc.mp4",
  //     filesize: "500MB",
  //     videochanel: "Nature Channel",
  //     Like: 1250,
  //     Dislike: 50,
  //     views: 45000,
  //     uploader: "nature_lover",
  //     createdAt: new Date().toISOString(),
  //   },
  //   {
  //     _id: "2",
  //     videotitle: "Cooking Tutorial: Perfect Pasta",
  //     filename: "pasta-tutorial.mp4",
  //     filetype: "video/mp4",
  //     filepath: "/videos/pasta-tutorial.mp4",
  //     filesize: "300MB",
  //     videochanel: "Chef's Kitchen",
  //     Like: 890,
  //     Dislike: 20,
  //     views: 23000,
  //     uploader: "chef_master",
  //     createdAt: new Date(Date.now() - 86400000).toISOString(),
  //   },
  // ];
  if (loading) {
    return <div>Loading..</div>;
  }

  const isPremiumLocked = videos.isPremium && (!user || user.plan === "free" || !user.plan);

  if (!videos) {
    return <div>Video not found</div>;
  }
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {isPremiumLocked ? (
              <div className="aspect-video bg-slate-900 text-white rounded-lg flex flex-col items-center justify-center p-6 text-center space-y-4 border border-yellow-500/30 shadow-lg relative overflow-hidden">
                <div className="w-16 h-16 bg-yellow-500/10 text-yellow-400 rounded-full flex items-center justify-center border border-yellow-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-lg font-bold text-yellow-500">⭐ Premium Video Gated</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    This video is exclusive to Bronze, Silver, and Gold subscribers. Upgrade now to watch!
                  </p>
                </div>
                <a href="/upgrade">
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 px-5 py-2 rounded-full font-bold text-xs shadow-md transition duration-200">
                    Upgrade Subscription
                  </button>
                </a>
              </div>
            ) : (
              <Videopplayer
                video={videos}
                nextVideoId={(() => {
                  if (!video || !Array.isArray(video)) return undefined;
                  const currentIndex = video.findIndex((v: any) => v._id === id);
                  if (currentIndex !== -1 && currentIndex < video.length - 1) {
                    return video[currentIndex + 1]._id;
                  }
                  return video[0]?._id; // loop back to first
                })()}
                nextVideoTitle={(() => {
                  if (!video || !Array.isArray(video)) return undefined;
                  const currentIndex = video.findIndex((v: any) => v._id === id);
                  if (currentIndex !== -1 && currentIndex < video.length - 1) {
                    return video[currentIndex + 1].videotitle;
                  }
                  return video[0]?.videotitle; // loop back to first
                })()}
              />
            )}
            <VideoInfo video={videos} />
            <Comments videoId={id as string} />
          </div>
          <div className="space-y-4">
            <RelatedVideos videos={video} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default index;
