import { Borough, Merchant, MerchantCategory } from '@/types/surcharge';

interface NYC311Row {
  unique_key?: string;
  created_date?: string;
  agency?: string;
  complaint_type?: string;
  descriptor?: string;
  location_type?: string;
  incident_address?: string;
  street_name?: string;
  city?: string;
  borough?: string;
  latitude?: string;
  longitude?: string;
}

export interface NYCGeoSuggestion {
  id: string;
  label: string;
  name: string;
  streetAddress: string;
  neighborhood: string;
  borough: Borough;
  latitude: number;
  longitude: number;
}

function normalizeBorough(raw?: string): Borough {
  const b = (raw || '').toLowerCase();
  if (b.includes('brooklyn') || b.includes('kings')) return 'Brooklyn';
  if (b.includes('queens')) return 'Queens';
  if (b.includes('bronx')) return 'Bronx';
  if (b.includes('staten') || b.includes('richmond')) return 'Staten Island';
  return 'Manhattan';
}

function mapCategory(locationType?: string): MerchantCategory {
  const t = (locationType || '').toLowerCase();
  if (t.includes('restaurant') || t.includes('diner')) return 'Restaurant';
  if (t.includes('bar') || t.includes('club') || t.includes('tavern')) {
    return 'Bar & Nightlife';
  }
  if (
    t.includes('grocery') ||
    t.includes('bodega') ||
    t.includes('supermarket') ||
    t.includes('deli')
  ) {
    return 'Bodega & Grocery';
  }
  if (t.includes('bakery') || t.includes('coffee') || t.includes('cafe')) {
    return 'Cafe & Bakery';
  }
  return 'Retail & Services';
}

export async function fetchLiveNYC311Complaints(): Promise<Merchant[]> {
  try {
    const where = encodeURIComponent(
      "agency='DCWP' AND latitude IS NOT NULL AND longitude IS NOT NULL"
    );
    const url = `https://data.cityofnewyork.us/resource/erm2-nwe9.json?$where=${where}&$order=created_date%20DESC&$limit=60`;

    const token = process.env.EXPO_PUBLIC_NYC_OPEN_DATA_TOKEN;
    let res: Response;

    if (token) {
      res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-App-Token': token,
        },
      });
      // If an API Key ID was supplied instead of a Socrata App Token, fallback cleanly
      if (!res.ok) {
        res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
      }
    } else {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
    }

    if (!res.ok) return [];
    const rows = (await res.json()) as NYC311Row[];

    const results: Merchant[] = [];
    const seenAddresses = new Set<string>();

    for (const row of rows) {
      const addr = row.incident_address?.trim();
      const lat = row.latitude ? parseFloat(row.latitude) : NaN;
      const lng = row.longitude ? parseFloat(row.longitude) : NaN;
      if (!addr || Number.isNaN(lat) || Number.isNaN(lng)) continue;

      const key = `${addr.toLowerCase()}-${row.descriptor || ''}`;
      if (seenAddresses.has(key)) continue;
      seenAddresses.add(key);

      const borough = normalizeBorough(row.borough);
      const category = mapCategory(row.location_type);
      const descriptor = row.descriptor || row.complaint_type || 'DCWP Complaint';
      const title = row.location_type
        ? `${row.location_type} • ${addr}`
        : addr;

      results.push({
        id: `311-${row.unique_key || results.length}`,
        name: title,
        address: addr,
        neighborhood: row.city?.trim() || borough,
        borough,
        category,
        latitude: lat,
        longitude: lng,
        surchargePct: 4.0,
        verificationTier: 'dcwp_311',
        lastVerifiedDate:
          (row.created_date || '').slice(0, 10) ||
          new Date().toISOString().slice(0, 10),
        confirmationsCount: 1,
        violations: ['ILLEGAL_LINE_ITEM'],
        notes: `Live NYC 311 / DCWP Complaint: ${descriptor} (SR #${row.unique_key || 'N/A'}). Snap a receipt to verify exact fee %.`,
      });

      if (results.length >= 25) break;
    }

    return results;
  } catch {
    return [];
  }
}

export async function searchNYCAddresses(
  text: string
): Promise<NYCGeoSuggestion[]> {
  const q = text.trim();
  if (q.length < 3) return [];
  try {
    const url = `https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number] };
        properties?: {
          id?: string;
          label?: string;
          name?: string;
          housenumber?: string;
          street?: string;
          neighbourhood?: string;
          borough?: string;
        };
      }[];
    };

    const suggestions: NYCGeoSuggestion[] = [];
    for (const feat of data.features || []) {
      const coords = feat.geometry?.coordinates;
      const props = feat.properties;
      if (!coords || !props?.name) continue;
      const [lng, lat] = coords;
      const borough = normalizeBorough(props.borough);
      const streetAddress =
        props.housenumber && props.street
          ? `${props.housenumber} ${props.street}`
          : props.name;

      suggestions.push({
        id: props.id || `${lat},${lng}`,
        label: props.label || `${streetAddress}, ${borough}`,
        name: props.name,
        streetAddress,
        neighborhood: props.neighbourhood || borough,
        borough,
        latitude: lat,
        longitude: lng,
      });
      if (suggestions.length >= 5) break;
    }
    return suggestions;
  } catch {
    return [];
  }
}
