// IndexedDB storage via Dexie. Four tables keyed by id; panel/note/material
// rows carry jobId so a full job assembles with three indexed queries.

import Dexie, { type Table } from 'dexie';
import type {
  Job,
  Material,
  MaterialItem,
  Note,
  Panel,
  PanelComponent,
  CleanedNote,
  VisionParse,
  VisionComponent,
} from './types';

/** Original capture stored so the before/after view can show the source photo. */
export interface StoredPhoto {
  id: string;
  blob: Blob;
  createdAt: number;
}

class ReadBackDB extends Dexie {
  jobs!: Table<Job, string>;
  panels!: Table<Panel, string>;
  notes!: Table<Note, string>;
  materials!: Table<Material, string>;
  photos!: Table<StoredPhoto, string>;

  constructor() {
    super('readback');
    this.version(1).stores({
      jobs: 'id, createdAt',
      panels: 'id, jobId, createdAt',
      notes: 'id, jobId, componentId, createdAt',
      materials: 'id, jobId, createdAt',
    });
    // v2: add a photos table for the captured source images (UI/before-after).
    this.version(2).stores({
      photos: 'id, createdAt',
    });
  }
}

export const db = new ReadBackDB();

export function newId(): string {
  return crypto.randomUUID();
}

// ---------- Jobs ----------

export async function createJob(title: string, address?: string): Promise<Job> {
  const job: Job = { id: newId(), title, address, createdAt: Date.now() };
  await db.jobs.add(job);
  return job;
}

export async function getJob(jobId: string): Promise<Job | undefined> {
  return db.jobs.get(jobId);
}

export async function listJobs(): Promise<Job[]> {
  return db.jobs.orderBy('createdAt').reverse().toArray();
}

/** Deletes the job and everything hanging off it (including captured photos). */
export async function deleteJob(jobId: string): Promise<void> {
  await db.transaction('rw', [db.jobs, db.panels, db.notes, db.materials, db.photos], async () => {
    const panels = await db.panels.where('jobId').equals(jobId).toArray();
    const photoIds = panels
      .map((p) => p.sourcePhotoId)
      .filter((id): id is string => Boolean(id));
    if (photoIds.length) await db.photos.bulkDelete(photoIds);
    await db.panels.where('jobId').equals(jobId).delete();
    await db.notes.where('jobId').equals(jobId).delete();
    await db.materials.where('jobId').equals(jobId).delete();
    await db.jobs.delete(jobId);
  });
}

// ---------- Photos ----------

/** Store a captured image blob; returns the id to pass as sourcePhotoId. */
export async function addPhoto(blob: Blob): Promise<string> {
  const id = newId();
  await db.photos.add({ id, blob, createdAt: Date.now() });
  return id;
}

/** Fetch a stored photo blob (undefined if missing). */
export async function getPhoto(photoId: string): Promise<Blob | undefined> {
  const row = await db.photos.get(photoId);
  return row?.blob;
}

// ---------- Panels & components ----------

export async function addPanel(
  jobId: string,
  components: PanelComponent[],
  sourcePhotoId?: string,
): Promise<Panel> {
  const panel: Panel = {
    id: newId(),
    jobId,
    sourcePhotoId,
    components,
    createdAt: Date.now(),
  };
  await db.panels.add(panel);
  return panel;
}

export async function getPanelsForJob(jobId: string): Promise<Panel[]> {
  return db.panels.where('jobId').equals(jobId).sortBy('createdAt');
}

/** Patch one tile in place (fix rating/type/label, attach note ids). */
export async function updateComponent(
  panelId: string,
  componentId: string,
  patch: Partial<Omit<PanelComponent, 'id'>>,
): Promise<void> {
  const panel = await db.panels.get(panelId);
  if (!panel) return;
  const components = panel.components.map((c) =>
    c.id === componentId ? { ...c, ...patch } : c,
  );
  await db.panels.update(panelId, { components });
}

/**
 * Replace a panel's whole component list (used for add/remove/reorder in the
 * tile editor). Order fields are renumbered 1..n by array position.
 */
export async function replacePanelComponents(
  panelId: string,
  components: PanelComponent[],
): Promise<void> {
  const renumbered = components.map((c, i) => ({ ...c, order: i + 1 }));
  await db.panels.update(panelId, { components: renumbered });
}

/**
 * Convert a vision-parse result into storable PanelComponent tiles.
 * printed_label seeds purposeLabel; the user refines it in the tile editor.
 */
export function visionParseToComponents(parse: VisionParse): PanelComponent[] {
  return parse.components.map((v: VisionComponent) => ({
    id: v.id || newId(),
    order: v.order,
    type: v.type,
    rating: v.rating,
    purposeLabel: v.printed_label,
    noteIds: [],
    confidence: v.confidence,
  }));
}

// ---------- Notes ----------

export async function addNote(
  jobId: string,
  transcript: string,
  cleaned: CleanedNote,
  opts?: { componentId?: string; audioRef?: string },
): Promise<Note> {
  const note: Note = {
    id: newId(),
    jobId,
    componentId: opts?.componentId,
    transcript,
    cleaned,
    audioRef: opts?.audioRef,
    createdAt: Date.now(),
  };
  await db.notes.add(note);
  // Keep the tile's noteIds in sync so the diagram can show a note marker.
  if (opts?.componentId) {
    const panels = await getPanelsForJob(jobId);
    for (const panel of panels) {
      const target = panel.components.find((c) => c.id === opts.componentId);
      if (target) {
        await updateComponent(panel.id, target.id, {
          noteIds: [...target.noteIds, note.id],
        });
        break;
      }
    }
  }
  return note;
}

export async function getNotesForJob(jobId: string): Promise<Note[]> {
  return db.notes.where('jobId').equals(jobId).sortBy('createdAt');
}

// ---------- Materials ----------

export async function addMaterials(
  jobId: string,
  items: MaterialItem[],
): Promise<Material[]> {
  const now = Date.now();
  const rows: Material[] = items.map((m) => ({
    id: newId(),
    jobId,
    item: m.item,
    quantity: m.quantity,
    unit: m.unit,
    spec: m.spec,
    notes: m.notes,
    sourced: false,
    createdAt: now,
  }));
  await db.materials.bulkAdd(rows);
  return rows;
}

export async function getMaterialsForJob(jobId: string): Promise<Material[]> {
  return db.materials.where('jobId').equals(jobId).sortBy('createdAt');
}

export async function toggleMaterialSourced(materialId: string): Promise<void> {
  const material = await db.materials.get(materialId);
  if (!material) return;
  await db.materials.update(materialId, { sourced: !material.sourced });
}

// ---------- Retrieval ----------

export interface JobData {
  job: Job;
  panels: Panel[];
  notes: Note[];
  materials: Material[];
}

/** Everything about a job in one object — feeds the "ask your job" prompt. */
export async function assembleJobData(jobId: string): Promise<JobData | undefined> {
  const job = await db.jobs.get(jobId);
  if (!job) return undefined;
  const [panels, notes, materials] = await Promise.all([
    getPanelsForJob(jobId),
    getNotesForJob(jobId),
    getMaterialsForJob(jobId),
  ]);
  return { job, panels, notes, materials };
}
