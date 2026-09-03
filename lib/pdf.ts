import { jsPDF } from "jspdf";
import type { PdfPageLayout, PhotoLayout, PdfSettings, StoryEvent, StoryPhoto } from "./types";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAGE_BOTTOM = PAGE_H - MARGIN;

type Rect = { x: number; y: number; w: number; h: number };
type RenderLayout = Exclude<PhotoLayout, "auto">;

function safeText(text: string) {
  return text.trim() || "Add a memory to this moment.";
}

function photoRatio(photo: StoryPhoto) {
  return (photo.width ?? 4) / (photo.height ?? 3);
}

function resolveLayout(layout: PdfPageLayout | PhotoLayout, photos: StoryPhoto[]): RenderLayout {
  const count = photos.length;
  if (layout !== "auto") {
    if (layout === "feature" && count < 3) return "strip";
    if (layout === "feature" && count > 5) return "grid";
    return layout;
  }
  if (count === 1) return "strip";
  if (count === 2) return photos.every((photo) => photoRatio(photo) >= 1.15) ? "grid" : "strip";
  if (count <= 4) {
    const ratios = photos.map(photoRatio);
    return Math.max(...ratios) - Math.min(...ratios) > 0.45 ? "feature" : "grid";
  }
  return "grid";
}

function imageAreaHeight(count: number, layout: RenderLayout) {
  if (count === 1) return 78;
  if (layout === "strip" && count <= 3) return 58;
  if (count <= 4) return 82;
  return 94;
}

function gridRects(photos: StoryPhoto[], x: number, y: number, w: number, h: number): Rect[] {
  const count = photos.length;
  const gap = 4;
  // Two landscape photos look substantially better stacked; two portrait
  // photos use side-by-side columns. Mixed pairs follow the available page.
  const bothLandscape = count === 2 && photos.every((photo) => (photo.width ?? 4) / (photo.height ?? 3) >= 1.15);
  const columns = count === 2 ? (bothLandscape ? 1 : 2) : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const cellW = (w - gap * (columns - 1)) / columns;
  const cellH = (h - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, index) => ({
    x: x + (index % columns) * (cellW + gap),
    y: y + Math.floor(index / columns) * (cellH + gap),
    w: cellW,
    h: cellH,
  }));
}

function stripRects(photos: StoryPhoto[], x: number, y: number, w: number, h: number): Rect[] {
  const count = photos.length;
  const gap = 4;
  const cellW = (w - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => ({
    x: x + index * (cellW + gap),
    y,
    w: cellW,
    h,
  }));
}

function featureRects(photos: StoryPhoto[], x: number, y: number, w: number, h: number): Rect[] {
  const count = photos.length;
  if (count < 3 || count > 5) return gridRects(photos, x, y, w, h);
  const gap = 4;
  const featureW = w * 0.62;
  const sideW = w - featureW - gap;
  const sideCount = count - 1;
  const sideH = (h - gap * (sideCount - 1)) / sideCount;
  const featureIndex = photos.reduce(
    (best, photo, index) => photoRatio(photo) > photoRatio(photos[best]) ? index : best,
    0,
  );
  const rects: Rect[] = new Array(count);
  rects[featureIndex] = { x, y, w: featureW, h };
  let sideIndex = 0;
  for (let i = 0; i < count; i++) {
    if (i === featureIndex) continue;
    rects[i] = {
      x: x + featureW + gap,
      y: y + sideIndex * (sideH + gap),
      w: sideW,
      h: sideH,
    };
    sideIndex++;
  }
  return rects;
}

function layoutRects(layout: RenderLayout, photos: StoryPhoto[], x: number, y: number, w: number, h: number) {
  if (layout === "feature") return featureRects(photos, x, y, w, h);
  if (layout === "strip") return stripRects(photos, x, y, w, h);
  return gridRects(photos, x, y, w, h);
}

async function fittedPhotoData(photo: StoryPhoto, rect: Rect, rounded: boolean) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not decode photo for PDF"));
    element.src = photo.pdfDataUrl;
  });
  const targetRatio = rect.w / rect.h;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = sh * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = sw / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(1600, Math.max(500, Math.round(rect.w * 7)));
  canvas.height = Math.round(canvas.width / targetRatio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (rounded) {
    const radius = Math.min(canvas.width, canvas.height) * 0.025;
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, radius);
    context.clip();
  }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  // PNG avoids jsPDF's JPEG encoder/compression path, which can turn some
  // browser-generated canvases into repeated vertical bands in the PDF.
  return canvas.toDataURL("image/png");
}

