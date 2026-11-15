import { Merchant } from '@/types/surcharge';

export interface NYCMapProps {
  merchants: Merchant[];
  selectedMerchantId: string | null;
  onSelectMerchant: (merchant: Merchant) => void;
  focusRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;
}
