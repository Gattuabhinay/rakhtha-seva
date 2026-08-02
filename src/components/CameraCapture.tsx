import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  title?: string;
  facingMode?: "user" | "environment";
  onClose: () => void;
  onCapture: (file: File) => void;
};

/** Live camera modal — capture → JPEG file for donor photo / proof. */
export function CameraCapture({
  open,
  title = "Take photo",
  facingMode = "user",
  onClose,
  onCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">(facingMode);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera not supported in this browser. Use Choose from gallery instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch {
        setError(
          "Camera permission blocked or unavailable. Allow camera access, or use Choose from gallery.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, facing]);

  useEffect(() => {
    setFacing(facingMode);
  }, [facingMode]);

  function stopAndClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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
    // Mirror selfie horizontally so saved photo matches what the donor saw.
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
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
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
          {!ready && !error && <p className="camera-status">Starting camera…</p>}
          {error && <p className="camera-status camera-status-error">{error}</p>}
        </div>

        <div className="camera-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              setFacing((f) => (f === "user" ? "environment" : "user"))
            }
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
          Square frame = how you appear on Our Donors. Center your face, then Capture.
        </p>
      </div>
    </div>
  );
}
