export type Borough =
  | 'Manhattan'
  | 'Brooklyn'
  | 'Queens'
  | 'Bronx'
  | 'Staten Island';

export type MerchantCategory =
  | 'Restaurant'
  | 'Cafe & Bakery'
  | 'Bar & Nightlife'
  | 'Bodega & Grocery'
  | 'Retail & Services';

export type VerificationTier =
  | 'receipt_verified'
  | 'dcwp_311'
  | 'needs_receipt';

export type CardType = 'credit' | 'debit';

export type ViolationCode =
  | 'EXCEEDS_3_PCT_CAP'
  | 'ILLEGAL_LINE_ITEM'
  | 'DEBIT_SURCHARGE'
  | 'FEE_ON_TAX';

export interface SurchargeReport {
  id: string;
  merchantId: string;
  surchargePct: number;
  subtotal?: number;
  surchargeAmount?: number;
  cardType: CardType;
  transactionDate: string; // ISO date string YYYY-MM-DD
  receiptUri?: string;
  hasReceipt: boolean;
  violations: ViolationCode[];
  notes?: string;
  createdAt: string;
}

export interface Merchant {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  borough: Borough;
  category: MerchantCategory;
  latitude: number;
  longitude: number;
  surchargePct: number; // e.g., 4.0, 3.99, 3.5, 0
  verificationTier: VerificationTier;
  lastVerifiedDate: string; // YYYY-MM-DD
  confirmationsCount: number;
  violations: ViolationCode[];
  latestReceiptUri?: string;
  notes?: string;
}
