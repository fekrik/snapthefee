import { Borough, Merchant } from '@/types/surcharge';

interface SocrataComplaintRow {
  record_id?: string;
  business_name?: string;
  business_category?: string;
  complaint_code?: string;
  intake_date?: string;
  borough?: string;
  street1?: string;
  latitude?: string;
  longitude?: string;
}

const BOROUGH_FALLBACK: Record<Borough, { lat: number; lng: number }> = {
  Manhattan: { lat: 40.7505, lng: -73.9934 },
  Brooklyn: { lat: 40.6928, lng: -73.9903 },
  Queens: { lat: 40.7498, lng: -73.8801 },
  Bronx: { lat: 40.8268, lng: -73.9225 },
  'Staten Island': { lat: 40.6415, lng: -74.0776 },
};

function normalizeBorough(raw?: string): Borough {
  const b = (raw || '').toLowerCase();
  if (b.includes('brooklyn') || b.includes('kings')) return 'Brooklyn';
  if (b.includes('queens')) return 'Queens';
  if (b.includes('bronx')) return 'Bronx';
  if (b.includes('staten') || b.includes('richmond')) return 'Staten Island';
  return 'Manhattan';
}

export async function fetchLiveNYC311Complaints(): Promise<Merchant[]> {
  try {
    const url =
      'https://data.cityofnewyork.us/resource/hang-hxmp.json?$limit=40&$order=intake_date%20DESC';
    const res = await fetch(url);
    if (!res.ok) return [];
    const rows = (await res.json()) as SocrataComplaintRow[];

    const results: Merchant[] = [];
    const seenNames = new Set<string>();

    for (const row of rows) {
      const name = row.business_name?.trim();
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());

      const borough = normalizeBorough(row.borough);
      const base = BOROUGH_FALLBACK[borough];
      const lat = row.latitude
        ? parseFloat(row.latitude)
        : base.lat + (Math.random() - 0.5) * 0.025;
      const lng = row.longitude
        ? parseFloat(row.longitude)
        : base.lng + (Math.random() - 0.5) * 0.025;

      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

      results.push({
        id: `311-${row.record_id || results.length}`,
        name,
        address: row.street1?.trim() || `${borough}, NY`,
        neighborhood: borough,
        borough,
        category: 'Retail & Services',
        latitude: lat,
        longitude: lng,
        surchargePct: 4.0,
        verificationTier: 'dcwp_311',
        lastVerifiedDate: (row.intake_date || '').slice(0, 10) || '2026-11-01',
        confirmationsCount: 1,
        violations: ['ILLEGAL_LINE_ITEM'],
        notes: `Official NYC DCWP Complaint (${row.complaint_code || 'Consumer Pricing'}) — Snap a receipt to verify current fee.`,
      });

      if (results.length >= 8) break;
    }

    return results;
  } catch {
    return [];
  }
}
