import { Borough, MerchantCategory } from '@/types/surcharge';
import { NYCGeoSuggestion, searchNYCAddresses } from '@/utils/nycOpenData';

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

export interface ParsedReceiptData {
  rawText: string;
  businessName?: string;
  address?: string;
  borough?: Borough;
  neighborhood?: string;
  category?: MerchantCategory;
  subtotal?: number;
  tax?: number;
  feeAmount?: number;
  surchargePct?: number;
  feeLabel?: string;
  chargedOnTax?: boolean;
  matchedLocation?: NYCGeoSuggestion;
}

const SKIP_HEADER_PATTERNS = [
  /^(welcome|thank\s*you|guest\s*check|customer\s*copy|merchant\s*copy|receipt|sale|transaction|order|table|server|cashier|dine\s*in|take\s*out|delivery|reprint|duplicate|visa|mastercard|amex|discover|debit|credit)$/i,
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/,
  /^\d{1,2}:\d{2}\s*(am|pm)?$/i,
  /^(tel|phone|fax|www\.|http)/i,
  /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
  /^#?\d+$/,
  /^(check|order|table|server|guest|station|pos|term|terminal|auth|appr|aid|tvr|tsi|arc)\s*[#:]?\s*\d*/i,
];

const STREET_REGEX =
  /\b(\d{1,5}\s+[A-Za-z0-9.\s]{2,28}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Pl|Place|Way|Ln|Lane|Dr|Drive|Pkwy|Parkway|Bway|Broadway)\b\.?)/i;

const NYC_ZIP_REGEX = /\b(100\d{2}|101\d{2}|102\d{2}|103\d{2}|104\d{2}|111\d{2}|112\d{2}|113\d{2}|114\d{2}|116\d{2})\b/;

function boroughFromZipOrCity(text: string): Borough | undefined {
  const zipMatch = text.match(NYC_ZIP_REGEX);
  if (zipMatch) {
    const zip = zipMatch[1];
    if (zip.startsWith('100') || zip.startsWith('101') || zip.startsWith('102'))
      return 'Manhattan';
    if (zip.startsWith('103')) return 'Staten Island';
    if (zip.startsWith('104')) return 'Bronx';
    if (zip.startsWith('112')) return 'Brooklyn';
    if (
      zip.startsWith('111') ||
      zip.startsWith('113') ||
      zip.startsWith('114') ||
      zip.startsWith('116')
    )
      return 'Queens';
  }
  if (/\b(brooklyn|bklyn)\b/i.test(text)) return 'Brooklyn';
  if (/\b(queens|astoria|flushing|long island city|lic|jamaica)\b/i.test(text))
    return 'Queens';
  if (/\b(bronx)\b/i.test(text)) return 'Bronx';
  if (/\b(staten island)\b/i.test(text)) return 'Staten Island';
  if (/\b(new york|manhattan|ny\s+100)\b/i.test(text)) return 'Manhattan';
  return undefined;
}

function inferCategoryFromReceipt(text: string): MerchantCategory {
  const lower = text.toLowerCase();
  if (
    /\b(espresso|latte|cappuccino|croissant|bakery|cafe|coffee|matcha|bagel|pastry)\b/.test(
      lower
    )
  ) {
    return 'Cafe & Bakery';
  }
  if (
    /\b(deli|bodega|grocery|market|supermarket|produce|convenience)\b/.test(
      lower
    )
  ) {
    return 'Bodega & Grocery';
  }
  if (
    /\b(bar|tavern|pub|brewery|cocktail|draft|ipa|vodka|tequila|lounge|nightclub)\b/.test(
      lower
    )
  ) {
    return 'Bar & Nightlife';
  }
  if (
    /\b(salon|barber|cleaners|laundry|hardware|pharmacy|auto|repair|spa|nails|retail)\b/.test(
      lower
    )
  ) {
    return 'Retail & Services';
  }
  return 'Restaurant';
}

function extractAmountsOnLine(line: string): number[] {
  const matches = line.match(/\$?\s*(\d{1,5}\.\d{2})\b/g);
  if (!matches) return [];
  return matches
    .map((m) => parseFloat(m.replace(/[^0-9.]/g, '')))
    .filter((n) => !Number.isNaN(n) && n >= 0);
}

/**
 * Parses raw OCR receipt text into structured merchant, subtotal, tax, and card fee fields.
 */
