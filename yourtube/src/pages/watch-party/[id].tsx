import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import axiosInstance, { getBackendUrl } from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import { io, Socket } from "socket.io-client";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  PhoneOff, 
  Send, 
  Users, 
  Copy, 
  Disc, 
  MessageSquare 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoPlayer, { VideoPlayerRef } from "@/components/Videopplayer";

interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

export default function WatchPartyRoom() {
  const router = useRouter();
  const { id: roomId, videoId } = router.query;
  const { user } = useUser();

  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Call States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Real-time states
  const [socket, setSocket] = useState<Socket | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [id: string]: MediaStream }>({});
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "System", text: "Welcome to the Watch Party! Invite friends by copying the link.", time: "Right now" }
  ]);
  const [inputText, setInputText] = useState("");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const recordingLogsRef = useRef<string[]>(["--- Watch Party Session Started ---"]);

  // Load Video Details
  useEffect(() => {
    const fetchVideo = async () => {
      if (!videoId) return;
      try {
        const res = await axiosInstance.get("/video/getall");
        const match = res.data?.find((vid: any) => vid._id === videoId);
        setVideoData(match);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVideo();
  }, [videoId]);

  // Request Camera & Mic
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Camera/Mic access denied or unavailable", err);
      }
    };
    startMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Socket and WebRTC Signaling
  useEffect(() => {
    if (!roomId || !user) return;
    // Use dedicated Railway socket server — Vercel serverless doesn't support WebSockets
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || getBackendUrl();
    const s = io(socketUrl, { transports: ["websocket", "polling"] });
    setSocket(s);

    s.emit("join-room", roomId, user._id, user.name);

    s.on("user-connected", async (userId, userName) => {
      setMessages(prev => [...prev, { sender: "System", text: `${userName} joined the party.`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      // Create WebRTC Offer
      const peer = createPeer(userId, s, localStream);
      peersRef.current[userId] = peer;
    });

    s.on("user-disconnected", (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setMessages(prev => [...prev, { sender: "System", text: `A user left the party.`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    });

    // Chat
    s.on("chat-message", (msg) => {
      setMessages(prev => [...prev, msg]);
      recordingLogsRef.current.push(`[${msg.time}] ${msg.sender}: ${msg.text}`);
    });

    // Video Sync
    s.on("video-play", (time) => {
      videoPlayerRef.current?.play(time);
    });
    s.on("video-pause", (time) => {
      videoPlayerRef.current?.pause(time);
    });
    s.on("video-seek", (time) => {
      videoPlayerRef.current?.seek(time);
    });

    // WebRTC Signaling
    s.on("offer", async (callerId, offer) => {
      const peer = createPeer(callerId, s, localStream);
      peersRef.current[callerId] = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      s.emit("answer", roomId, callerId, answer);
    });

    s.on("answer", async (callerId, answer) => {
      const peer = peersRef.current[callerId];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    s.on("ice-candidate", async (callerId, candidate) => {
      const peer = peersRef.current[callerId];
      if (peer) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      s.disconnect();
    };
  }, [roomId, user, localStream]);

  // WebRTC Peer creation helper
  const createPeer = (userId: string, s: Socket, stream: MediaStream | null) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        s.emit("ice-candidate", roomId, userId, e.candidate);
      }
    };

    peer.ontrack = (e) => {
      setRemoteStreams(prev => ({ ...prev, [userId]: e.streams[0] }));
    };

    if (stream) {
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
    }

    peer.onnegotiationneeded = async () => {
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        s.emit("offer", roomId, userId, offer);
      } catch (err) {
        console.error(err);
      }
    };

    return peer;
  };

  const handleUserPlay = (time: number) => socket?.emit("video-play", roomId, time);
  const handleUserPause = (time: number) => socket?.emit("video-pause", roomId, time);
  const handleUserSeek = (time: number) => socket?.emit("video-seek", roomId, time);

  const toggleCamera = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsCameraOn(track.enabled);
      }
    } else {
      setIsCameraOn(!isCameraOn);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMicOn(track.enabled);
      }
    } else {
      setIsMicOn(!isMicOn);
    }
  };

  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
        const msg = `System: ${user?.name || "Host"} started screen sharing.`;
        recordingLogsRef.current.push(msg);
        setMessages(prev => [
          ...prev,
          { sender: "System", text: "🖥️ Screen sharing active.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
      } catch (err) {
        console.warn("Screen share cancelled or failed", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    setIsScreenSharing(false);
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    const msg = `System: ${user?.name || "Host"} stopped screen sharing.`;
    recordingLogsRef.current.push(msg);
    setMessages(prev => [
      ...prev,
      { sender: "System", text: "Screen sharing stopped.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      recordingLogsRef.current.push("--- Watch Party Session Stopped ---");
      const element = document.createElement("a");
      const file = new Blob([recordingLogsRef.current.join("\n")], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `watch_party_room_${roomId}_recording.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      alert("Recording complete. Session logs saved to downloads!");
    } else {
      setIsRecording(true);
      recordingLogsRef.current.push(`Recording started at ${new Date().toLocaleString()}`);
      alert("Call recording started! When you stop recording, the session logs will download.");
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;
    const name = user?.name || "Guest User";
    const newMsg = { sender: name, text: inputText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    
    // Optimistic update locally
    setMessages(prev => [...prev, newMsg]);
    recordingLogsRef.current.push(`[${newMsg.time}] ${newMsg.sender}: ${newMsg.text}`);
    
    // Broadcast via socket
    socket.emit("chat-message", roomId, newMsg);
    
    setInputText("");
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Invite link copied to clipboard! Share it with friends.");
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Watch Party Room...</div>;
  }

  return (
    <main className="flex-1 p-3 sm:p-6 bg-slate-900 text-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Top Room Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-violet-400">
              <span>🎉 Watch Party Room</span>
              <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded uppercase">
                ID: {roomId}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Watching: <span className="font-semibold text-slate-200">{videoData?.videotitle || "Loading title..."}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button 
              variant="outline" 
              onClick={copyInviteLink}
              className="text-slate-800 border-slate-700 bg-white hover:bg-slate-100 flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Invite Link
            </Button>
            {isRecording && (
              <span className="flex items-center gap-1 text-xs bg-red-950/60 border border-red-800 text-red-400 px-2.5 py-1 rounded-full animate-pulse">
                <Disc className="w-3.5 h-3.5" />
                ● REC
              </span>
            )}
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Media & Camera Panel */}
          <div className="lg:col-span-3 space-y-6">
            {/* Video Player */}
            {videoData ? (
              <VideoPlayer 
                ref={videoPlayerRef}
                video={videoData} 
                onUserPlay={handleUserPlay}
                onUserPause={handleUserPause}
                onUserSeek={handleUserSeek}
              />
            ) : (
              <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-slate-500">
                Video player placeholder
              </div>
            )}

            {/* Video Call Controls */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button 
                  onClick={toggleMic}
                  className={`rounded-lg p-2.5 h-10 w-10 ${isMicOn ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
                  title={isMicOn ? "Mute Mic" : "Unmute Mic"}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </Button>
                <Button 
                  onClick={toggleCamera}
                  className={`rounded-lg p-2.5 h-10 w-10 ${isCameraOn ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
                  title={isCameraOn ? "Camera Off" : "Camera On"}
                >
                  {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </Button>
                <Button 
                  onClick={toggleScreenShare}
                  className={`rounded-lg p-2.5 h-10 w-10 ${isScreenSharing ? "bg-green-600 hover:bg-green-700 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"}`}
                  title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={toggleRecording}
                  className={`rounded-lg p-2.5 h-10 w-10 ${isRecording ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-slate-800 hover:bg-slate-700 text-white"}`}
                  title={isRecording ? "Stop Recording" : "Record Session"}
                >
                  <Disc className="w-4 h-4" />
                </Button>
              </div>

              <Button 
                onClick={() => router.push(`/watch/${videoId}`)}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1 text-sm font-semibold h-10 px-4"
              >
                <PhoneOff className="w-4 h-4" />
                Leave Call
              </Button>
            </div>

            {/* Video Feeds Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Local Feed Card */}
              <div className="aspect-video bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden flex flex-col justify-end">
                {isCameraOn ? (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-bold bg-slate-950">
                    Camera Off
                  </div>
                )}
                <div className="relative z-10 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[11px] text-white">
                  <span>{user?.name || "You (Host)"}</span>
                  {!isMicOn && <MicOff className="w-3.5 h-3.5 text-red-500" />}
                </div>
              </div>

              {/* Real Remote Participants */}
              {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <div key={peerId} className="aspect-video bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden flex flex-col justify-end">
                  {stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled ? (
                    <video 
                      autoPlay 
                      playsInline 
                      className="absolute inset-0 w-full h-full object-cover"
                      ref={(el) => { if (el) el.srcObject = stream; }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-bold bg-slate-950">
                      Camera Off
                    </div>
                  )}
                  <div className="relative z-10 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[11px] text-white">
                    <span>Participant ({peerId.substring(0,4)})</span>
                    {(stream.getAudioTracks().length === 0 || !stream.getAudioTracks()[0].enabled) && (
                      <MicOff className="w-3.5 h-3.5 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Chat & Participants Side-Panel */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col h-[520px] justify-between">
            <div className="space-y-3 overflow-hidden flex flex-col flex-1">
              {/* Tab Switcher: Chat vs Participants */}
              <div className="flex items-center border-b border-slate-800 pb-2 text-xs font-semibold gap-2">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === "chat"
                      ? "bg-violet-600/30 text-violet-400 font-bold border border-violet-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => setActiveTab("participants")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === "participants"
                      ? "bg-violet-600/30 text-violet-400 font-bold border border-violet-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Participants ({Object.keys(remoteStreams).length + 1})</span>
                </button>
              </div>

              {activeTab === "chat" ? (
                /* Chat Message Lists */
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                  {messages.map((msg, idx) => {
                    const isSys = msg.sender === "System";
                    return (
                      <div key={idx} className={`space-y-0.5 ${isSys ? "text-center text-slate-500 italic py-1 bg-slate-900/30 rounded" : ""}`}>
                        {!isSys && (
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-violet-400">{msg.sender}</span>
                            <span>{msg.time}</span>
                          </div>
                        )}
                        <p className={`leading-relaxed ${isSys ? "" : "text-slate-200 bg-slate-900/80 p-2 rounded-lg"}`}>{msg.text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Participants List */
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                  {/* Host / Self */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-xs">
                        {user?.name?.[0] || "Y"}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">{user?.name || "You"} <span className="text-[10px] text-violet-400">(Host)</span></p>
                        <p className="text-[10px] text-slate-500">Connected</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-500" />}
                      {isCameraOn ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-slate-500" />}
                    </div>
                  </div>

                  {/* Remote Peers */}
                  {Object.entries(remoteStreams).map(([peerId, stream]) => (
                    <div key={peerId} className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-lg border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                          P
                        </div>
                        <div>
                          <p className="font-semibold text-slate-300">Participant ({peerId.substring(0, 4)})</p>
                          <p className="text-[10px] text-emerald-400">In Call</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled ? (
                          <Mic className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <MicOff className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Send Input Box (Only when chat tab is active) */}
            {activeTab === "chat" ? (
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t border-slate-800 mt-2">
                <input
                  type="text"
                  placeholder="Type in chat..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-slate-600"
                />
                <Button type="submit" size="icon" className="h-8 w-8 bg-violet-600 hover:bg-violet-750 text-white rounded">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            ) : (
              <div className="pt-3 border-t border-slate-800 mt-2 text-center text-[11px] text-slate-500">
                {Object.keys(remoteStreams).length + 1} participant(s) in this room
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
