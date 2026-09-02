import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("zoom", "12");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "PhotoStory/0.1 (local-first photo timeline app)",
        "Accept-Language": "en",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ displayName: data.display_name ?? null });
  } catch {
    return NextResponse.json({ displayName: null }, { status: 200 });
  }
}
