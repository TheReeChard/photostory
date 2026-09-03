import * as exifr from "exifr";
import type { StoryEvent, StoryPhoto } from "./types";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function normalizeImage(file: File): Promise<{ previewUrl: string; dataUrl: string; blob: Blob }> {
  const isHeic = HEIC_TYPES.has(file.type) || /\.(heic|heif)$/i.test(file.name);
  let blob: Blob = file;

  if (isHeic) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  return {
    previewUrl: URL.createObjectURL(blob),
    dataUrl: await dataUrlFromBlob(blob),
    blob,
  };
}

function imageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

function exifDate(raw: unknown, fallback: number): Date {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(fallback);
}

async function reverseGeocode(latitude: number, longitude: number) {
  // BigDataCloud provides a key-free endpoint intended for browser/mobile
  // clients. It avoids the inconsistent cross-origin behavior mobile browsers
  // can encounter when calling the public Nominatim service directly.
  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", navigator.language || "en");
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const parts = [data.locality, data.principalSubdivision, data.countryName]
        .filter((part, index, all) => typeof part === "string" && part && all.indexOf(part) === index);
      if (parts.length) return parts.join(", ");
    }
  } catch {
    // Fall through to the OpenStreetMap lookup below.
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "12");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: { "Accept-Language": navigator.language || "en" },
    });
    if (!response.ok) return "";
    const data = await response.json();
    return typeof data.display_name === "string" ? data.display_name : "";
  } catch {
    return "";
  }
}

export async function parsePhoto(file: File): Promise<StoryPhoto> {
  const normalized = await normalizeImage(file);
  const dimensions = await imageDimensions(normalized.previewUrl);

  let metadata: Record<string, unknown> = {};
  try {
    metadata = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      reviveValues: true,
      translateValues: true,
    })) ?? {};
  } catch {
    metadata = {};
  }

  const taken = exifDate(
    metadata.DateTimeOriginal ?? metadata.CreateDate ?? metadata.ModifyDate,
    file.lastModified,
  );

  // Some mobile HEIC/JPEG files expose GPS in a separate IFD that is not
  // returned by the general metadata parse. Ask exifr's GPS reader as a
  // fallback so those photos still populate a location.
  let latitude = typeof metadata.latitude === "number" ? metadata.latitude : undefined;
  let longitude = typeof metadata.longitude === "number" ? metadata.longitude : undefined;
  if (latitude === undefined || longitude === undefined) {
    try {
      const gps = await exifr.gps(file);
      if (typeof gps?.latitude === "number") latitude = gps.latitude;
      if (typeof gps?.longitude === "number") longitude = gps.longitude;
    } catch {
      // A photo without readable GPS is valid and can be labeled manually.
    }
  }
  let location = "";

  if (latitude !== undefined && longitude !== undefined) {
    location = await reverseGeocode(latitude, longitude);
  }

  return {
    id: id("photo"),
    file,
    previewUrl: normalized.previewUrl,
    pdfDataUrl: normalized.dataUrl,
    width: dimensions.width,
    height: dimensions.height,
    takenAt: taken.toISOString(),
    latitude,
    longitude,
    location,
    locationSource: location ? "gps" : latitude !== undefined ? "gps" : "missing",
  };
}

function haversineKm(a: StoryPhoto, b: StoryPhoto) {
  if ([a.latitude, a.longitude, b.latitude, b.longitude].some((v) => typeof v !== "number")) return null;
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const lat1 = toRad(a.latitude!);
  const lat2 = toRad(b.latitude!);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.longitude! - a.longitude!);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function buildEvents(photos: StoryPhoto[]): StoryEvent[] {
  const sorted = [...photos].sort(
    (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
  );
  if (!sorted.length) return [];

  const groups: StoryPhoto[][] = [[sorted[0]]];
  for (const photo of sorted.slice(1)) {
    const current = groups[groups.length - 1];
    const previous = current[current.length - 1];
    const timeGapMinutes =
      (new Date(photo.takenAt).getTime() - new Date(previous.takenAt).getTime()) / 60_000;
    const distanceKm = haversineKm(previous, photo);

    // Same event when photos are close in time, and (when GPS exists) reasonably close in space.
    const sameTimeCluster = timeGapMinutes <= 120;
    const samePlaceCluster = distanceKm === null || distanceKm <= 8;

    if (sameTimeCluster && samePlaceCluster) current.push(photo);
    else groups.push([photo]);
  }

  return groups.map((group) => ({
    id: id("event"),
    photoIds: group.map((p) => p.id),
    takenAt: group[0].takenAt,
    location: group.find((p) => p.location)?.location ?? "",
    memory: "",
    photoLayout: "auto",
  }));
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}
