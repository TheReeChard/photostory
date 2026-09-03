"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Images,
  Loader2,
  LockKeyhole,
  MapPin,
  Merge,
  Plus,
  Scissors,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { buildEvents, formatDateTime, parsePhoto } from "@/lib/photo";
import { generateStoryPdf } from "@/lib/pdf";
import type { PdfSettings, PhotoLayout, StoryEvent, StoryPhoto } from "@/lib/types";

const STEPS = ["Upload", "Story", "Review", "PDF"] as const;

type Step = 0 | 1 | 2 | 3;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Logo() {
  return (
    <div className="brand">
      <div className="brandMark"><ImageIcon size={16} strokeWidth={1.9} /></div>
      <span>PhotoStory</span>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <nav className="stepper" aria-label="Progress">
      {STEPS.map((label, index) => (
        <div className="stepWrap" key={label}>
          <div className={cn("step", index === step && "active", index < step && "complete")}>
            <span className="stepDot">{index < step ? <Check size={12} /> : index + 1}</span>
            <span className="stepLabel">{label}</span>
          </div>
          {index < STEPS.length - 1 && <span className={cn("stepLine", index < step && "complete")} />}
        </div>
      ))}
    </nav>
  );
}

function Header({ step }: { step: Step }) {
  return (
    <header className="topbar">
      <Logo />
      <Stepper step={step} />
      <button className="ghostButton" type="button"><CircleHelp size={16} /> <span>Help</span></button>
    </header>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sideCard">
      <h3>{title}</h3>
      <div className="sideCardBody">{children}</div>
    </section>
  );
}

function UploadSidebar() {
  return (
    <aside className="sideRail">
      <SideCard title="Upload tips">
        <p><ImageIcon size={15} /> Upload original, high-quality photos for the best PDF.</p>
        <p><CalendarDays size={15} /> We read photo dates locally to build the timeline.</p>
        <p><MapPin size={15} /> GPS metadata can be converted into a readable place.</p>
        <p><Images size={15} /> JPEG, PNG, HEIC and HEIF are supported.</p>
      </SideCard>
      <SideCard title="Privacy first">
        <p><LockKeyhole size={15} /> Photo files stay in your browser. They are not uploaded to our server.</p>
        <p className="mutedTiny">For GPS name lookup, only coordinates are sent to the geocoder—not the image.</p>
      </SideCard>
    </aside>
  );
}

function EmptyThumb() {
  return <div className="thumbFallback"><ImageIcon size={24} /></div>;
}

function PhotoThumb({ photo, compact = false }: { photo: StoryPhoto; compact?: boolean }) {
  return (
    <div className={cn("photoThumb", compact && "compact")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.previewUrl} alt={photo.file.name} />
    </div>
  );
}

const PHOTO_LAYOUTS: Array<{ value: PhotoLayout; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "strip", label: "Strip" },
  { value: "grid", label: "Grid" },
  { value: "feature", label: "Feature" },
];

function resolvedPhotoLayout(layout: PhotoLayout, photos: StoryPhoto[]): Exclude<PhotoLayout, "auto"> {
  const count = photos.length;
  if (layout !== "auto") {
    if (layout === "feature" && count < 3) return "strip";
    return layout;
  }
  const ratios = photos.map((photo) => (photo.width ?? 4) / (photo.height ?? 3));
  if (count === 1) return "strip";
  if (count === 2) return ratios.every((ratio) => ratio >= 1.15) ? "grid" : "strip";
  if (count <= 4) return Math.max(...ratios) - Math.min(...ratios) > 0.45 ? "feature" : "grid";
  return "grid";
}

