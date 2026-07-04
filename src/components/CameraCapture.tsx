import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { visionParse } from "../lib/llm";
import { addPanel, addPhoto, getJob, visionParseToComponents } from "../lib/db";
import { inferGridFromVision } from "../lib/diagram";
import type { Job, VisionParse } from "../lib/types";
import { prepareImage } from "../utils/image";
import type { PreparedImage } from "../utils/image";
import { TopBar } from "./TopBar";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";
import { ManualPlacement } from "./ManualPlacement";

type Stage = "camera" | "preview" | "reading" | "manual";

export function CameraCapture() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [stage, setStage] = useState<Stage>("camera");
  const [cameraReady, setCameraReady] = useState(false);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadJob() {
      // Brief retry — mobile IndexedDB can lag right after createJob + navigate.
      for (let attempt = 0; attempt < 5; attempt++) {
        const j = await getJob(jobId);
        if (j) {
          if (!cancelled) setJob(j);
          return;
        }
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
      }
      if (!cancelled) {
        toast.error("That job no longer exists.");
        navigate("/", { replace: true });
      }
    }
    if (jobId) void loadJob();
    return () => {
      cancelled = true;
    };
  }, [jobId, navigate, toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      // No camera / permission denied — the file-input fallback still works.
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (stage === "camera") void startCamera();
    return () => stopCamera();
  }, [stage, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function usePreparedBlob(raw: Blob) {
    try {
      const img = await prepareImage(raw);
      setPrepared(img);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(img.blob));
      stopCamera();
      setStage("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that image.");
    }
  }

  function handleShutter() {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (b) => b && void usePreparedBlob(b),
      "image/jpeg",
      0.92,
    );
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void usePreparedBlob(file);
    e.target.value = "";
  }

  async function runVisionPipeline() {
    if (!prepared) return;
    setStage("reading");
    setParseError(null);
    const res = await visionParse(prepared.base64, prepared.mimeType);
    if (!res.ok) {
      // Never a dead end — offer manual tile placement over the photo.
      setParseError(res.error);
      setStage("manual");
      return;
    }
    await finalize(res.value);
  }

  async function finalize(parse: VisionParse) {
    try {
      const grid = inferGridFromVision(parse);
      const components = visionParseToComponents(parse);
      const photoId = await addPhoto(prepared!.blob);
      await addPanel(jobId, components, photoId, grid.rows, grid.cols);
    } catch (e) {
      // Storage failed — never leave the user stuck on the reading screen.
      setParseError(e instanceof Error ? e.message : "Could not save the board.");
      setStage("manual");
      return;
    }
    toast.success("Board captured.");
    navigate(`/job/${jobId}`, { replace: true });
  }

  function retake() {
    setPrepared(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setParseError(null);
    setStage("camera");
  }

  if (stage === "manual" && prepared && previewUrl) {
    return (
      <ManualPlacement
        photoUrl={previewUrl}
        reason={parseError}
        onCancel={retake}
        onConfirm={async (components) => {
          const photoId = await addPhoto(prepared.blob);
          await addPanel(jobId, components, photoId);
          toast.success("Board saved.");
          navigate(`/job/${jobId}`, { replace: true });
        }}
      />
    );
  }

  return (
    <>
      <TopBar
        title="Capture board"
        subtitle={job?.title}
        back
        backTo={`/job/${jobId}`}
      />
      <main className="flex flex-1 flex-col">
        {stage === "reading" ? (
          <ReadingState />
        ) : stage === "preview" && previewUrl ? (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center bg-zinc-900 p-3">
              <img
                src={previewUrl}
                alt="Captured board"
                className="max-h-[65vh] w-auto rounded-xl object-contain"
              />
            </div>
            <div className="safe-bottom flex gap-3 border-t border-zinc-200 bg-white p-4">
              <Button variant="secondary" size="lg" onClick={retake}>
                Retake
              </Button>
              <Button size="lg" block onClick={runVisionPipeline}>
                Clean up board
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="relative flex flex-1 items-center justify-center bg-zinc-900">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`max-h-[65vh] w-full object-contain ${cameraReady ? "" : "hidden"}`}
              />
              {!cameraReady && (
                <div className="px-8 py-16 text-center text-sm text-zinc-300">
                  <p className="mb-2 font-medium">Camera not available</p>
                  <p className="text-zinc-400">
                    Use “Choose from photos” below to pick an existing picture
                    of the board instead.
                  </p>
                </div>
              )}
            </div>
            <div className="safe-bottom flex flex-col gap-3 border-t border-zinc-200 bg-white p-4">
              {cameraReady && (
                <Button size="lg" block onClick={handleShutter}>
                  Take photo
                </Button>
              )}
              <Button
                variant="secondary"
                size="lg"
                block
                onClick={() => galleryInputRef.current?.click()}
              >
                Choose from photos
              </Button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function ReadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <Spinner size={40} className="text-blue-700" />
      <div>
        <p className="text-lg font-semibold text-zinc-900">
          Reading your board…
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Turning the photo into a clean, labeled diagram.
        </p>
      </div>
    </div>
  );
}
