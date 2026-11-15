import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { Borough, CardType, MerchantCategory } from '@/types/surcharge';
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
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [borough, setBorough] = useState<Borough>('Manhattan');
  const [category, setCategory] = useState<MerchantCategory>('Restaurant');

  const [subtotalText, setSubtotalText] = useState('');
  const [feeAmountText, setFeeAmountText] = useState('');
  const [manualPct, setManualPct] = useState<number>(4.0);
  const [cardType, setCardType] = useState<CardType>('credit');
  const [chargedOnTax, setChargedOnTax] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera Permission Needed',
        'Please allow camera access in Settings to snap receipts.'
      );
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]) {
      setReceiptUri(res.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo Library Permission Needed',
        'Please allow photo access to upload a receipt.'
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]) {
      setReceiptUri(res.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!businessName.trim()) {
      Alert.alert('Business Name Required', 'Please enter the business name.');
      return;
    }
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
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Reset form
      setReceiptUri(undefined);
      setBusinessName('');
      setAddress('');
      setNeighborhood('');
      setSubtotalText('');
      setFeeAmountText('');
      setNotes('');

      if (receiptUri && saved.surchargePct > 0) {
        const summary = build311ComplaintText(saved);
        Alert.alert(
          'Verified & Pinned to Map!',
          `Your receipt for ${saved.name} (${saved.surchargePct.toFixed(1)}%) is now live.\n\nWant to file this receipt with NYC 311 / DCWP?`,
          [
            {
              text: 'View on Map',
              onPress: () => router.replace('/(tabs)'),
            },
            {
              text: 'Report to 311',
              onPress: () => {
                Alert.alert('311 Report Summary', summary, [
                  {
                    text: 'Open NYC 311 Portal',
                    onPress: () => Linking.openURL(NYC_311_COMPLAINT_URL),
                  },
                  {
                    text: 'Done',
                    onPress: () => router.replace('/(tabs)'),
                  },
                ]);
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Added to Map!',
          `${saved.name} has been updated on the NYC map.`,
          [{ text: 'View Map', onPress: () => router.replace('/(tabs)') }]
        );
      }
    } finally {
      setSubmitting(false);
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Receipt Photo (Recommended)</Text>
          <Text style={styles.sectionSub}>
            Receipts verify the exact date, fee math, and unlock NYC 311
            reporting.
          </Text>

          {receiptUri ? (
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: receiptUri }}
                style={styles.previewImg}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => setReceiptUri(undefined)}
                style={styles.removePhotoBtn}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoBtnRow}>
              <Pressable onPress={pickFromCamera} style={styles.photoBtnPrimary}>
                <Ionicons name="camera" size={20} color="#FFFFFF" />
                <Text style={styles.photoBtnPrimaryText}>Take Photo</Text>
              </Pressable>
              <Pressable
                onPress={pickFromLibrary}
                style={styles.photoBtnSecondary}
              >
                <Ionicons name="images-outline" size={20} color="#0F172A" />
                <Text style={styles.photoBtnSecondaryText}>Upload</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Surcharge Math</Text>
          <View style={styles.mathRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Subtotal ($)</Text>
              <TextInput
                value={subtotalText}
                onChangeText={setSubtotalText}
                placeholder="40.00"
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
                placeholder="1.60"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Or select fee percentage:</Text>
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
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {pct === 0 ? '0% Fair' : `${pct.toFixed(1)}%`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toggleRow}>
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
                    {type === 'credit' ? 'Credit / Apple Pay' : 'Debit Card'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              Fee calculated on top of NYC sales tax?
            </Text>
            <Switch value={chargedOnTax} onValueChange={setChargedOnTax} />
          </View>

          <View style={styles.resultBanner}>
            <Text style={styles.resultPct}>{computedPct.toFixed(1)}%</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>
                {violations.length > 0
                  ? `${violations.length} Potential Violation${violations.length > 1 ? 's' : ''} Detected`
                  : 'Compliant / No Surcharge'}
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
          <Text style={styles.sectionTitle}>3. Business Info</Text>
          <TextInput
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Business Name (e.g. Joe's Coffee)"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Street Address (e.g. 123 MacDougal St)"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <TextInput
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Neighborhood (e.g. Greenwich Village)"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Text style={styles.label}>Borough</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
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
          </ScrollView>

          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
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
          </ScrollView>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional note (e.g. 'Printed as Non-Cash Adj on receipt')"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.submitBtnText}>
            {receiptUri ? 'Verify & Pin to NYC Map' : 'Submit Tip to NYC Map'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    marginTop: 4,
  },
  photoBtnPrimary: {
    flex: 2,
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
  },
  previewImg: {
    width: '100%',
    height: 180,
    backgroundColor: '#F1F5F9',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  chipActive: {
    backgroundColor: '#0F172A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    marginTop: 4,
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
    paddingVertical: 8,
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
    fontSize: 13,
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
    paddingTop: 4,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  resultPct: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 15,
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
