import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useReports } from '@/context/ReportsContext';
import { Borough, CardType, Merchant, MerchantCategory } from '@/types/surcharge';
import { NYCGeoSuggestion, searchNYCAddresses } from '@/utils/nycOpenData';
import {
  build311ComplaintText,
  computeSurchargePct,
  detectViolations,
  getViolationLabel,
  NYC_311_COMPLAINT_URL,
} from '@/utils/surchargeRules';

const BOROUGHS: Borough[] = [
  'Manhattan',
  'Brooklyn',
  'Queens',
  'Bronx',
  'Staten Island',
];

const CATEGORIES: MerchantCategory[] = [
  'Restaurant',
  'Cafe & Bakery',
  'Bodega & Grocery',
  'Bar & Nightlife',
  'Retail & Services',
];

const QUICK_PCTS = [0, 3.0, 3.5, 4.0, 4.5];

export default function SnapScreen() {
  const params = useLocalSearchParams<{
    merchantId?: string;
    businessName?: string;
  }>();
  const { addReport } = useReports();

  const [receiptUri, setReceiptUri] = useState<string | undefined>(undefined);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [borough, setBorough] = useState<Borough>('Manhattan');
  const [category, setCategory] = useState<MerchantCategory>('Restaurant');
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [suggestions, setSuggestions] = useState<NYCGeoSuggestion[]>([]);

  const [subtotalText, setSubtotalText] = useState('');
  const [feeAmountText, setFeeAmountText] = useState('');
  const [manualPct, setManualPct] = useState<number>(4.0);
  const [cardType, setCardType] = useState<CardType>('credit');
  const [chargedOnTax, setChargedOnTax] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedMerchant, setSubmittedMerchant] = useState<Merchant | null>(
    null
  );
  const [copied311, setCopied311] = useState(false);

  useEffect(() => {
    if (params.businessName) {
      setBusinessName(params.businessName);
    }
  }, [params.businessName]);

  const computedPct = useMemo(() => {
    const sub = parseFloat(subtotalText);
    const fee = parseFloat(feeAmountText);
    if (!Number.isNaN(sub) && !Number.isNaN(fee) && sub > 0 && fee >= 0) {
      return computeSurchargePct(sub, fee);
    }
    return manualPct;
  }, [subtotalText, feeAmountText, manualPct]);

  const violations = useMemo(
    () =>
      detectViolations({
        surchargePct: computedPct,
        cardType,
        addedAsLineItem: computedPct > 0,
        chargedOnTax,
      }),
    [computedPct, cardType, chargedOnTax]
  );

  const pickFromCamera = async () => {
    setErrorMsg(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg('Please allow camera access to snap receipts.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]) {
      setReceiptUri(res.assets[0].uri);
      setOcrStatus(
        'Receipt photo attached — confirm the subtotal & fee amounts below.'
      );
    }
  };

  const pickFromLibrary = async () => {
    setErrorMsg(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg('Please allow photo access to upload a receipt.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]) {
      setReceiptUri(res.assets[0].uri);
      setOcrStatus(
        'Receipt photo attached — confirm the subtotal & fee amounts below.'
      );
    }
  };

  const handleSubmit = async () => {
    if (!businessName.trim()) {
      setErrorMsg('Please enter the business name.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = await addReport({
        existingMerchantId: params.merchantId,
        businessName,
        address,
        neighborhood: neighborhood || borough,
        borough,
        category,
        surchargePct: computedPct,
        subtotal: parseFloat(subtotalText) || undefined,
        surchargeAmount: parseFloat(feeAmountText) || undefined,
        cardType,
        transactionDate: today,
        receiptUri,
        chargedOnTax,
        notes,
        latitude: geoCoords?.lat,
        longitude: geoCoords?.lng,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setSubmittedMerchant(saved);
      setGeoCoords(null);
      setSuggestions([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy311 = async () => {
    if (!submittedMerchant) return;
    const text = build311ComplaintText(submittedMerchant);
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(text);
      }
      setCopied311(true);
      setTimeout(() => setCopied311(false), 2500);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#EF4444" />
              <Text style={styles.heroBadgeText}>
                NY GBL § 518 • ALL CARDS & TAP-TO-PAY
              </Text>
            </View>
            <Text style={styles.heroTitle}>
              Charged 4%+ to tap or use a card in NYC?
            </Text>
            <Text style={styles.heroSub}>
              Under NY law & card network rules (Visa, Mastercard, Amex,
              Discover), surprise percentage fees and 4%+ surcharges are
              illegal. Snap your receipt to pin the business and report to 311.
            </Text>
          </View>

          {submittedMerchant && (
            <View style={styles.successCard}>
              <View style={styles.successHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#047857" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>
                    Pinned: {submittedMerchant.name} (
                    {submittedMerchant.surchargePct.toFixed(1)}%)
                  </Text>
                  <Text style={styles.successSub}>
                    {submittedMerchant.address} • {submittedMerchant.borough}
                  </Text>
                </View>
              </View>

              {submittedMerchant.surchargePct > 0 && (
                <View style={styles.complaintPreview}>
                  <Text style={styles.complaintLabel}>
                    Official NYC 311 / DCWP Complaint Packet:
                  </Text>
                  <Text style={styles.complaintText}>
                    {build311ComplaintText(submittedMerchant)}
                  </Text>
                  <View style={styles.complaintActions}>
                    <Pressable
                      onPress={handleCopy311}
                      style={styles.copyComplaintBtn}
                    >
                      <Ionicons
                        name={copied311 ? 'checkmark' : 'copy-outline'}
                        size={15}
                        color="#0F172A"
                      />
                      <Text style={styles.copyComplaintText}>
                        {copied311 ? 'Copied!' : 'Copy 311 Text'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => Linking.openURL(NYC_311_COMPLAINT_URL)}
                      style={styles.open311Btn}
                    >
                      <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.open311Text}>
                        File on NYC 311 Portal
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <View style={styles.successNavRow}>
                <Pressable
                  onPress={() => router.push('/(tabs)/map')}
                  style={styles.viewMapBtn}
                >
                  <Ionicons name="map" size={16} color="#FFFFFF" />
                  <Text style={styles.viewMapBtnText}>
                    View Pin on NYC Map
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSubmittedMerchant(null);
                    setReceiptUri(undefined);
                    setOcrStatus(null);
                    setBusinessName('');
                    setAddress('');
                    setNeighborhood('');
                    setSubtotalText('');
                    setFeeAmountText('');
                    setNotes('');
                  }}
                  style={styles.resetBtn}
                >
                  <Text style={styles.resetBtnText}>Snap Another</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Snap or Upload Receipt</Text>
            <Text style={styles.sectionSub}>
              A photo of the dated receipt verifies the surcharge math and
              unlocks NYC 311 / DCWP reporting.
            </Text>

            {receiptUri ? (
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: receiptUri }}
                  style={styles.previewImg}
                  resizeMode="contain"
                />
                <Pressable
                  onPress={() => {
                    setReceiptUri(undefined);
                    setOcrStatus(null);
                  }}
                  style={styles.removePhotoBtn}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoBtnRow}>
                <Pressable
                  onPress={pickFromCamera}
                  style={styles.photoBtnPrimary}
                >
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                  <Text style={styles.photoBtnPrimaryText}>Take Photo</Text>
                </Pressable>
                <Pressable
                  onPress={pickFromLibrary}
                  style={styles.photoBtnSecondary}
                >
                  <Ionicons name="images-outline" size={20} color="#0F172A" />
                  <Text style={styles.photoBtnSecondaryText}>
                    Upload Receipt
                  </Text>
                </Pressable>
              </View>
            )}

            {ocrStatus && (
              <View style={styles.ocrBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#047857" />
                <Text style={styles.ocrBannerText}>{ocrStatus}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              2. Receipt Math & Violation Check
            </Text>
            <View style={styles.mathRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Subtotal ($)</Text>
                <TextInput
                  value={subtotalText}
                  onChangeText={setSubtotalText}
                  placeholder="65.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Card Fee ($)</Text>
                <TextInput
                  value={feeAmountText}
                  onChangeText={setFeeAmountText}
                  placeholder="2.60"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
            </View>

            <Text style={styles.label}>Or tap fee percentage:</Text>
            <View style={styles.chipsRow}>
              {QUICK_PCTS.map((pct) => {
                const active =
                  !subtotalText && !feeAmountText && manualPct === pct;
                return (
                  <Pressable
                    key={pct}
                    onPress={() => {
                      setSubtotalText('');
                      setFeeAmountText('');
                      setManualPct(pct);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {pct === 0 ? '0% Fair' : `${pct.toFixed(1)}%`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.segmentWrap}>
              {(['credit', 'debit'] as CardType[]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setCardType(type)}
                  style={[
                    styles.segmentBtn,
                    cardType === type && styles.segmentBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      cardType === type && styles.segmentTextActive,
                    ]}
                  >
                    {type === 'credit'
                      ? 'Credit / Tap (Visa, MC, Amex, Discover)'
                      : 'Debit Card'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Was the fee calculated on top of NYC 8.875% sales tax?
              </Text>
              <Switch value={chargedOnTax} onValueChange={setChargedOnTax} />
            </View>

            <View
              style={[
                styles.resultBanner,
                violations.length > 0
                  ? styles.resultBannerViolation
                  : styles.resultBannerClean,
              ]}
            >
              <Text
                style={[
                  styles.resultPct,
                  { color: violations.length > 0 ? '#B91C1C' : '#047857' },
                ]}
              >
                {computedPct.toFixed(1)}%
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>
                  {violations.length > 0
                    ? `${violations.length} Legal / Network Violation${violations.length > 1 ? 's' : ''} Detected`
                    : 'Compliant / 0% Fair Business'}
                </Text>
                {violations.length > 0 && (
                  <Text style={styles.resultSub}>
                    {violations.map(getViolationLabel).join(' • ')}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. NYC Business Location</Text>
            <TextInput
              value={businessName}
              onChangeText={async (val) => {
                setBusinessName(val);
                if (val.trim().length >= 3) {
                  const matches = await searchNYCAddresses(val);
                  setSuggestions(matches);
                } else {
                  setSuggestions([]);
                }
              }}
              placeholder="Business Name (e.g. Joe's Pizza)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <View style={styles.mathRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={address}
                  onChangeText={async (val) => {
                    setAddress(val);
                    setGeoCoords(null);
                    if (val.trim().length >= 3) {
                      const matches = await searchNYCAddresses(val);
                      setSuggestions(matches);
                    } else {
                      setSuggestions([]);
                    }
                  }}
                  placeholder="Street Address (auto-completes NYC addresses)"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  placeholder="Neighborhood (e.g. West Village)"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      if (
                        !businessName.trim() ||
                        s.name !== s.streetAddress
                      ) {
                        setBusinessName(s.name);
                      }
                      setAddress(s.streetAddress);
                      setNeighborhood(s.neighborhood);
                      setBorough(s.borough);
                      setGeoCoords({ lat: s.latitude, lng: s.longitude });
                      setSuggestions([]);
                    }}
                    style={styles.suggestionItem}
                  >
                    <Ionicons
                      name="location-outline"
                      size={15}
                      color="#0F172A"
                    />
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {s.label} ({s.borough})
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>Borough</Text>
            <View style={styles.chipsRow}>
              {BOROUGHS.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => setBorough(b)}
                  style={[styles.chip, borough === b && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      borough === b && styles.chipTextActive,
                    ]}
                  >
                    {b}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipsRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, category === c && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === c && styles.chipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional note (e.g. 'Printed as Non-Cash Adj on receipt')"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
          </View>

          {errorMsg && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>
              {submitting
                ? 'Geocoding & Saving...'
                : receiptUri
                  ? 'Verify Receipt & Pin to NYC Map'
                  : 'Submit Tip to NYC Map'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  inner: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FCA5A5',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
  },
  successCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    gap: 12,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
  },
  successSub: {
    fontSize: 13,
    color: '#047857',
  },
  complaintPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 8,
  },
  complaintLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  complaintText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  complaintActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  copyComplaintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  copyComplaintText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  open311Btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 10,
  },
  open311Text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successNavRow: {
    flexDirection: 'row',
    gap: 10,
  },
  viewMapBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 12,
  },
  viewMapBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  resetBtnText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  photoBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 14,
  },
  photoBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  photoBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoBtnSecondaryText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  previewWrap: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  previewImg: {
    width: '100%',
    height: 240,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ocrBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  mathRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchLabel: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  resultBannerViolation: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  resultBannerClean: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  resultPct: {
    fontSize: 24,
    fontWeight: '800',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultSub: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  suggestionsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
