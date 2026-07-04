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

class ReadBackDB extends Dexie {
  jobs!: Table<Job, string>;
  panels!: Table<Panel, string>;
  notes!: Table<Note, string>;
  materials!: Table<Material, string>;

  constructor() {
    super('readback');
    this.version(1).stores({
      jobs: 'id, createdAt',
      panels: 'id, jobId, createdAt',
      notes: 'id, jobId, componentId, createdAt',
      materials: 'id, jobId, createdAt',
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

/** Deletes the job and everything hanging off it. */
export async function deleteJob(jobId: string): Promise<void> {
  await db.transaction('rw', [db.jobs, db.panels, db.notes, db.materials], async () => {
    await db.panels.where('jobId').equals(jobId).delete();
    await db.notes.where('jobId').equals(jobId).delete();
    await db.materials.where('jobId').equals(jobId).delete();
    await db.jobs.delete(jobId);
  });
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