export function parseReceiptText(rawText: string): ParsedReceiptData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l.length > 1);

  let businessName: string | undefined;
  let address: string | undefined;
  let subtotal: number | undefined;
  let tax: number | undefined;
  let total: number | undefined;
  let feeAmount: number | undefined;
  let surchargePct: number | undefined;
  let feeLabel: string | undefined;

  // 1. Look for Street Address in the top 12 lines
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i];
    const streetMatch = line.match(STREET_REGEX);
    if (streetMatch) {
      address = streetMatch[1].trim();
      break;
    }
    if (/^\d{1,5}\s+[A-Za-z0-9\s]{3,25}$/.test(line) && i >= 1 && i <= 5) {
      // Check if next line has NY / Zip
      const nextLine = lines[i + 1] || '';
      if (/\b(NY|New York|Brooklyn|Queens|Bronx)\b/i.test(nextLine)) {
        address = line;
        break;
      }
    }
  }

  // 2. Look for Business Name in the top 6 lines
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (address && line.includes(address)) continue;
    if (STREET_REGEX.test(line)) continue;
    if (NYC_ZIP_REGEX.test(line)) continue;
    if (SKIP_HEADER_PATTERNS.some((rx) => rx.test(line))) continue;
    if (extractAmountsOnLine(line).length > 0) continue;
    // Must contain at least 3 letters
    const letterCount = (line.match(/[A-Za-z]/g) || []).length;
    if (letterCount >= 3 && line.length <= 42) {
      businessName = line
        .replace(/^[*#\-=~]+|[*#\-=~]+$/g, '')
        .trim();
      if (businessName.length >= 2) break;
    }
  }

  // 3. Scan all lines for Subtotal, Tax, Fee/Surcharge, and Total
  const feeRegex =
    /\b(surcharge|non[-\s]?cash\s*(?:adj|adjustment|fee)?|cash\s*discount\s*(?:adj|fee)?|cc\s*fee|card\s*fee|credit\s*card\s*(?:fee|surcharge|adj)|processing\s*fee|service\s*fee|convenience\s*fee|nc\s*adj|dual\s*pricing|card\s*adj)\b/i;

  const subtotalRegex = /\b(sub\s*[-]?total|sub\s*ttl|net\s*total|food\s*total)\b/i;
  const taxRegex = /\b(sales\s*tax|ny[c]?\s*tax|state\s*tax|tax)\b/i;
  const totalRegex = /\b(total|amount\s*due|balance\s*due|grand\s*total|card\s*total|credit\s*price)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    const amounts = extractAmountsOnLine(line);
    // Sometimes the amount for a label is on the very next line in column OCR
    const effectiveAmounts =
      amounts.length > 0 ? amounts : extractAmountsOnLine(nextLine);

    // Check Fee / Surcharge line first
    if (feeRegex.test(line)) {
      const matchLabel = line.match(feeRegex);
      if (matchLabel) {
        feeLabel = matchLabel[0];
      }
      const pctMatch = line.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%/);
      if (pctMatch) {
        const parsedPct = parseFloat(pctMatch[1]);
        if (parsedPct > 0 && parsedPct <= 15) {
          surchargePct = parsedPct;
        }
      }
      if (effectiveAmounts.length > 0) {
        const candidate = effectiveAmounts[effectiveAmounts.length - 1];
        if (candidate > 0 && candidate < 250) {
          feeAmount = candidate;
        }
      }
      continue;
    }

    // Check Subtotal
    if (subtotalRegex.test(line) && effectiveAmounts.length > 0) {
      const candidate = effectiveAmounts[effectiveAmounts.length - 1];
      if (candidate > 0) {
        subtotal = candidate;
      }
      continue;
    }

    // Check Tax (make sure not "pre-tax" or "tax id")
    if (
      taxRegex.test(line) &&
      !/\b(tax\s*id|pre[-\s]?tax|before\s*tax|incl\s*tax)\b/i.test(line) &&
      effectiveAmounts.length > 0
    ) {
      const candidate = effectiveAmounts[effectiveAmounts.length - 1];
      if (candidate >= 0 && (!subtotal || candidate < subtotal * 0.25)) {
        tax = candidate;
      }
      continue;
    }

    // Check Total (make sure not Subtotal)
    if (
      totalRegex.test(line) &&
      !subtotalRegex.test(line) &&
      effectiveAmounts.length > 0
    ) {
      const candidate = effectiveAmounts[effectiveAmounts.length - 1];
      if (candidate > 0 && (!total || candidate >= total)) {
        total = candidate;
      }
    }
  }

  // 4. If subtotal, tax, and total were found, but feeAmount wasn't explicitly matched by keyword,
  // check if there is an unexplained gap between (subtotal + tax) and total that looks like a 2.5%–5% fee,
  // or if a line between subtotal and total has that exact amount!
  if (
    subtotal &&
    subtotal > 0 &&
    feeAmount === undefined &&
    tax !== undefined &&
    total !== undefined
  ) {
    const impliedDiff = +(total - subtotal - tax).toFixed(2);
    const impliedPct = (impliedDiff / subtotal) * 100;
    if (impliedDiff > 0 && impliedPct >= 2.0 && impliedPct <= 6.0) {
      feeAmount = impliedDiff;
      feeLabel = feeLabel || 'Card Surcharge';
    }
  }

  // 5. Check if the surcharge was calculated on (Subtotal + Tax) instead of Subtotal alone
  let chargedOnTax = false;
  if (subtotal && subtotal > 0 && feeAmount && feeAmount > 0 && tax && tax > 0) {
    const pctOnSub = (feeAmount / subtotal) * 100;
    const pctOnSubPlusTax = (feeAmount / (subtotal + tax)) * 100;
    // Common surcharge rates: 3.0%, 3.5%, 3.8%, 3.99%, 4.0%
    const commonRates = [3.0, 3.5, 3.75, 3.8, 3.9, 3.95, 3.99, 4.0];
    const distSub = Math.min(...commonRates.map((r) => Math.abs(pctOnSub - r)));
    const distSubTax = Math.min(
      ...commonRates.map((r) => Math.abs(pctOnSubPlusTax - r))
    );
    if (distSubTax < 0.06 && distSub > 0.12) {
      chargedOnTax = true;
    }
  }

  // 6. Compute surchargePct if we have subtotal and feeAmount
  if (subtotal && subtotal > 0 && feeAmount !== undefined && feeAmount >= 0) {
    surchargePct = +((feeAmount / subtotal) * 100).toFixed(2);
  }

  const borough = boroughFromZipOrCity(rawText);
  const category = inferCategoryFromReceipt(rawText);

  return {
    rawText,
    businessName,
    address,
    borough,
    category,
    subtotal,
    tax,
    feeAmount,
    surchargePct,
    feeLabel,
    chargedOnTax,
  };
}

