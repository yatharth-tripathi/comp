"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

/**
 * Attach an HLS stream to a <video> element.
 *
 * Safari handles `.m3u8` natively; everywhere else we feed the stream
 * through hls.js. We destroy the hls.js instance on unmount and when the
 * src changes to avoid leaking workers.
 */
export function useHlsVideo(hlsUrl: string | null, mp4Fallback: string | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return undefined;

    // Native HLS (Safari / iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      return undefined;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        lowLatencyMode: false,
        enableWorker: true,
        backBufferLength: 5,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (mp4Fallback) video.src = mp4Fallback;
          }
        }
      });
      return () => {
        hls.destroy();
      };
    }

    // Last resort: progressive MP4
    if (mp4Fallback) video.src = mp4Fallback;
    return undefined;
  }, [hlsUrl, mp4Fallback]);

  return videoRef;
}