function EventPhotoGallery({
  photos,
  layout,
  className,
  max = 6,
  onReorderPhoto,
}: {
  photos: StoryPhoto[];
  layout: PhotoLayout;
  className?: string;
  max?: number;
  onReorderPhoto?: (sourceId: string, targetId: string) => void;
}) {
  const draggedPhotoId = useRef<string | null>(null);
  const visible = photos.slice(0, max);
  const resolved = resolvedPhotoLayout(layout, visible);
  const featureIndex = resolved === "feature"
    ? visible.reduce((best, photo, index) => {
      const ratio = (photo.width ?? 4) / (photo.height ?? 3);
      const bestRatio = (visible[best].width ?? 4) / (visible[best].height ?? 3);
      return ratio > bestRatio ? index : best;
    }, 0)
    : -1;
  const stripColumns = Math.max(1, visible.length);

  const galleryStyle = resolved === "strip"
    ? { gridTemplateColumns: `repeat(${stripColumns}, minmax(0, 1fr))` }
    : resolved === "feature"
      ? { gridTemplateRows: `repeat(${Math.max(1, visible.length - 1)}, minmax(0, 1fr))` }
      : undefined;

  return (
    <div
      className={cn("photoGallery", `layout-${resolved}`, className)}
      style={galleryStyle}
    >
      {visible.map((photo, index) => (
        <div
          className={cn("galleryTile", index === featureIndex && "firstTile", onReorderPhoto && "reorderablePhoto")}
          key={photo.id}
          draggable={Boolean(onReorderPhoto)}
          onDragStart={() => { draggedPhotoId.current = photo.id; }}
          onDragOver={(event) => { if (onReorderPhoto) event.preventDefault(); }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedPhotoId.current && draggedPhotoId.current !== photo.id) {
              onReorderPhoto?.(draggedPhotoId.current, photo.id);
            }
            draggedPhotoId.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt={photo.file.name} />
          {onReorderPhoto && <span className="photoOrderBadge">{index + 1}</span>}
        </div>
      ))}
      {photos.length > max && <span className="morePhotos">+{photos.length - max}</span>}
    </div>
  );
}

