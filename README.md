# PhotoStory — local-first MVP

A responsive Next.js web app that turns a user's photo collection into a chronological story and a print-ready A4 PDF.

## What is implemented

- Multi-photo drag/drop and file picker
- JPEG, PNG, HEIC and HEIF support
- Browser-side EXIF parsing for capture date/time and GPS
- HEIC/HEIF conversion for browser preview/PDF generation
- Reverse geocoding through a tiny Next.js API route (only latitude/longitude are sent; photo files stay local)
- Automatic chronological event grouping
- Timeline editing: date/time, location, memory/caption
- Pointer/touch-friendly drag handles to reorder moments on both Story and Review screens
- Manual split and merge for detected moments
- Per-moment photo display choices: Auto, Strip, Grid, and Feature
- Review screen with edit panel and layout controls
- Responsive desktop/tablet/mobile layout
- A4 PDF generation in the browser using jsPDF
- 1, 2, 3, 4, or 6 maximum photos per PDF page
- PDF layout choices: Auto, Strip, Grid, and Feature
- Aspect-ratio-safe photo rendering in the app and PDF — photos are fitted rather than stretched
- Rounded photo-frame, cover-page, timestamp, and location options
- PDF preview and download
- No accounts and no photo upload/storage

## Privacy model

Photo bytes are read and processed inside the browser. The application does **not** upload the photo files to the server.

If a photo contains GPS coordinates, the current MVP calls `/api/reverse-geocode`, which forwards **only latitude and longitude** to OpenStreetMap Nominatim to obtain a human-readable location. If you want a strict zero-network mode later, this lookup can be disabled and the UI can show coordinates or require manual location entry.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Production notes

Before public launch, replace the public Nominatim dependency with a production geocoding provider or a properly hosted geocoding service with caching and an explicit privacy policy. Large photo collections should also move image decoding/PDF work to Web Workers to keep the UI responsive.

## Suggested V2

- IndexedDB local project persistence
- Optional account + cloud project sync
- User-controlled grouping thresholds
- Drag photos between moments and reorder photos inside a moment
- Page-by-page PDF layout editor and manual page breaks
- Cover templates and typography themes
- Shareable projects/PDF links
- Background/Web Worker processing for large libraries