/**
 * Loads Tesseract.js dynamically on Web / Capacitor WebView so we don't bloat initial bundle size.
 */
async function runTesseractOcr(imageSource: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }
  const w = window as unknown as {
    Tesseract?: {
      recognize: (
        img: string,
        lang: string
      ) => Promise<{ data?: { text?: string } }>;
    };
  };

  if (!w.Tesseract) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('tesseract-cdn-script');
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'tesseract-cdn-script';
      script.src =
        'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OCR engine'));
      document.head.appendChild(script);
    });
  }

  if (!w.Tesseract) {
    return '';
  }

  const result = await w.Tesseract.recognize(imageSource, 'eng');
  return result?.data?.text || '';
}

/**
 * Attempts Google Cloud Vision OCR first (if key supports it), then falls back to local Tesseract.js OCR.
 * Also enriches extracted business name / address against live NYC Places & GeoSearch.
 */
export async function analyzeReceiptImage(params: {
  uri: string;
  base64?: string | null;
}): Promise<ParsedReceiptData> {
  let rawText = '';

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (apiKey && params.base64) {
    try {
      const cleanBase64 = params.base64.replace(
        /^data:image\/[a-zA-Z]+;base64,/,
        ''
      );
      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: cleanBase64 },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              },
            ],
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text =
          data?.responses?.[0]?.fullTextAnnotation?.text ||
          data?.responses?.[0]?.textAnnotations?.[0]?.description;
        if (text && typeof text === 'string') {
          rawText = text;
        }
      }
    } catch {
      // Fall back to Tesseract OCR
    }
  }

  if (!rawText.trim()) {
    try {
      const source = params.base64
        ? `data:image/jpeg;base64,${params.base64.replace(
            /^data:image\/[a-zA-Z]+;base64,/,
            ''
          )}`
        : params.uri;
      rawText = await runTesseractOcr(source);
    } catch {
      rawText = '';
    }
  }

  const parsed = parseReceiptText(rawText);

  // Auto-lookup the business / address in NYC Places & GeoSearch so we fill exact address, neighborhood, borough, and map pin!
  const searchQuery = [parsed.businessName, parsed.address]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (searchQuery.length >= 3) {
    try {
      const matches = await searchNYCAddresses(searchQuery);
      if (matches.length > 0) {
        const best = matches[0];
        parsed.matchedLocation = best;
        if (!parsed.businessName && best.name !== best.streetAddress) {
          parsed.businessName = best.name;
        }
        if (best.streetAddress) {
          parsed.address = best.streetAddress;
        }
        if (best.neighborhood) {
          parsed.neighborhood = best.neighborhood;
        }
        if (best.borough) {
          parsed.borough = best.borough;
        }
      }
    } catch {
      // Ignore lookup error
    }
  }

  return parsed;
}
