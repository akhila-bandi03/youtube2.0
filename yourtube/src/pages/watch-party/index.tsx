import React, { useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Button } from "@/components/ui/button";
import { Users, Play, Link as LinkIcon, Video, Sparkles, Shield } from "lucide-react";
import Head from "next/head";

export default function WatchPartyIndex() {
  const router = useRouter();
  const { user } = useUser();
  const [roomInput, setRoomInput] = useState("");
  const [videoInput, setVideoInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [recentRooms, setRecentRooms] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("watchPartyRooms") || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });

  const saveRoom = (roomId: string) => {
    const updated = [roomId, ...recentRooms.filter((r) => r !== roomId)].slice(0, 5);
    setRecentRooms(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("watchPartyRooms", JSON.stringify(updated));
    }
  };

  const handleCreate = async () => {
    if (!user) {
      alert("Please sign in to create a Watch Party.");
      return;
    }
    setCreating(true);
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Optionally fetch a random video if none specified
    let finalVideoId = videoInput.trim();
    if (!finalVideoId) {
      try {
        const res = await axiosInstance.get("/video/getall");
        const videos = res.data;
        if (videos && videos.length > 0) {
          finalVideoId = videos[Math.floor(Math.random() * videos.length)]._id;
        }
      } catch {
        // proceed without a video pre-loaded
      }
    }

    saveRoom(roomId);
    setCreating(false);
    const query = finalVideoId ? `?videoId=${finalVideoId}` : "";
    router.push(`/watch-party/${roomId}${query}`);
  };

  const handleJoin = () => {
    const trimmed = roomInput.trim().toUpperCase();
    if (!trimmed) {
      alert("Please enter a Room ID to join.");
      return;
    }
    if (!user) {
      alert("Please sign in to join a Watch Party.");
      return;
    }
    setJoining(true);
    saveRoom(trimmed);
    router.push(`/watch-party/${trimmed}`);
  };

  return (
    <>
      <Head>
        <title>Watch Party — YourTubeIN</title>
        <meta
          name="description"
          content="Create or join a Watch Party room to watch videos together with friends in real time. Includes video call, live chat, and screen sharing."
        />
      </Head>

      <main className="flex-1 min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950 text-white p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Hero */}
          <div className="text-center space-y-4 pt-6">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold px-4 py-2 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              Real-time synchronized video watching
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Watch Party
            </h1>
            <p className="text-slate-400 max-w-lg mx-auto text-base">
              Invite friends to watch videos together in real time — with live video calls, chat, screen sharing, and perfectly synced playback.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Create Room Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5 hover:border-violet-700/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Create a Room</h2>
                  <p className="text-xs text-slate-400">Generate a room and invite friends</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Video ID (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Paste a video ID or leave blank for a random video"
                    value={videoInput}
                    onChange={(e) => setVideoInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreate}
                disabled={creating || !user}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {creating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating Room...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    Create Watch Party
                  </>
                )}
              </Button>

              {!user && (
                <p className="text-center text-xs text-amber-500">
                  ⚠️ Please sign in to create a party room.
                </p>
              )}
            </div>

            {/* Join Room Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5 hover:border-indigo-700/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Join a Room</h2>
                  <p className="text-xs text-slate-400">Enter a room ID shared by a friend</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Room ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AB12CD"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                    maxLength={8}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition font-mono tracking-widest uppercase"
                  />
                </div>
              </div>

              <Button
                onClick={handleJoin}
                disabled={joining || !user || !roomInput.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {joining ? (
                  "Joining..."
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Join Watch Party
                  </>
                )}
              </Button>

              {!user && (
                <p className="text-center text-xs text-amber-500">
                  ⚠️ Please sign in to join a party room.
                </p>
              )}
            </div>
          </div>

          {/* Recent Rooms */}
          {recentRooms.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-sm text-slate-300 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-violet-400" />
                Recent Rooms
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentRooms.map((roomId) => (
                  <button
                    key={roomId}
                    onClick={() => {
                      if (!user) return alert("Please sign in first.");
                      router.push(`/watch-party/${roomId}`);
                    }}
                    className="font-mono text-xs bg-slate-800 hover:bg-violet-900/40 border border-slate-700 hover:border-violet-600 text-slate-300 hover:text-violet-300 px-3 py-1.5 rounded-lg transition-all"
                  >
                    #{roomId}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-8">
            {[
              { icon: "🎬", label: "Synced Playback", desc: "Everyone stays in sync" },
              { icon: "💬", label: "Live Chat", desc: "Chat during the show" },
              { icon: "📹", label: "Video Call", desc: "See your friends react" },
              { icon: "🖥️", label: "Screen Share", desc: "Share your screen" },
            ].map((f) => (
              <div
                key={f.label}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center space-y-1"
              >
                <div className="text-2xl">{f.icon}</div>
                <p className="text-xs font-bold text-slate-200">{f.label}</p>
                <p className="text-[10px] text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
