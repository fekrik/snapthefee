import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { SEED_MERCHANTS } from '@/data/seedMerchants';
import {
  Borough,
  CardType,
  Merchant,
  MerchantCategory,
  SurchargeReport,
} from '@/types/surcharge';
import { detectViolations } from '@/utils/surchargeRules';

const STORAGE_KEY = 'snapthefee_merchants_v1';

const BOROUGH_COORDS: Record<Borough, { lat: number; lng: number }> = {
  Manhattan: { lat: 40.7484, lng: -73.9857 },
  Brooklyn: { lat: 40.6782, lng: -73.9442 },
  Queens: { lat: 40.7282, lng: -73.7949 },
  Bronx: { lat: 40.8448, lng: -73.8648 },
  'Staten Island': { lat: 40.5795, lng: -74.1502 },
};

export interface NewReportInput {
  existingMerchantId?: string;
  businessName: string;
  address: string;
  neighborhood: string;
  borough: Borough;
  category: MerchantCategory;
  surchargePct: number;
  subtotal?: number;
  surchargeAmount?: number;
  cardType: CardType;
  transactionDate: string;
  receiptUri?: string;
  chargedOnTax?: boolean;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

interface ReportsContextValue {
  merchants: Merchant[];
  reports: SurchargeReport[];
  isLoading: boolean;
  addReport: (input: NewReportInput) => Promise<Merchant>;
  confirmMerchant: (merchantId: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const ReportsContext = createContext<ReportsContextValue | undefined>(undefined);

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const [merchants, setMerchants] = useState<Merchant[]>(SEED_MERCHANTS);
  const [reports, setReports] = useState<SurchargeReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed = JSON.parse(raw) as {
            merchants?: Merchant[];
            reports?: SurchargeReport[];
          };
          if (parsed.merchants?.length) {
            setMerchants(parsed.merchants);
          }
          if (parsed.reports?.length) {
            setReports(parsed.reports);
          }
        }
      } catch {
        // Fallback to seed data on storage read error
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(
    async (nextMerchants: Merchant[], nextReports: SurchargeReport[]) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ merchants: nextMerchants, reports: nextReports })
        );
      } catch {
        // Ignore storage write errors in MVP
      }
    },
    []
  );

  const addReport = useCallback(
    async (input: NewReportInput): Promise<Merchant> => {
      const hasReceipt = Boolean(input.receiptUri);
      const violations = detectViolations({
        surchargePct: input.surchargePct,
        cardType: input.cardType,
        addedAsLineItem: input.surchargePct > 0,
        chargedOnTax: input.chargedOnTax,
      });

      const existing = input.existingMerchantId
        ? merchants.find((m) => m.id === input.existingMerchantId)
        : merchants.find(
            (m) =>
              m.name.trim().toLowerCase() ===
              input.businessName.trim().toLowerCase()
          );

      const jitter = () => (Math.random() - 0.5) * 0.014;
      const fallbackCenter = BOROUGH_COORDS[input.borough];

      let updatedMerchant: Merchant;
      let nextMerchants: Merchant[];

      if (existing) {
        updatedMerchant = {
          ...existing,
          surchargePct: input.surchargePct,
          verificationTier: hasReceipt
            ? 'receipt_verified'
            : existing.verificationTier,
          lastVerifiedDate: input.transactionDate,
          confirmationsCount: existing.confirmationsCount + 1,
          violations,
          latestReceiptUri: input.receiptUri ?? existing.latestReceiptUri,
          notes: input.notes?.trim() || existing.notes,
        };
        nextMerchants = merchants.map((m) =>
          m.id === existing.id ? updatedMerchant : m
        );
      } else {
        updatedMerchant = {
          id: `m-${Date.now()}`,
          name: input.businessName.trim(),
          address: input.address.trim() || 'NYC Street Address',
          neighborhood: input.neighborhood.trim() || input.borough,
          borough: input.borough,
          category: input.category,
          latitude: input.latitude ?? fallbackCenter.lat + jitter(),
          longitude: input.longitude ?? fallbackCenter.lng + jitter(),
          surchargePct: input.surchargePct,
          verificationTier: hasReceipt ? 'receipt_verified' : 'needs_receipt',
          lastVerifiedDate: input.transactionDate,
          confirmationsCount: 1,
          violations,
          latestReceiptUri: input.receiptUri,
          notes: input.notes?.trim(),
        };
        nextMerchants = [updatedMerchant, ...merchants];
      }

      const newReport: SurchargeReport = {
        id: `r-${Date.now()}`,
        merchantId: updatedMerchant.id,
        surchargePct: input.surchargePct,
        subtotal: input.subtotal,
        surchargeAmount: input.surchargeAmount,
        cardType: input.cardType,
        transactionDate: input.transactionDate,
        receiptUri: input.receiptUri,
        hasReceipt,
        violations,
        notes: input.notes,
        createdAt: new Date().toISOString(),
      };

      const nextReports = [newReport, ...reports];
      setMerchants(nextMerchants);
      setReports(nextReports);
      await persist(nextMerchants, nextReports);
      return updatedMerchant;
    },
    [merchants, reports, persist]
  );

  const confirmMerchant = useCallback(
    async (merchantId: string) => {
      const nextMerchants = merchants.map((m) =>
        m.id === merchantId
          ? { ...m, confirmationsCount: m.confirmationsCount + 1 }
          : m
      );
      setMerchants(nextMerchants);
      await persist(nextMerchants, reports);
    },
    [merchants, reports, persist]
  );

  const resetDemoData = useCallback(async () => {
    setMerchants(SEED_MERCHANTS);
    setReports([]);
    await persist(SEED_MERCHANTS, []);
  }, [persist]);

  return (
    <ReportsContext.Provider
      value={{
        merchants,
        reports,
        isLoading,
        addReport,
        confirmMerchant,
        resetDemoData,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) {
    throw new Error('useReports must be used inside ReportsProvider');
  }
  return ctx;
}
