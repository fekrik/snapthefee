import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  Borough,
  CardType,
  Merchant,
  MerchantCategory,
  SurchargeReport,
} from '@/types/surcharge';
import {
  fetchLiveNYC311Complaints,
  searchNYCAddresses,
} from '@/utils/nycOpenData';
import { geocodeNYCAddress } from '@/utils/receiptOcr';
import { detectViolations } from '@/utils/surchargeRules';

const STORAGE_KEY = 'snapthefee_real_v1';

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
  isSyncing311: boolean;
  addReport: (input: NewReportInput) => Promise<Merchant>;
  confirmMerchant: (merchantId: string) => Promise<void>;
  syncLive311Data: () => Promise<number>;
}

const ReportsContext = createContext<ReportsContextValue | undefined>(undefined);

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [reports, setReports] = useState<SurchargeReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing311, setIsSyncing311] = useState(false);

  const persist = useCallback(
    async (nextMerchants: Merchant[], nextReports: SurchargeReport[]) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ merchants: nextMerchants, reports: nextReports })
        );
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      let currentMerchants: Merchant[] = [];
      let currentReports: SurchargeReport[] = [];
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            merchants?: Merchant[];
            reports?: SurchargeReport[];
          };
          if (parsed.merchants?.length) {
            currentMerchants = parsed.merchants;
          }
          if (parsed.reports?.length) {
            currentReports = parsed.reports;
          }
        }
      } catch {
        // Ignore storage read error
      }

      if (mounted && currentMerchants.length > 0) {
        setMerchants(currentMerchants);
        setReports(currentReports);
      }

      // Always pull live NYC 311 DCWP records if empty or on initial load
      try {
        const live311 = await fetchLiveNYC311Complaints();
        if (mounted && live311.length > 0) {
          const existingIds = new Set(currentMerchants.map((m) => m.id));
          const merged = [
            ...currentMerchants,
            ...live311.filter((m) => !existingIds.has(m.id)),
          ];
          setMerchants(merged);
          await persist(merged, currentReports);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [persist]);

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

      let lat = input.latitude;
      let lng = input.longitude;
      let resolvedAddress = input.address.trim();
      let resolvedNeighborhood = input.neighborhood.trim();
      let resolvedBorough = input.borough;

      if ((lat === undefined || lng === undefined) && !existing) {
        // 1. Try Official NYC Planning Labs GeoSearch first
        const nycMatches = await searchNYCAddresses(
          input.address || input.businessName
        );
        if (nycMatches.length > 0) {
          lat = nycMatches[0].latitude;
          lng = nycMatches[0].longitude;
          if (!resolvedAddress) resolvedAddress = nycMatches[0].streetAddress;
          if (!resolvedNeighborhood) {
            resolvedNeighborhood = nycMatches[0].neighborhood;
          }
          resolvedBorough = nycMatches[0].borough;
        } else {
          // 2. Fallback to OpenStreetMap Nominatim
          const geo = await geocodeNYCAddress(
            input.address || input.businessName,
            input.borough
          );
          if (geo) {
            lat = geo.latitude;
            lng = geo.longitude;
          }
        }
      }

      const fallbackCenter = BOROUGH_COORDS[resolvedBorough];

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
          address: resolvedAddress || `${resolvedBorough}, NY`,
          neighborhood: resolvedNeighborhood || resolvedBorough,
          borough: resolvedBorough,
          category: input.category,
          latitude: lat ?? fallbackCenter.lat,
          longitude: lng ?? fallbackCenter.lng,
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

  const syncLive311Data = useCallback(async (): Promise<number> => {
    setIsSyncing311(true);
    try {
      const fetched = await fetchLiveNYC311Complaints();
      if (!fetched.length) return 0;

      const existingIds = new Set(merchants.map((m) => m.id));
      const fresh = fetched.filter((m) => !existingIds.has(m.id));
      if (!fresh.length) return 0;

      const nextMerchants = [...fresh, ...merchants];
      setMerchants(nextMerchants);
      await persist(nextMerchants, reports);
      return fresh.length;
    } finally {
      setIsSyncing311(false);
    }
  }, [merchants, reports, persist]);

  return (
    <ReportsContext.Provider
      value={{
        merchants,
        reports,
        isLoading,
        isSyncing311,
        addReport,
        confirmMerchant,
        syncLive311Data,
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
