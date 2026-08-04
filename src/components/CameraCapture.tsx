import { useEffect, useRef, useState } from "react";

type Facing = "user" | "environment";

type Props = {
  open: boolean;
  title?: string;
  stream: MediaStream | null;
  facing: Facing;
  onClose: () => void;
  onCapture: (file: File) => void;
  onFlip: () => void;
  error?: string | null;
};

/** Live camera modal — stream must be requested on button tap (browser Allow prompt). */
export function CameraCapture({
  open,
  title = "Take photo",
  stream,
  facing,
  onClose,
  onCapture,
  onFlip,
  error = null,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || !stream) {
      setReady(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setReady(false);
    video.srcObject = stream;

    void video
      .play()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });

    return () => {
      cancelled = true;
      video.srcObject = null;
      setReady(false);
    };
  }, [open, stream]);

  function stopAndClose() {
    onClose();
  }

  function snap() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 720;
    const side = Math.min(w, h);
    const sx = Math.floor((w - side) / 2);
    const sy = Math.floor((h - side) * 0.18);

    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(720, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 720, 720);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        onCapture(file);
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!open) return null;

  return (
    <div className="camera-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="camera-modal-panel">
        <div className="camera-modal-head">
          <strong>{title}</strong>
          <button type="button" className="btn btn-ghost" onClick={stopAndClose}>
            Close
          </button>
        </div>

        <div className="camera-stage">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`camera-video${facing === "user" ? " camera-video-mirror" : ""}`}
          />
          <div className="camera-frame" aria-hidden />
          {!ready && !error && (
            <p className="camera-status">Allow camera when your browser asks…</p>
          )}
          {error && <p className="camera-status camera-status-error">{error}</p>}
        </div>

        <div className="camera-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onFlip}
            disabled={Boolean(error)}
          >
            Flip camera
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={snap}
            disabled={!ready || Boolean(error)}
          >
            Capture photo
          </button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          Your browser asked to use the camera — tap Allow. Square frame = Our Donors wall.
        </p>
      </div>
    </div>
  );
}

export async function requestCameraStream(facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera not supported. Use Choose from gallery instead.");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 1280 },
    },
  });
}

export function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
