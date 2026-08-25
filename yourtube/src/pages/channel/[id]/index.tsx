import ChannelHeader from "@/components/ChannelHeader";
import Channeltabs from "@/components/Channeltabs";
import ChannelVideos from "@/components/ChannelVideos";
import VideoUploader from "@/components/VideoUploader";
import VideoCard from "@/components/videocard";
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
  const [activeTab, setActiveTab] = useState("home");

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
    try {
      const res = await axiosInstance.get("/video/getall");
      if (res.data && Array.isArray(res.data)) {
        const channelVideos = res.data.filter(
          (v: any) => v.uploader === id || v.uploader === user?._id
        );
        setVideos(channelVideos);
        // Automatically switch to the correct tab based on upload format
        setActiveTab("home");
      }
    } catch (error) {
      console.error("Error refreshing channel videos:", error);
    }
  };

  const channel = user;

  // Separate Videos and Shorts
  const regularVideos = videos.filter((v: any) => !v.videotitle?.toLowerCase().includes("#shorts"));
  const shortsVideos = videos.filter((v: any) => v.videotitle?.toLowerCase().includes("#shorts"));

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          <span className="ml-3 text-slate-500 dark:text-slate-400 font-medium">Loading content...</span>
        </div>
      );
    }

    switch (activeTab) {
      case "home":
        return (
          <div className="space-y-12">
            {/* Uploads Shelf */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>🎥 Uploads</span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-normal">
                    {regularVideos.length}
                  </span>
                </h2>
                {regularVideos.length > 4 && (
                  <button onClick={() => setActiveTab("videos")} className="text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
                    See all
                  </button>
                )}
              </div>
              {regularVideos.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm italic">No video uploads yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {regularVideos.slice(0, 4).map((video: any) => (
                    <VideoCard key={video._id} video={video} />
                  ))}
                </div>
              )}
            </div>

            {/* Shorts Shelf */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>📱 Shorts</span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-normal">
                    {shortsVideos.length}
                  </span>
                </h2>
                {shortsVideos.length > 6 && (
                  <button onClick={() => setActiveTab("shorts")} className="text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
                    See all
                  </button>
                )}
              </div>
              {shortsVideos.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm italic">No Shorts uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {shortsVideos.slice(0, 6).map((video: any) => (
                    <VideoCard key={video._id} video={video} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "videos":
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Uploads</h2>
            </div>
            {regularVideos.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                <div className="text-5xl mb-4">🎥</div>
                <p className="text-lg font-medium mb-1">No videos yet</p>
                <p className="text-sm">Upload your first video above to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {regularVideos.map((video: any) => (
                  <VideoCard key={video._id} video={video} />
                ))}
              </div>
            )}
          </div>
        );

      case "shorts":
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Shorts</h2>
            </div>
            {shortsVideos.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                <div className="text-5xl mb-4">📱</div>
                <p className="text-lg font-medium mb-1">No Shorts yet</p>
                <p className="text-sm">Select "YouTube Short" when uploading to see it here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {shortsVideos.map((video: any) => (
                  <VideoCard key={video._id} video={video} />
                ))}
              </div>
            )}
          </div>
        );

      case "playlists":
      case "community":
        return (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            <div className="text-5xl mb-4">📁</div>
            <p className="text-lg font-medium mb-1">Coming Soon</p>
            <p className="text-sm">We are cooking this feature for your channel!</p>
          </div>
        );

      case "about":
        return (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Description</h3>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {channel?.description || "No description provided for this channel yet."}
              </p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Stats</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>Joined: {new Date(channel?.createdAt || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</li>
                <li>Total Uploads: {videos.length} videos</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-full mx-auto">
        <ChannelHeader channel={channel} user={user} />
        <Channeltabs activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="px-4 py-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/30">
          <VideoUploader
            channelId={id}
            channelName={channel?.channelname}
            onUploadSuccess={handleUploadSuccess}
          />
        </div>
        <div className="px-6 py-8">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default index;
