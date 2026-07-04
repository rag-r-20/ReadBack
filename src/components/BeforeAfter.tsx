import { useEffect, useState } from "react";
import type { PanelComponent } from "../lib/types";
import { getPhoto } from "../lib/db";
import { PanelDiagram } from "./PanelDiagram";

interface Props {
  photoId?: string;
  components: PanelComponent[];
  rows?: number | string | null;
  cols?: number | string | null;
  title?: string;
  selectedId?: string | null;
  highlightIds?: Set<string>;
  onSelectTile?: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}

/** The demo money shot: chaotic photo on the left, tidy diagram on the right. */
export function BeforeAfter({
  photoId,
  components,
  rows,
  cols,
  title,
  selectedId,
  highlightIds,
  onSelectTile,
  onReorder,
}: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    if (photoId) {
      void getPhoto(photoId).then((blob) => {
        if (blob && active) {
          url = URL.createObjectURL(blob);
          setPhotoUrl(url);
        }
      });
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {photoUrl && (
        <figure className="flex flex-col">
          <figcaption className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Before
          </figcaption>
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-900">
            <img
              src={photoUrl}
              alt="Original board photo"
              className="max-h-72 w-auto object-contain md:max-h-full"
            />
          </div>
        </figure>
      )}
      <figure className="flex flex-col">
        <figcaption className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {photoUrl ? "After" : "Board"}
        </figcaption>
        <div className="flex flex-1 items-center rounded-2xl border border-zinc-200 bg-white p-2">
          <PanelDiagram
            components={components}
            rows={rows}
            cols={cols}
            title={title}
            selectedId={selectedId}
            highlightIds={highlightIds}
            onSelectTile={onSelectTile}
            onReorder={onReorder}
          />
        </div>
      </figure>
    </div>
  );
}
