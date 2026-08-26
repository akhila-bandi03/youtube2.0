"use client";

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  RotateCw, 
  Loader2,
  SkipForward,
  AlertCircle
} from "lucide-react";
import { Button } from "./ui/button";
import { getBackendUrl, getVideoUrl } from "@/lib/axiosinstance";

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath: string;
  };
  nextVideoId?: string;
  onUserPlay?: (time: number) => void;
  onUserPause?: (time: number) => void;
  onUserSeek?: (time: number) => void;
}

export interface VideoPlayerRef {
  play: (time?: number) => void;
  pause: (time?: number) => void;
  seek: (time: number) => void;
  currentTime: () => number;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ video, nextVideoId, onUserPlay, onUserPause, onUserSeek }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const backendUrl = getBackendUrl();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [feedback, setFeedback] = useState<"rewind" | "forward" | null>(null);
  const [hasError, setHasError] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Reload video source when video metadata updates
  useEffect(() => {
    if (videoRef.current) {
      setHasError(false);
      videoRef.current.load();
      setIsPlaying(false);
    }
  }, [video]);

  useImperativeHandle(ref, () => ({
    play: (time?: number) => {
      if (!videoRef.current) return;
      if (time !== undefined) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    },
    pause: (time?: number) => {
      if (!videoRef.current) return;
      if (time !== undefined) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
      videoRef.current.pause();
      setIsPlaying(false);
    },
    seek: (time: number) => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    },
    currentTime: () => videoRef.current?.currentTime || 0
  }));

  // Auto-hide controls timer
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      onUserPause?.(videoRef.current.currentTime);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      onUserPlay?.(videoRef.current.currentTime);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    onUserSeek?.(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    videoRef.current.volume = vol;
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    if (nextMuted) {
      videoRef.current.volume = 0;
    } else {
      videoRef.current.volume = volume || 0.5;
    }
  };

  const skip = (amount: number) => {
    if (!videoRef.current) return;
    let newTime = videoRef.current.currentTime + amount;
    if (newTime < 0) newTime = 0;
    if (newTime > duration) newTime = duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    onUserSeek?.(newTime);
  };

  const triggerFeedback = (type: "rewind" | "forward") => {
    setFeedback(type);
    setTimeout(() => {
      setFeedback(null);
    }, 600);
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    const now = Date.now();
    const isDoubleTap = (now - lastTapRef.current) < 300;
    lastTapRef.current = now;

    if (isDoubleTap || ('detail' in e && e.detail === 2)) {
      // Double tap skip logic
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clickX = clientX - rect.left;
      const width = rect.width;
      const ratio = clickX / width;

      if (ratio < 0.4) {
        skip(-10);
        triggerFeedback("rewind");
      } else if (ratio > 0.6) {
        skip(10);
        triggerFeedback("forward");
      }
    } else if ('detail' in e && e.detail === 1) {
      // Single tap play/pause toggle
      togglePlay();
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Fullscreen request failed", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Listen to fullscreen changes outside standard triggers
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative aspect-video bg-black rounded-lg overflow-hidden group select-none shadow-lg border border-slate-200 dark:border-slate-800"
    >
      {/* Actual HTML Video */}
      <video
        ref={videoRef}
        onClick={handleVideoClick}
        onTouchEnd={handleVideoClick}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => setIsBuffering(false)}
        onError={() => {
          setHasError(true);
          setIsBuffering(false);
        }}
        className="w-full h-full cursor-pointer"
        crossOrigin="anonymous"
      >
        {/* No fixed type — browser auto-detects from response headers */}
        <source src={getVideoUrl(video?.filepath)} />
        Your browser does not support the video tag.
      </video>

      {/* Buffering Loader Spinner Overlay */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none z-10">
          <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
        </div>
      )}

      {/* Error State Overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white z-50">
          <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
          <p className="font-semibold">Video unavailable or restricted</p>
          <p className="text-xs text-slate-400 mt-1">Please check your subscription plan or try another video.</p>
        </div>
      )}

      {/* Double Tap Visual Indicator Feedback Overlay */}
      {feedback && (
        <div className="absolute inset-0 flex pointer-events-none items-center justify-around z-20">
          {feedback === "rewind" && (
            <div className="bg-black/60 text-white rounded-full p-4 flex flex-col items-center justify-center animate-ping">
              <RotateCcw className="w-8 h-8 mb-1" />
              <span className="text-xs font-bold font-mono">-10s</span>
            </div>
          )}
          <div />
          {feedback === "forward" && (
            <div className="bg-black/60 text-white rounded-full p-4 flex flex-col items-center justify-center animate-ping">
              <RotateCw className="w-8 h-8 mb-1" />
              <span className="text-xs font-bold font-mono">+10s</span>
            </div>
          )}
        </div>
      )}

      {/* Custom Control Panel Overlays */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 sm:p-4 space-y-1.5 sm:space-y-3 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Seek timeline progress bar */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}
            className="w-full h-1 sm:h-1.5 rounded-lg appearance-none cursor-pointer accent-violet-600 bg-slate-600/70 hover:h-2 transition-all"
          />
        </div>

        {/* Buttons / Controls Tray */}
        <div className="flex items-center justify-between text-white text-[11px] sm:text-xs">
          <div className="flex items-center gap-1 sm:gap-3">
            {/* Play/Pause */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={togglePlay}
              className="text-white hover:bg-white/20 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />}
            </Button>

            {/* Skip ccw 10s */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => skip(-10)}
              className="text-white hover:bg-white/20 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
              title="Rewind 10s"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>

            {/* Skip cw 10s */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => skip(10)}
              className="text-white hover:bg-white/20 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
              title="Fast Forward 10s"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>

            {/* Volume controls */}
            <div className="flex items-center gap-1 group/vol">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMute}
                className="text-white hover:bg-white/20 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/vol:w-12 sm:group-hover/vol:w-16 h-1 rounded appearance-none cursor-pointer accent-white bg-slate-600 transition-all duration-300"
              />
            </div>

            {/* Playback timestamp display */}
            <span className="font-mono text-[10px] sm:text-xs ml-1 sm:ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Next Video Option */}
            {nextVideoId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  window.location.href = `/watch/${nextVideoId}`;
                }}
                className="text-white hover:bg-white/20 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                title="Next Video"
              >
                <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />
              </Button>
            )}

            {/* Fullscreen toggle button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