function formatInputDate(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function Home() {
  const [step, setStep] = useState<Step>(0);
  const [photos, setPhotos] = useState<StoryPhoto[]>([]);
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("Our Journey");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>({
    photosPerPage: 4,
    pageLayout: "auto",
    roundedCorners: true,
    includeLocation: true,
    includeTimestamp: true,
    includeCover: true,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const dragEventIdRef = useRef<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const [dragEventId, setDragEventId] = useState<string | null>(null);

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()),
    [photos],
  );

  const dateRange = useMemo(() => {
    if (!sortedPhotos.length) return "No photos yet";
    const first = new Date(sortedPhotos[0].takenAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const last = new Date(sortedPhotos[sortedPhotos.length - 1].takenAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return first === last ? first : `${first} – ${last}`;
  }, [sortedPhotos]);

  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const reviewPages = useMemo(() => {
    const pages: Array<Array<{ event: StoryEvent; photos: StoryPhoto[]; chunkIndex: number; chunkCount: number }>> = [];
    let page: Array<{ event: StoryEvent; photos: StoryPhoto[]; chunkIndex: number; chunkCount: number }> = [];
    let pagePhotoCount = 0;

    for (const event of events) {
      const eventPhotos = event.photoIds.map((id) => photoById.get(id)).filter(Boolean) as StoryPhoto[];
      const chunks: StoryPhoto[][] = [];
      for (let index = 0; index < eventPhotos.length; index += pdfSettings.photosPerPage) {
        chunks.push(eventPhotos.slice(index, index + pdfSettings.photosPerPage));
      }
      chunks.forEach((chunk, chunkIndex) => {
        if (page.length && pagePhotoCount + chunk.length > pdfSettings.photosPerPage) {
          pages.push(page);
          page = [];
          pagePhotoCount = 0;
        }
        page.push({ event, photos: chunk, chunkIndex, chunkCount: chunks.length });
        pagePhotoCount += chunk.length;
      });
    }
    if (page.length) pages.push(page);
    return pages;
  }, [events, photoById, pdfSettings.photosPerPage]);

  async function ingestFiles(fileList: FileList | File[]) {
    const accepted = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/") || /\.(jpe?g|png|heic|heif)$/i.test(file.name),
    );
    if (!accepted.length) return;

    setProcessing(true);
    setProgress(0);
    const added: StoryPhoto[] = [];
    for (let i = 0; i < accepted.length; i++) {
      try {
        const parsed = await parsePhoto(accepted[i]);
        added.push(parsed);
      } catch (error) {
        console.error("Could not read photo", accepted[i].name, error);
      }
      setProgress(Math.round(((i + 1) / accepted.length) * 100));
    }
    setPhotos((current) => [...current, ...added]);
    setEvents((current) => {
      const detected = buildEvents(added);
      if (!current.length) return detected;
      return [...current, ...detected].sort(
        (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
      );
    });
    setProcessing(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void ingestFiles(e.dataTransfer.files);
  }

  function onChoose(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void ingestFiles(e.target.files);
    e.target.value = "";
  }

  function removePhoto(id: string) {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setPhotos((current) => current.filter((p) => p.id !== id));
    setEvents((current) =>
      current
        .map((event) => ({ ...event, photoIds: event.photoIds.filter((photoId) => photoId !== id) }))
        .filter((event) => event.photoIds.length > 0),
    );
  }

  function updateEvent(id: string, patch: Partial<StoryEvent>) {
    setEvents((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
  }

  function reorderEvent(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    setEvents((current) => {
      const from = current.findIndex((event) => event.id === dragId);
      const to = current.findIndex((event) => event.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function reorderPhoto(eventId: string, sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setEvents((current) => current.map((event) => {
      if (event.id !== eventId) return event;
      const from = event.photoIds.indexOf(sourceId);
      const to = event.photoIds.indexOf(targetId);
      if (from < 0 || to < 0) return event;
      const photoIds = [...event.photoIds];
      const [moved] = photoIds.splice(from, 1);
      photoIds.splice(to, 0, moved);
      return { ...event, photoIds };
    }));
  }

  function moveEvent(eventId: string, direction: -1 | 1) {
    setEvents((current) => {
      const from = current.findIndex((event) => event.id === eventId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function beginEventDrag(e: React.PointerEvent<HTMLButtonElement>, eventId: string) {
    e.preventDefault();
    e.stopPropagation();
    dragEventIdRef.current = eventId;
    setDragEventId(eventId);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function continueEventDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const sourceId = dragEventIdRef.current;
    if (!sourceId) return;
    const underPointer = document.elementFromPoint(e.clientX, e.clientY);
    const target = underPointer?.closest("[data-sort-event-id]") as HTMLElement | null;
    const targetId = target?.dataset.sortEventId;
    if (targetId && targetId !== sourceId) reorderEvent(sourceId, targetId);
  }

  function endEventDrag(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    dragEventIdRef.current = null;
    setDragEventId(null);
  }

  function splitEvent(index: number) {
    const event = events[index];
    if (!event || event.photoIds.length < 2) return;
    const split = event.photoIds.map((photoId) => {
      const photo = photoById.get(photoId)!;
      return {
        id: `event-${crypto.randomUUID()}`,
        photoIds: [photoId],
        takenAt: photo.takenAt,
        location: photo.location,
        memory: event.memory,
        photoLayout: "auto",
      } satisfies StoryEvent;
    });
    setEvents((current) => [...current.slice(0, index), ...split, ...current.slice(index + 1)]);
  }

  function mergePrevious(index: number) {
    if (index <= 0) return;
    setEvents((current) => {
      const previous = current[index - 1];
      const currentEvent = current[index];
      const merged: StoryEvent = {
        ...previous,
        photoIds: [...previous.photoIds, ...currentEvent.photoIds],
        memory: previous.memory || currentEvent.memory,
      };
      return [...current.slice(0, index - 1), merged, ...current.slice(index + 1)];
    });
  }

  async function createPdf() {
    setPdfBusy(true);
    try {
      const blob = await generateStoryPdf({ title, events, photos, settings: pdfSettings });
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfBlob(blob);
      setPdfUrl(url);
      setStep(3);
    } finally {
      setPdfBusy(false);
    }
  }

  function downloadPdf() {
    if (!pdfBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(pdfBlob);
    a.download = `${title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "photostory"}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <main className="appShell">
      <Header step={step} />

      {step === 0 && (
        <div className="workspace uploadWorkspace">
          <UploadSidebar />
          <section className="contentColumn">
            <div className="pageHeading">
              <div>
                <p className="eyebrow">Start your story</p>
                <h1>Upload your photos</h1>
                <p>Choose your photo collection and we’ll arrange it into a chronological story.</p>
              </div>
            </div>

            <div
              className={cn("dropzone", dragging && "dragging")}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <input
                ref={inputRef}
                className="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
                multiple
                onChange={onChoose}
              />
              {processing ? (
                <>
                  <div className="uploadIcon"><Loader2 className="spin" size={28} /></div>
                  <h2>Reading photo details…</h2>
                  <p>Dates, camera metadata and GPS are being read locally.</p>
                  <div className="progressTrack"><span style={{ width: `${progress}%` }} /></div>
                  <strong>{progress}%</strong>
                </>
              ) : (
                <>
                  <div className="uploadIcon"><UploadCloud size={28} /></div>
                  <h2>Drag & drop your photos here</h2>
                  <p>or choose files from your device</p>
                  <button className="primaryButton" type="button">Choose photos</button>
                  <span className="microCopy">JPEG, PNG, HEIC, HEIF · Multiple files supported</span>
                </>
              )}
            </div>

            {!!photos.length && (
              <>
                <div className="statsBar">
                  <span><Images size={15} /> <strong>{photos.length}</strong> photos</span>
                  <span><CalendarDays size={15} /> {dateRange}</span>
                  <span><Sparkles size={15} /> {events.length} moments detected</span>
                </div>
                <div className="sectionTitleRow">
                  <h2>Uploaded photos</h2>
                  <button className="textButton" type="button" onClick={() => {
                    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
                    setPhotos([]); setEvents([]);
                  }}>Clear all</button>
                </div>
                <div className="thumbGrid">
                  {sortedPhotos.map((photo) => {
                    const dt = formatDateTime(photo.takenAt);
                    return (
                      <article className="uploadCard" key={photo.id}>
                        <PhotoThumb photo={photo} />
                        <button className="removePhoto" type="button" onClick={() => removePhoto(photo.id)} aria-label="Remove photo"><X size={14} /></button>
                        <div className="uploadMeta">
                          <strong>{dt.date}</strong>
                          <span>{dt.time}</span>
                          <span className="locationLine"><MapPin size={12} /> {photo.location || "Location not found"}</span>
                        </div>
                      </article>
                    );
                  })}
                  <button className="addPhotoCard" type="button" onClick={() => inputRef.current?.click()}><Plus size={20} /><span>Add photos</span></button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {step === 1 && (
        <div className="workspace storyWorkspace">
          <aside className="sideRail">
            <SideCard title="Your story">
              <div className="summaryStat"><span>{events.length}</span><small>Moments</small></div>
              <div className="summaryStat"><span>{photos.length}</span><small>Photos</small></div>
              <p className="mutedTiny">{dateRange}</p>
            </SideCard>
            <SideCard title="Tips">
              <p><GripVertical size={15} /> Drag any moment by its grip handle to reorder it.</p>
              <p><Scissors size={15} /> Split a group if the photos belong to different memories.</p>
              <p><Merge size={15} /> Merge moments that should stay together.</p>
              <p><MapPin size={15} /> You can fix missing or incorrect locations.</p>
            </SideCard>
          </aside>

          <section className="contentColumn narrowTimeline">
            <div className="pageHeading horizontalHeading">
              <div>
                <p className="eyebrow">Chronological story</p>
                <h1>Build your timeline</h1>
                <p>Your photos are grouped automatically. Add the memories that make the story yours.</p>
              </div>
              <button className="secondaryButton" type="button" onClick={() => inputRef.current?.click()}><Plus size={15} /> Add photos</button>
            </div>

            <div className="timeline">
              {events.map((event, index) => {
                const eventPhotos = event.photoIds.map((id) => photoById.get(id)).filter(Boolean) as StoryPhoto[];
                const dt = formatDateTime(event.takenAt);
                return (
                  <article
                    className={cn("timelineRow sortableEvent", dragEventId === event.id && "isDragging")}
                    key={event.id}
                    data-sort-event-id={event.id}
                  >
                    <div className="timelineRail"><span className="timelineDot" /></div>
                    <div className="eventCard">
                      <EventPhotoGallery photos={eventPhotos} layout={event.photoLayout} className="storyGallery" />

                      <div className="eventContent">
                        <div className="eventMetaRow">
                          <label><CalendarDays size={14} /><input type="datetime-local" value={formatInputDate(event.takenAt)} onChange={(e) => updateEvent(event.id, { takenAt: new Date(e.target.value).toISOString() })} /></label>
                          <span className="timeReadout"><Clock3 size={13} /> {dt.time}</span>
                        </div>
                        <label className="locationEditor"><MapPin size={14} /><input value={event.location} placeholder="Add location" onChange={(e) => updateEvent(event.id, { location: e.target.value })} /></label>
                        <div className="memoryBox">
                          <textarea value={event.memory} maxLength={500} placeholder="Write what you remember about this moment…" onChange={(e) => updateEvent(event.id, { memory: e.target.value })} />
                          <span>{event.memory.length}/500</span>
                        </div>
                        <div className="layoutPicker" aria-label="Photo display layout">
                          <span>Photo layout</span>
                          <div>
                            {PHOTO_LAYOUTS.map((option) => (
                              <button
                                className={cn(event.photoLayout === option.value && "active")}
                                type="button"
                                key={option.value}
                                onClick={() => updateEvent(event.id, { photoLayout: option.value })}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="eventActions">
                        <button
                          className="dragHandle"
                          type="button"
                          title="Drag to reorder"
                          aria-label={`Drag moment ${index + 1} to reorder`}
                          onPointerDown={(e) => beginEventDrag(e, event.id)}
                          onPointerMove={continueEventDrag}
                          onPointerUp={endEventDrag}
                          onPointerCancel={endEventDrag}
                        ><GripVertical size={16} /></button>
                        <button type="button" title="Merge with previous" disabled={index === 0} onClick={() => mergePrevious(index)}><Merge size={15} /></button>
                        <button type="button" title="Split group" disabled={event.photoIds.length < 2} onClick={() => splitEvent(index)}><Scissors size={15} /></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {step === 2 && (
        <div className="workspace reviewWorkspace">
          <aside className="sideRail">
            <SideCard title="Story overview">
              <div className="overviewRows">
                <span><Images size={14} /> {photos.length} photos</span>
                <span><Sparkles size={14} /> {events.length} moments</span>
                <span><CalendarDays size={14} /> {dateRange}</span>
              </div>
            </SideCard>
            <SideCard title="PDF setup">
              <label className="settingRow"><span>Story title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label className="settingRow"><span>Maximum photos per page</span>
                <select value={pdfSettings.photosPerPage} onChange={(e) => setPdfSettings((s) => ({ ...s, photosPerPage: Number(e.target.value) as 1 | 2 | 3 | 4 | 6 }))}>
                  <option value={1}>1 photo</option><option value={2}>2 photos</option><option value={3}>3 photos</option><option value={4}>4 photos</option><option value={6}>6 photos</option>
                </select>
              </label>
              <div className="settingBlock">
                <span>PDF photo layout</span>
                <div className="pdfLayoutChoices">
                  {PHOTO_LAYOUTS.map((option) => (
                    <button
                      className={cn(pdfSettings.pageLayout === option.value && "active")}
                      type="button"
                      key={option.value}
                      onClick={() => setPdfSettings((current) => ({ ...current, pageLayout: option.value }))}
                    >
                      <span className={cn("layoutMini", `mini-${option.value}`)} aria-hidden="true"><i /><i /><i /><i /></span>
                      {option.label}
                    </button>
                  ))}
                </div>
                <small>Auto follows each moment's layout. Grid, Strip and Feature apply one style throughout the PDF.</small>
              </div>
              <label className="toggleRow"><span>Rounded photo frames</span><input type="checkbox" checked={pdfSettings.roundedCorners} onChange={(e) => setPdfSettings((s) => ({ ...s, roundedCorners: e.target.checked }))} /></label>
              <label className="toggleRow"><span>Cover page</span><input type="checkbox" checked={pdfSettings.includeCover} onChange={(e) => setPdfSettings((s) => ({ ...s, includeCover: e.target.checked }))} /></label>
              <label className="toggleRow"><span>Timestamp</span><input type="checkbox" checked={pdfSettings.includeTimestamp} onChange={(e) => setPdfSettings((s) => ({ ...s, includeTimestamp: e.target.checked }))} /></label>
              <label className="toggleRow"><span>Location</span><input type="checkbox" checked={pdfSettings.includeLocation} onChange={(e) => setPdfSettings((s) => ({ ...s, includeLocation: e.target.checked }))} /></label>
            </SideCard>
          </aside>

          <section className="contentColumn reviewColumn">
            <div className="pageHeading">
              <div>
                <p className="eyebrow">Final review</p>
                <h1>Review your story</h1>
                <p>Check the order, captions, dates and locations before creating your PDF.</p>
              </div>
            </div>

            <section className="documentPreview" aria-label="Editable document preview">
              {pdfSettings.includeCover && (
                <article className="paperPage coverPreview">
                  <span className="pageBadge">Cover</span>
                  <div><h2>{title || "Our Journey"}</h2><p>{photos.length} photos · {events.length} moments</p></div>
                </article>
              )}
              {reviewPages.map((page, pageIndex) => (
                <article className="paperPage" key={`page-${pageIndex}`}>
                  <header className="paperHeader">
                    <div><span className="pageBadge">Page {pageIndex + 1}</span><strong>{title || "Our Journey"}</strong></div>
                    <small>{page.length} {page.length === 1 ? "moment" : "moments"} on this page</small>
                  </header>
                  <div className="paperMoments">
                    {page.map(({ event, photos: chunk, chunkIndex, chunkCount }) => {
                      const taken = formatDateTime(event.takenAt);
                      const layout = pdfSettings.pageLayout === "auto" ? event.photoLayout : pdfSettings.pageLayout;
                      return (
                        <section
                          className={cn("paperMoment sortableEvent", selectedEventId === event.id && "selected", dragEventId === event.id && "isDragging")}
                          key={`${event.id}-${chunkIndex}`}
                          data-sort-event-id={event.id}
                          onClick={() => setSelectedEventId(event.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedEventId(event.id); }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="paperMomentHeading">
                            <span>
                              {pdfSettings.includeTimestamp && `${taken.date} · ${taken.time}`}
                              {pdfSettings.includeTimestamp && pdfSettings.includeLocation && event.location && " · "}
                              {pdfSettings.includeLocation && event.location}
                              {chunkIndex > 0 && ` · continued ${chunkIndex + 1}/${chunkCount}`}
                            </span>
                            <div className="paperMomentControls" onClick={(e) => e.stopPropagation()}>
                              <button type="button" aria-label="Move moment earlier" disabled={events[0]?.id === event.id} onClick={() => moveEvent(event.id, -1)}><ArrowUp size={13} /></button>
                              <button type="button" aria-label="Move moment later" disabled={events[events.length - 1]?.id === event.id} onClick={() => moveEvent(event.id, 1)}><ArrowDown size={13} /></button>
                              <button
                                className="dragHandle paperDragHandle"
                                type="button"
                                aria-label="Drag moment to reorder"
                                onPointerDown={(e) => beginEventDrag(e, event.id)}
                                onPointerMove={continueEventDrag}
                                onPointerUp={endEventDrag}
                                onPointerCancel={endEventDrag}
                              ><GripVertical size={15} /></button>
                            </div>
                          </div>
                          <EventPhotoGallery
                            photos={chunk}
                            layout={layout}
                            className={cn("paperGallery", !pdfSettings.roundedCorners && "squareCorners")}
                            max={pdfSettings.photosPerPage}
                            onReorderPhoto={(sourceId, targetId) => reorderPhoto(event.id, sourceId, targetId)}
                          />
                          {chunkIndex === chunkCount - 1 && <p>{event.memory || "Add a memory to this moment."}</p>}
                        </section>
                      );
                    })}
                  </div>
                </article>
              ))}
            </section>

          </section>

          {selectedEvent && (
            <aside className="editPanel">
              <div className="editPanelHeader"><strong>Edit moment</strong><button type="button" onClick={() => setSelectedEventId(null)}><X size={16} /></button></div>
              <div className="editPhotoStrip">
                {selectedEvent.photoIds.slice(0, 4).map((id) => {
                  const photo = photoById.get(id);
                  return photo ? <PhotoThumb key={id} photo={photo} compact /> : <EmptyThumb key={id} />;
                })}
              </div>
              <label className="fieldLabel">Date & time<input type="datetime-local" value={formatInputDate(selectedEvent.takenAt)} onChange={(e) => updateEvent(selectedEvent.id, { takenAt: new Date(e.target.value).toISOString() })} /></label>
              <label className="fieldLabel">Location<input value={selectedEvent.location} placeholder="Add location" onChange={(e) => updateEvent(selectedEvent.id, { location: e.target.value })} /></label>
              <label className="fieldLabel">Memory<textarea rows={7} value={selectedEvent.memory} maxLength={500} placeholder="Write a memory…" onChange={(e) => updateEvent(selectedEvent.id, { memory: e.target.value })} /></label>
              <div className="fieldLabel">Photo layout
                <div className="panelLayoutChoices">
                  {PHOTO_LAYOUTS.map((option) => (
                    <button
                      className={cn(selectedEvent.photoLayout === option.value && "active")}
                      type="button"
                      key={option.value}
                      onClick={() => updateEvent(selectedEvent.id, { photoLayout: option.value })}
                    >{option.label}</button>
                  ))}
                </div>
              </div>
              <div className="panelFooter"><button className="primaryButton full" type="button" onClick={() => setSelectedEventId(null)}>Save changes</button></div>
            </aside>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="pdfWorkspace">
          <section className="pdfReadyCard">
            <div className="successMark"><Check size={30} /></div>
            <p className="eyebrow">Print-ready A4 document</p>
            <h1>Your PDF is ready</h1>
            <p>Your photo story was generated in your browser. Download it, print it, or go back and make changes.</p>
            <div className="pdfFileCard">
              <FileText size={24} />
              <div><strong>{title || "Our Journey"}.pdf</strong><span>{events.length} moments · {photos.length} photos</span></div>
              <button className="primaryButton" type="button" onClick={downloadPdf}><Download size={16} /> Download PDF</button>
            </div>
            <div className="privacyNote"><LockKeyhole size={15} /> Your photo files were processed locally in this browser.</div>
          </section>
          <section className="pdfPreviewCard">
            <div className="pdfPreviewHeader"><strong>PDF preview</strong><span>A4 portrait</span></div>
            {pdfUrl ? <iframe className="pdfFrame" src={pdfUrl} title="PhotoStory PDF preview" /> : <div className="pdfPlaceholder"><Loader2 className="spin" /></div>}
          </section>
        </div>
      )}

      <footer className="bottomBar">
        <div>
          {step > 0 && <button className="secondaryButton" type="button" onClick={() => setStep((step - 1) as Step)}><ArrowLeft size={15} /> Back</button>}
        </div>
        <div className="bottomSummary">
          {photos.length > 0 && <span>{photos.length} photos · {events.length} moments</span>}
        </div>
        <div>
          {step === 0 && <button className="primaryButton" disabled={!photos.length || processing} type="button" onClick={() => setStep(1)}>Continue to story <ArrowRight size={15} /></button>}
          {step === 1 && <button className="primaryButton" disabled={!events.length} type="button" onClick={() => setStep(2)}>Continue to review <ArrowRight size={15} /></button>}
          {step === 2 && <button className="primaryButton" disabled={!events.length || pdfBusy} type="button" onClick={() => void createPdf()}>{pdfBusy ? <Loader2 className="spin" size={15} /> : <FileText size={15} />} Generate PDF <ArrowRight size={15} /></button>}
          {step === 3 && <button className="primaryButton" type="button" onClick={downloadPdf}><Download size={15} /> Download PDF</button>}
        </div>
      </footer>
    </main>
  );
}
