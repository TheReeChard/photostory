export type PhotoLayout = "auto" | "strip" | "grid" | "feature";
export type PdfPageLayout = "auto" | "strip" | "grid" | "feature";

export type StoryPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  pdfDataUrl: string;
  width?: number;
  height?: number;
  takenAt: string;
  latitude?: number;
  longitude?: number;
  location: string;
  locationSource: "gps" | "manual" | "missing";
};

export type StoryEvent = {
  id: string;
  photoIds: string[];
  takenAt: string;
  location: string;
  memory: string;
  photoLayout: PhotoLayout;
};

export type StoryProject = {
  title: string;
  photos: StoryPhoto[];
  events: StoryEvent[];
};

export type PdfSettings = {
  photosPerPage: 1 | 2 | 3 | 4 | 6;
  pageLayout: PdfPageLayout;
  roundedCorners: boolean;
  includeLocation: boolean;
  includeTimestamp: boolean;
  includeCover: boolean;
};
