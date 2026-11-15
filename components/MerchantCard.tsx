import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Merchant } from '@/types/surcharge';
import {
  build311ComplaintText,
  formatFreshnessLabel,
  getSeverityColor,
  getViolationLabel,
  NYC_311_COMPLAINT_URL,
} from '@/utils/surchargeRules';

interface MerchantCardProps {
  merchant: Merchant;
  onConfirm: (merchantId: string) => void;
  onClose?: () => void;
}

export function MerchantCard({
  merchant,
  onConfirm,
  onClose,
}: MerchantCardProps) {
  const [confirmed, setConfirmed] = useState(false);
  const severity = getSeverityColor(merchant.surchargePct);
  const hasReceipt =
    merchant.verificationTier === 'receipt_verified' ||
    Boolean(merchant.latestReceiptUri);

  const handleConfirm = () => {
    if (confirmed) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setConfirmed(true);
    onConfirm(merchant.id);
  };

  const handleReport311 = () => {
    const summary = build311ComplaintText(merchant);
    Alert.alert(
      'NYC 311 / DCWP Report Ready',
      `${summary}\n\nReady to open the official NYC 311 Consumer Complaint portal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open NYC 311',
          onPress: () => {
            Linking.openURL(NYC_311_COMPLAINT_URL);
          },
        },
      ]
    );
  };

  const handleSnapToVerify = () => {
    router.push({
      pathname: '/(tabs)/snap',
      params: { merchantId: merchant.id, businessName: merchant.name },
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {merchant.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {merchant.address} • {merchant.neighborhood} ({merchant.borough})
          </Text>
        </View>

        <View style={[styles.pctBadge, { backgroundColor: severity.bg }]}>
          <Text style={[styles.pctText, { color: severity.text }]}>
            {merchant.surchargePct > 0
              ? `${merchant.surchargePct.toFixed(1)}%`
              : '0%'}
          </Text>
          <Text style={[styles.pctSub, { color: severity.text }]}>
            {merchant.surchargePct > 0 ? 'CARD FEE' : 'FAIR'}
          </Text>
        </View>

        {onClose && (
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityLabel="Close merchant details"
          >
            <Ionicons name="close" size={18} color="#64748B" />
          </Pressable>
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.tierPill}>
          <Ionicons
            name={
              merchant.verificationTier === 'receipt_verified'
                ? 'receipt-outline'
                : merchant.verificationTier === 'dcwp_311'
                  ? 'shield-checkmark-outline'
                  : 'time-outline'
            }
            size={13}
            color="#334155"
          />
          <Text style={styles.tierText}>
            {merchant.verificationTier === 'receipt_verified'
              ? `Receipt Verified • ${formatFreshnessLabel(merchant.lastVerifiedDate)}`
              : merchant.verificationTier === 'dcwp_311'
                ? `311 Record • Needs Receipt`
                : `Unverified Tip • Needs Receipt`}
          </Text>
        </View>
      </View>

      {merchant.violations.length > 0 && (
        <View style={styles.violationsRow}>
          {merchant.violations.map((code) => (
            <View key={code} style={styles.violationChip}>
              <Text style={styles.violationText}>{getViolationLabel(code)}</Text>
            </View>
          ))}
        </View>
      )}

      {merchant.notes ? (
        <Text style={styles.notes} numberOfLines={2}>
          {merchant.notes}
        </Text>
      ) : null}

      {merchant.latestReceiptUri ? (
        <Image
          source={{ uri: merchant.latestReceiptUri }}
          style={styles.receiptThumb}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleConfirm}
          style={[styles.secondaryBtn, confirmed && styles.secondaryBtnDone]}
        >
          <Ionicons
            name={confirmed ? 'checkmark-circle' : 'add-circle-outline'}
            size={16}
            color={confirmed ? '#047857' : '#0F172A'}
          />
          <Text
            style={[
              styles.secondaryBtnText,
              confirmed && { color: '#047857' },
            ]}
          >
            {confirmed
              ? `Confirmed (${merchant.confirmationsCount})`
              : `Still Charging (${merchant.confirmationsCount})`}
          </Text>
        </Pressable>

        {merchant.surchargePct > 0 ? (
          hasReceipt ? (
            <Pressable onPress={handleReport311} style={styles.primaryBtn}>
              <Ionicons name="megaphone-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Report to 311</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleSnapToVerify} style={styles.amberBtn}>
              <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Snap Receipt</Text>
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  pctBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 62,
  },
  pctText: {
    fontSize: 16,
    fontWeight: '800',
  },
  pctSub: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  violationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  violationChip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  violationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
  },
  notes: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  receiptThumb: {
    width: '100%',
    height: 90,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    borderRadius: 12,
  },
  secondaryBtnDone: {
    backgroundColor: '#ECFDF5',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 11,
    borderRadius: 12,
  },
  amberBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    paddingVertical: 11,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
