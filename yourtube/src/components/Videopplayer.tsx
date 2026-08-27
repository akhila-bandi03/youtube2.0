"use client";

import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Loader2,
  SkipForward,
  AlertCircle,
  Settings,
} from "lucide-react";
import { getVideoUrl } from "@/lib/axiosinstance";

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath: string;
  };
  nextVideoId?: string;
  nextVideoTitle?: string;
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

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ video, nextVideoId, nextVideoTitle, onUserPlay, onUserPause, onUserSeek }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nextCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTapRef = useRef<number>(0);
    const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [hasError, setHasError] = useState(false);

    // UI state
    const [showControls, setShowControls] = useState(true);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [centerFeedback, setCenterFeedback] = useState<"play" | "pause" | "rewind" | "forward" | null>(null);
    const [showNextOverlay, setShowNextOverlay] = useState(false);
    const [nextCountdown, setNextCountdown] = useState(5);

    // Ref API
    useImperativeHandle(ref, () => ({
      play: (time?: number) => {
        if (!videoRef.current) return;
        if (time !== undefined) videoRef.current.currentTime = time;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      },
      pause: (time?: number) => {
        if (!videoRef.current) return;
        if (time !== undefined) videoRef.current.currentTime = time;
        videoRef.current.pause();
        setIsPlaying(false);
      },
      seek: (time: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      },
      currentTime: () => videoRef.current?.currentTime || 0,
    }));

    // Reload video when source changes
    useEffect(() => {
      if (videoRef.current) {
        setHasError(false);
        setShowNextOverlay(false);
        setIsPlaying(false);
        setCurrentTime(0);
        setBuffered(0);
        videoRef.current.load();
      }
    }, [video]);

    // Auto-hide controls
    const resetControlsTimer = useCallback(() => {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (isPlaying && !showSpeedMenu) {
        controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
      }
    }, [isPlaying, showSpeedMenu]);

    useEffect(() => {
      resetControlsTimer();
      return () => {
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      };
    }, [resetControlsTimer]);

    // Keyboard controls
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }

        switch (e.code) {
          case "Space":
          case "KeyK":
            e.preventDefault();
            togglePlay();
            break;
          case "ArrowLeft":
          case "KeyJ":
            e.preventDefault();
            skip(-10);
            break;
          case "ArrowRight":
          case "KeyL":
            e.preventDefault();
            skip(10);
            break;
          case "ArrowUp":
            e.preventDefault();
            changeVolume(Math.min(1, volume + 0.05));
            break;
          case "ArrowDown":
            e.preventDefault();
            changeVolume(Math.max(0, volume - 0.05));
            break;
          case "KeyM":
            e.preventDefault();
            toggleMute();
            break;
          case "KeyF":
            e.preventDefault();
            toggleFullscreen();
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    });

    // Fullscreen status
    useEffect(() => {
      const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", handleFsChange);
      return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    // Countdown logic for next video autoplay
    useEffect(() => {
      if (showNextOverlay && nextVideoId) {
        setNextCountdown(5);
        nextCountdownRef.current = setInterval(() => {
          setNextCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(nextCountdownRef.current!);
              window.location.href = `/watch/${nextVideoId}`;
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      return () => {
        if (nextCountdownRef.current) clearInterval(nextCountdownRef.current);
      };
    }, [showNextOverlay, nextVideoId]);

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        showFeedback("pause");
        onUserPause?.(videoRef.current.currentTime);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        showFeedback("play");
        onUserPlay?.(videoRef.current.currentTime);
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
      showFeedback(amount > 0 ? "forward" : "rewind");
    };

    const changeVolume = (vol: number) => {
      if (!videoRef.current) return;
      setVolume(vol);
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      const next = !isMuted;
      setIsMuted(next);
      videoRef.current.muted = next;
      if (next) {
        videoRef.current.volume = 0;
      } else {
        videoRef.current.volume = volume || 0.5;
      }
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.error("Fullscreen request failed", err);
        });
      } else {
        document.exitFullscreen();
      }
    };

    const handlePlaybackSpeed = (speed: number) => {
      if (!videoRef.current) return;
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    };

    const showFeedback = (type: typeof centerFeedback) => {
      setCenterFeedback(type);
      setTimeout(() => setCenterFeedback(null), 600);
    };

    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      setCurrentTime(videoRef.current.currentTime);
      // Update buffer details
      if (videoRef.current.buffered.length > 0) {
        setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
      }
    };

    // Pointer gesture control for Mobile/Desktop (supports Double Tap / Single Tap toggle)
    const handlePointerInteraction = (
      e: React.MouseEvent<any> | React.TouchEvent<any>
    ) => {
      const now = Date.now();
      const isDoubleTap = now - lastTapRef.current < 300;
      lastTapRef.current = now;

      if (isDoubleTap) {
        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        
        const rect = containerRef.current!.getBoundingClientRect();
        // Use changedTouches if touches is empty (which happens on touchEnd)
        const clientX =
          "touches" in e && e.touches.length > 0
            ? e.touches[0].clientX
            : "changedTouches" in e && e.changedTouches.length > 0
            ? e.changedTouches[0].clientX
            : (e as React.MouseEvent).clientX;
            
        const clickX = clientX - rect.left;
        const ratio = clickX / rect.width;

        if (ratio < 0.4) {
          skip(-10);
        } else if (ratio > 0.6) {
          skip(10);
        }
      } else {
        // Single tap delays to prevent conflict
        tapTimeoutRef.current = setTimeout(() => {
          // If it's a mobile tap, handle play toggle. Desktop click has its own handler.
          if ("touches" in e) {
            togglePlay();
          }
        }, 310);
      }
    };

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoRef.current) return;
      const val = parseFloat(e.target.value);
      videoRef.current.currentTime = val;
      setCurrentTime(val);
      onUserSeek?.(val);
    };

    const VolumeIcon = isMuted || volume === 0
      ? VolumeX
      : volume < 0.5
      ? Volume1
      : Volume2;

    const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        onMouseMove={resetControlsTimer}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onTouchStart={resetControlsTimer}
        className="relative aspect-video bg-black rounded-xl overflow-hidden group select-none shadow-2xl border border-white/5"
      >
        {/* Actual Video */}
        <video
          ref={videoRef}
          onClick={(e) => {
            // Desktop click → toggle play immediately (non-touch)
            if (e.detail === 1) {
              tapTimeoutRef.current = setTimeout(() => togglePlay(), 250);
            } else if (e.detail === 2) {
              if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
              handlePointerInteraction(e);
            }
          }}
          onTouchEnd={handlePointerInteraction as any}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onSeeking={() => setIsBuffering(true)}
          onSeeked={() => setIsBuffering(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (nextVideoId) {
              setShowNextOverlay(true);
            }
          }}
          onError={() => {
            setHasError(true);
            setIsBuffering(false);
          }}
          className="w-full h-full cursor-pointer"
          crossOrigin="anonymous"
          playsInline
        >
          <source src={getVideoUrl(video?.filepath)} />
          Your browser does not support the video tag.
        </video>

        {/* Buffering/Loading State */}
        {isBuffering && !hasError && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none z-20">
            <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-50 p-4">
            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
            <p className="font-semibold text-lg">Video Unavailable</p>
            <p className="text-xs text-slate-400 mt-1 text-center max-w-sm">
              Please check your subscription plan or try another video.
            </p>
          </div>
        )}

        {/* Double-tap feedback badge overlay */}
        {centerFeedback && (
          <div
            className="absolute inset-0 flex pointer-events-none items-center justify-center z-20"
            style={{
              justifyContent:
                centerFeedback === "rewind"
                  ? "flex-start"
                  : centerFeedback === "forward"
                  ? "flex-end"
                  : "center",
              padding: centerFeedback === "rewind" || centerFeedback === "forward" ? "0 15%" : "0",
            }}
          >
            <div className="bg-black/70 text-white rounded-full p-4 flex flex-col items-center justify-center animate-ping">
              {centerFeedback === "rewind" && (
                <>
                  <RotateCcw className="w-8 h-8 mb-1" />
                  <span className="text-xs font-bold">-10s</span>
                </>
              )}
              {centerFeedback === "forward" && (
                <>
                  <RotateCw className="w-8 h-8 mb-1" />
                  <span className="text-xs font-bold">+10s</span>
                </>
              )}
              {centerFeedback === "play" && <Play className="w-8 h-8 fill-white" />}
              {centerFeedback === "pause" && <Pause className="w-8 h-8 fill-white" />}
            </div>
          </div>
        )}

        {/* Autoplay countdown overlay */}
        {showNextOverlay && nextVideoId && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-40 p-6 text-white text-center">
            <span className="text-xs text-violet-400 uppercase tracking-widest font-semibold mb-1">Up Next</span>
            <h3 className="text-lg font-bold max-w-md mb-6 line-clamp-2">{nextVideoTitle || "Next Video"}</h3>
            
            <div className="relative w-16 h-16 mb-6">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/10"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-violet-500"
                  strokeWidth="3"
                  strokeDasharray={`${nextCountdown * 20}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  style={{ transition: "stroke-dasharray 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">
                {nextCountdown}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  window.location.href = `/watch/${nextVideoId}`;
                }}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-bold text-sm transition"
              >
                Play Now
              </button>
              <button
                onClick={() => {
                  setShowNextOverlay(false);
                  if (nextCountdownRef.current) clearInterval(nextCountdownRef.current);
                }}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Speed settings menu */}
        {showSpeedMenu && (
          <div className="absolute bottom-16 right-4 z-40 bg-slate-950/95 border border-white/10 rounded-lg p-1.5 shadow-2xl backdrop-blur-md min-w-[120px]">
            <p className="text-[10px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">Playback Speed</p>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => handlePlaybackSpeed(s)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex justify-between items-center ${
                  playbackSpeed === s ? "bg-violet-600/20 text-violet-400 font-bold" : "text-white hover:bg-white/5"
                }`}
              >
                <span>{s === 1 ? "Normal" : `${s}x`}</span>
                {playbackSpeed === s && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
              </button>
            ))}
          </div>
        )}

        {/* Custom Controls Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-2 transition-all duration-300 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          {/* Progress Timeline Slider */}
          <div className="relative group/timeline w-full flex items-center h-2">
            {/* Custom slider tracks overlay */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-white/20 rounded-full overflow-hidden pointer-events-none">
              {/* Buffered progress */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Play progress */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-violet-500"
                style={{ width: `${playedPercent}%` }}
              />
            </div>
            {/* Draggable seek input */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeekChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ zIndex: 10 }}
            />
            {/* Slide thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white scale-0 group-hover/timeline:scale-100 transition shadow pointer-events-none"
              style={{ left: `calc(${playedPercent}% - 6px)` }}
            />
          </div>

          {/* Controls Tray */}
          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="hover:bg-white/10 p-2 rounded-full transition text-white"
                title="Play/Pause (Space)"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              {/* Skip backward 10s */}
              <button
                onClick={() => skip(-10)}
                className="hover:bg-white/10 p-2 rounded-full transition text-white"
                title="Rewind 10s (Left Arrow)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Skip forward 10s */}
              <button
                onClick={() => skip(10)}
                className="hover:bg-white/10 p-2 rounded-full transition text-white"
                title="Forward 10s (Right Arrow)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume & Slider */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="hover:bg-white/10 p-2 rounded-full transition text-white"
                  title="Mute (M)"
                >
                  <VolumeIcon className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  className="w-0 group-hover/vol:w-16 h-1 rounded appearance-none cursor-pointer bg-white/20 transition-all duration-300 accent-white"
                />
              </div>

              {/* Playback Time */}
              <span className="font-mono text-[11px] ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Next Video Option */}
              {nextVideoId && (
                <button
                  onClick={() => {
                    window.location.href = `/watch/${nextVideoId}`;
                  }}
                  className="hover:bg-white/10 p-2 rounded-full transition text-white"
                  title="Next Video"
                >
                  <SkipForward className="w-4 h-4 fill-white" />
                </button>
              )}

              {/* Speed Settings Gear */}
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className={`hover:bg-white/10 p-2 rounded-full transition text-white ${
                  showSpeedMenu ? "bg-white/10 text-violet-400" : ""
                }`}
                title="Playback Speed"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Fullscreen Mode */}
              <button
                onClick={toggleFullscreen}
                className="hover:bg-white/10 p-2 rounded-full transition text-white"
                title="Fullscreen (F)"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
