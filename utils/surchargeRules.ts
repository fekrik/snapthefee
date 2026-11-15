import { CardType, Merchant, ViolationCode } from '@/types/surcharge';

export const NYC_311_COMPLAINT_URL =
  'https://portal.311.nyc.gov/article/?kanumber=KA-02109';

export function computeSurchargePct(subtotal: number, feeAmount: number): number {
  if (subtotal <= 0 || feeAmount <= 0) return 0;
  return Math.round((feeAmount / subtotal) * 1000) / 10;
}

export function detectViolations(params: {
  surchargePct: number;
  cardType: CardType;
  addedAsLineItem?: boolean;
  chargedOnTax?: boolean;
}): ViolationCode[] {
  const { surchargePct, cardType, addedAsLineItem = true, chargedOnTax = false } = params;
  const violations: ViolationCode[] = [];

  if (surchargePct <= 0) return violations;

  if (cardType === 'debit') {
    violations.push('DEBIT_SURCHARGE');
  }
  if (surchargePct > 3.0) {
    violations.push('EXCEEDS_3_PCT_CAP');
  }
  if (addedAsLineItem) {
    violations.push('ILLEGAL_LINE_ITEM');
  }
  if (chargedOnTax) {
    violations.push('FEE_ON_TAX');
  }

  return violations;
}

export function getViolationLabel(code: ViolationCode): string {
  switch (code) {
    case 'EXCEEDS_3_PCT_CAP':
      return 'Exceeds 3% Cap';
    case 'ILLEGAL_LINE_ITEM':
      return 'Illegal Line-Item Fee (GBL § 518)';
    case 'DEBIT_SURCHARGE':
      return 'Illegal Debit Card Fee';
    case 'FEE_ON_TAX':
      return 'Fee Charged on Sales Tax';
  }
}

export function getSeverityColor(surchargePct: number): {
  bg: string;
  text: string;
  pin: string;
  label: string;
} {
  if (surchargePct >= 3.5) {
    return {
      bg: '#FEE2E2',
      text: '#B91C1C',
      pin: '#EF4444',
      label: 'Illegal / Excessive',
    };
  }
  if (surchargePct > 0) {
    return {
      bg: '#FEF3C7',
      text: '#B45309',
      pin: '#F59E0B',
      label: 'Surcharge',
    };
  }
  return {
    bg: '#D1FAE5',
    text: '#047857',
    pin: '#10B981',
    label: '0% Fair',
  };
}

export function formatFreshnessLabel(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function build311ComplaintText(merchant: Merchant): string {
  const violationSummary =
    merchant.violations.length > 0
      ? merchant.violations.map(getViolationLabel).join(', ')
      : 'Unlawful credit card surcharge';

  return [
    `NYC DCWP / NY GBL § 518 Surcharge Complaint`,
    `Business: ${merchant.name}`,
    `Address: ${merchant.address}, ${merchant.borough}, NY`,
    `Observed Surcharge: ${merchant.surchargePct.toFixed(1)}%`,
    `Violation(s): ${violationSummary}`,
    `Date Observed: ${merchant.lastVerifiedDate}`,
    `Details: Merchant added a ${merchant.surchargePct.toFixed(1)}% surcharge at checkout rather than displaying the total credit card price inclusive of fees as required by New York General Business Law § 518.`,
  ].join('\n');
}
