import ChannelHeader from "@/components/ChannelHeader";
import Channeltabs from "@/components/Channeltabs";
import ChannelVideos from "@/components/ChannelVideos";
import VideoUploader from "@/components/VideoUploader";
import { useUser } from "@/lib/AuthContext";
import { useRouter } from "next/router";
import axiosInstance from "@/lib/axiosinstance";
import React, { useEffect, useState } from "react";

const index = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();

  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannelVideos = async () => {
      if (!id) return;
      try {
        const res = await axiosInstance.get("/video/getall");
        if (res.data && Array.isArray(res.data)) {
          // Filter videos uploaded by this channel owner
          const channelVideos = res.data.filter(
            (v: any) => v.uploader === id || v.uploader === user?._id
          );
          setVideos(channelVideos);
        }
      } catch (error) {
        console.error("Error fetching channel videos:", error);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelVideos();
  }, [id, user]);

  const handleUploadSuccess = async () => {
    // Refresh videos after a new upload
    try {
      const res = await axiosInstance.get("/video/getall");
      if (res.data && Array.isArray(res.data)) {
        const channelVideos = res.data.filter(
          (v: any) => v.uploader === id || v.uploader === user?._id
        );
        setVideos(channelVideos);
      }
    } catch (error) {
      console.error("Error refreshing channel videos:", error);
    }
  };

  const channel = user;

  return (
    <div className="flex-1 min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-full mx-auto">
        <ChannelHeader channel={channel} user={user} />
        <Channeltabs />
        <div className="px-4 pb-8">
          <VideoUploader
            channelId={id}
            channelName={channel?.channelname}
            onUploadSuccess={handleUploadSuccess}
          />
        </div>
        <div className="px-4 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
              <span className="ml-3 text-slate-500 dark:text-slate-400">Loading videos...</span>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <div className="text-5xl mb-4">🎬</div>
              <p className="text-lg font-medium mb-1">No videos yet</p>
              <p className="text-sm">Upload your first video above to get started!</p>
            </div>
          ) : (
            <ChannelVideos videos={videos} />
          )}
        </div>
      </div>
    </div>
  );
};

export default index;
