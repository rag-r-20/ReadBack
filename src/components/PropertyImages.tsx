import { useEffect, useState } from "react";
import type { StoredPhoto } from "../lib/db";
import { addPhoto, getPhoto } from "../lib/db";
import { prepareImage } from "../utils/image";
import { useToast } from "./ui/Toast";

interface Props {
  jobId: string;
  photos: StoredPhoto[];
  onChanged: () => void;
}

/** Property-level image gallery — images can exist without a circuit render. */
export function PropertyImages({ jobId, photos, onChanged }: Props) {
  const toast = useToast();
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    const next = new Map<string, string>();
    const created: string[] = [];

    void (async () => {
      for (const photo of photos) {
        const blob = photo.blob ?? (await getPhoto(photo.id));
        if (blob && active) {
          const url = URL.createObjectURL(blob);
          created.push(url);
          next.set(photo.id, url);
        }
      }
      if (active) setUrls(next);
    })();

    return () => {
      active = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photos]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const prepared = await prepareImage(file);
      await addPhoto(prepared.blob, { jobId });
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't upload that image.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (photos.length === 0) {
    return (
      <label className="flex cursor-pointer flex-col items-center rounded border border-dashed border-[var(--color-outline)] bg-[var(--color-surface)] p-6 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-bright)] min-h-[48px]">
        <span className="text-body-md font-bold text-[var(--color-on-surface)]">
          {uploading ? "Uploading…" : "Add property photos"}
        </span>
        <span className="mt-1 text-body-md text-[var(--color-on-surface-variant)]">
          Extra shots of boards, labels, or the install — not tied to one circuit.
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
      </label>
    );
  }

  return (
    <section className="mb-4">
      <div className="mb-2 flex min-h-[48px] items-center justify-between">
        <h3 className="text-label-caps text-[var(--color-on-surface-variant)]">
          Property images ({photos.length})
        </h3>
        <label className="flex cursor-pointer min-h-[48px] items-center text-body-md font-bold text-[var(--color-primary)] hover:text-[var(--color-inverse-primary)]">
          {uploading ? "Uploading…" : "+ Add image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo) => {
          const url = urls.get(photo.id);
          return (
            <div
              key={photo.id}
              className="h-20 w-20 shrink-0 overflow-hidden rounded border border-[var(--color-slate-light)] bg-black"
            >
              {url ? (
                <img
                  src={url}
                  alt={photo.label ?? "Property photo"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full animate-pulse bg-[var(--color-surface-container)]" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
