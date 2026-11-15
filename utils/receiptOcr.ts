import { Borough, MerchantCategory } from '@/types/surcharge';
import { computeSurchargePct } from '@/utils/surchargeRules';

export interface ExtractedReceiptData {
  businessName: string;
  address: string;
  neighborhood: string;
  borough: Borough;
  category: MerchantCategory;
  subtotal: number;
  surchargeAmount: number;
  surchargePct: number;
  chargedOnTax: boolean;
  transactionDate: string;
  rawSummary: string;
}

export interface SampleReceipt extends ExtractedReceiptData {
  id: string;
  label: string;
  receiptDataUri: string;
  latitude: number;
  longitude: number;
}

function makeReceiptSvgDataUri(lines: {
  name: string;
  address: string;
  date: string;
  items: { label: string; price: string }[];
  subtotal: string;
  tax: string;
  feeLabel: string;
  feeAmount: string;
  total: string;
}): string {
  const itemRows = lines.items
    .map(
      (it, idx) =>
        `<text x="28" y="${145 + idx * 24}" font-family="monospace" font-size="13" fill="#1e293b">${it.label}</text>
         <text x="332" y="${145 + idx * 24}" font-family="monospace" font-size="13" fill="#1e293b" text-anchor="end">${it.price}</text>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="340" viewBox="0 0 360 340">
    <rect width="360" height="340" rx="12" fill="#fffef9" stroke="#cbd5e1" stroke-width="2"/>
    <text x="180" y="38" font-family="monospace" font-size="17" font-weight="bold" fill="#0f172a" text-anchor="middle">${lines.name}</text>
    <text x="180" y="58" font-family="monospace" font-size="12" fill="#475569" text-anchor="middle">${lines.address}</text>
    <text x="180" y="78" font-family="monospace" font-size="11" fill="#64748b" text-anchor="middle">${lines.date} • PAID VISA TAP</text>
    <line x1="24" y1="95" x2="336" y2="95" stroke="#94a3b8" stroke-dasharray="4 4"/>
    ${itemRows}
    <line x1="24" y1="205" x2="336" y2="205" stroke="#94a3b8" stroke-dasharray="4 4"/>
    <text x="28" y="230" font-family="monospace" font-size="13" fill="#334155">SUBTOTAL</text>
    <text x="332" y="230" font-family="monospace" font-size="13" fill="#334155" text-anchor="end">${lines.subtotal}</text>
    <text x="28" y="252" font-family="monospace" font-size="13" fill="#334155">NYC TAX (8.875%)</text>
    <text x="332" y="252" font-family="monospace" font-size="13" fill="#334155" text-anchor="end">${lines.tax}</text>
    <rect x="20" y="263" width="320" height="26" rx="4" fill="#fee2e2"/>
    <text x="28" y="281" font-family="monospace" font-size="13" font-weight="bold" fill="#b91c1c">${lines.feeLabel}</text>
    <text x="332" y="281" font-family="monospace" font-size="13" font-weight="bold" fill="#b91c1c" text-anchor="end">${lines.feeAmount}</text>
    <line x1="24" y1="300" x2="336" y2="300" stroke="#0f172a" stroke-width="1.5"/>
    <text x="28" y="322" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a">TOTAL CHARGED</text>
    <text x="332" y="322" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a" text-anchor="end">${lines.total}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_RECEIPTS: SampleReceipt[] = [
  {
    id: 'sample-1',
    label: 'Bleecker St Bistro (4.0% Fee)',
    businessName: 'Bleecker Street Bistro',
    address: '245 Bleecker St',
    neighborhood: 'West Village',
    borough: 'Manhattan',
    category: 'Restaurant',
    subtotal: 65.0,
    surchargeAmount: 2.6,
    surchargePct: 4.0,
    chargedOnTax: false,
    transactionDate: new Date().toISOString().slice(0, 10),
    latitude: 40.7314,
    longitude: -74.0032,
    rawSummary:
      'Detected "NON-CASH ADJ (4.0%): $2.60" on $65.00 subtotal (Violates NY GBL § 518 & 3% Visa Cap)',
    receiptDataUri: makeReceiptSvgDataUri({
      name: 'BLEECKER STREET BISTRO',
      address: '245 Bleecker St, New York, NY',
      date: new Date().toISOString().slice(0, 10),
      items: [
        { label: '1x Rigatoni Vodka', price: '$26.00' },
        { label: '1x Branzino Filet', price: '$32.00' },
        { label: '1x Espresso', price: '$7.00' },
      ],
      subtotal: '$65.00',
      tax: '$5.77',
      feeLabel: 'NON-CASH ADJ (4.0%)',
      feeAmount: '$2.60',
      total: '$73.37',
    }),
  },
  {
    id: 'sample-2',
    label: 'Williamsburg Deli (4.5% + Taxed)',
    businessName: 'Bedford Ave Artisan Deli',
    address: '194 Bedford Ave',
    neighborhood: 'Williamsburg',
    borough: 'Brooklyn',
    category: 'Bodega & Grocery',
    subtotal: 24.0,
    surchargeAmount: 1.18,
    surchargePct: 4.9,
    chargedOnTax: true,
    transactionDate: new Date().toISOString().slice(0, 10),
    latitude: 40.7181,
    longitude: -73.9571,
    rawSummary:
      'Detected "CC SURCHARGE 4.5%: $1.18" calculated on post-tax total ($26.13)',
    receiptDataUri: makeReceiptSvgDataUri({
      name: 'BEDFORD AVE ARTISAN DELI',
      address: '194 Bedford Ave, Brooklyn, NY',
      date: new Date().toISOString().slice(0, 10),
      items: [
        { label: '1x Hot Pastrami Hero', price: '$16.50' },
        { label: '1x Cold Brew + Chips', price: '$7.50' },
      ],
      subtotal: '$24.00',
      tax: '$2.13',
      feeLabel: 'CC SURCHARGE (ON TOTAL)',
      feeAmount: '$1.18',
      total: '$27.31',
    }),
  },
];

export function parseReceiptText(rawText: string): Partial<ExtractedReceiptData> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const businessName = lines[0] || 'NYC Merchant';

  const moneyRegex = /\$?\s*(\d{1,4}\.\d{2})/;
  let subtotal: number | undefined;
  let surchargeAmount: number | undefined;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const match = line.match(moneyRegex);
    if (!match) continue;
    const val = parseFloat(match[1]);

    if (lower.includes('subtotal') || lower.includes('sub total')) {
      subtotal = val;
    } else if (
      lower.includes('non-cash') ||
      lower.includes('surcharge') ||
      lower.includes('card fee') ||
      lower.includes('cc fee') ||
      lower.includes('credit fee') ||
      lower.includes('service fee')
    ) {
      surchargeAmount = val;
    }
  }

  const surchargePct =
    subtotal && surchargeAmount
      ? computeSurchargePct(subtotal, surchargeAmount)
      : undefined;

  return {
    businessName,
    subtotal,
    surchargeAmount,
    surchargePct,
    transactionDate: new Date().toISOString().slice(0, 10),
  };
}

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
