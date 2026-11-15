import { Borough } from '@/types/surcharge';

export async function geocodeNYCAddress(
  query: string,
  borough: Borough
): Promise<{ latitude: number; longitude: number } | null> {
  if (!query.trim()) return null;
  try {
    const q = encodeURIComponent(`${query}, ${borough}, New York City, NY`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}