async function drawPhoto(doc: jsPDF, photo: StoryPhoto, rect: Rect, rounded: boolean) {

  try {
    const fitted = await fittedPhotoData(photo, rect, rounded);
    doc.addImage(
      fitted,
      "PNG",
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      undefined,
      "NONE",
    );
  } catch {
    doc.setTextColor(145, 145, 140);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Photo unavailable", rect.x + rect.w / 2, rect.y + rect.h / 2, { align: "center" });
  }
}

export async function generateStoryPdf(args: {
  title: string;
  events: StoryEvent[];
  photos: StoryPhoto[];
  settings: PdfSettings;
}) {
  const { title, events, photos, settings } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const byId = new Map(photos.map((photo) => [photo.id, photo]));

  const addHeader = () => {
    doc.setTextColor(18, 18, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title || "Our Journey", MARGIN, 17);
    doc.setDrawColor(228, 228, 224);
    doc.line(MARGIN, 22, PAGE_W - MARGIN, 22);
  };

  if (settings.includeCover) {
    doc.setTextColor(18, 18, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(title || "Our Journey", PAGE_W / 2, 118, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(`${photos.length} photos • ${events.length} moments`, PAGE_W / 2, 130, { align: "center" });
    doc.addPage();
  }

  addHeader();
  let y = 30;
  let photosOnPage = 0;

  const newPage = () => {
    doc.addPage();
    addHeader();
    y = 30;
    photosOnPage = 0;
  };

  for (const event of events) {
    const eventPhotos = event.photoIds.map((photoId) => byId.get(photoId)).filter(Boolean) as StoryPhoto[];
    if (!eventPhotos.length) continue;

    const chunks: StoryPhoto[][] = [];
    for (let i = 0; i < eventPhotos.length; i += settings.photosPerPage) {
      chunks.push(eventPhotos.slice(i, i + settings.photosPerPage));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chosenLayout = settings.pageLayout === "auto" ? event.photoLayout : settings.pageLayout;
      const layout = resolveLayout(chosenLayout, chunk);
      const taken = new Date(event.takenAt);
      const date = taken.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      const time = taken.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const meta = [
        settings.includeTimestamp ? `${date} · ${time}` : "",
        settings.includeLocation ? event.location : "",
      ].filter(Boolean).join("  •  ");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      const memoryLines = chunkIndex === chunks.length - 1
        ? doc.splitTextToSize(safeText(event.memory), CONTENT_W)
        : [`${chunkIndex * settings.photosPerPage + chunk.length} of ${eventPhotos.length} photos`];
      const visibleMemoryLines = memoryLines.slice(0, 4);
      const memoryHeight = visibleMemoryLines.length * 4.6 + 5;
      const imageHeight = imageAreaHeight(chunk.length, layout);
      const blockHeight = 6 + imageHeight + 6 + memoryHeight + 8;

      if (photosOnPage > 0 && photosOnPage + chunk.length > settings.photosPerPage) newPage();
      if (y + blockHeight > PAGE_BOTTOM && photosOnPage > 0) newPage();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(38, 38, 38);
      const continuation = chunkIndex > 0 ? " · continued" : "";
      doc.text(`${meta || "Moment"}${continuation}`, MARGIN, y);
      y += 6;

      const rects = layoutRects(layout, chunk, MARGIN, y, CONTENT_W, imageHeight);
      for (let index = 0; index < chunk.length; index++) {
        await drawPhoto(doc, chunk[index], rects[index], settings.roundedCorners);
      }
      y += imageHeight + 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(chunkIndex === chunks.length - 1 ? 9.2 : 8.4);
      doc.setTextColor(chunkIndex === chunks.length - 1 ? 52 : 118, chunkIndex === chunks.length - 1 ? 52 : 118, chunkIndex === chunks.length - 1 ? 52 : 118);
      doc.text(visibleMemoryLines, MARGIN, y + 3.5);
      y += memoryHeight;

      doc.setDrawColor(235, 235, 231);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 8;
      photosOnPage += chunk.length;
    }
  }

  return doc.output("blob");
}
