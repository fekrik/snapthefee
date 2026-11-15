import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NYC_311_COMPLAINT_URL } from '@/utils/surchargeRules';

const RULES = [
  {
    icon: 'pricetag-outline' as const,
    title: 'Total Price Must Be Shown Upfront',
    body: 'Under NY General Business Law § 518, businesses must display the full credit card price in dollars and cents before checkout. Posting a "4% card fee" sign and adding a surprise line item at the register is illegal.',
  },
  {
    icon: 'trending-up-outline' as const,
    title: '4%+ Fees Violate NY Law & Card Network Rules',
    body: 'NY GBL § 518 prohibits charging more than the actual processing cost on any card (Visa, Mastercard, Amex, or Discover). Visa caps surcharges at 3%, Mastercard caps at actual cost (max 4%), and Amex/Discover forbid discriminatory surcharges.',
  },
  {
    icon: 'card-outline' as const,
    title: 'Zero Surcharges on Debit Cards',
    body: 'Surcharging debit or prepaid cards is strictly prohibited—even if you tap with Apple Pay or the terminal runs it "as credit."',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: '$500 Fines via NYC DCWP (311)',
    body: 'The NYC Department of Consumer and Worker Protection (DCWP) can fine violating businesses up to $500 per violation. Snap a clear photo of your receipt to file a 311 complaint.',
  },
];

export default function ModalScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      <Text style={styles.heading}>Why 4% Card Fees Are Illegal in NYC</Text>
      <Text style={styles.intro}>
        SnapTheFee uses dated receipt photos to verify surcharge math and help
        New Yorkers hold businesses accountable.
      </Text>

      <View style={styles.list}>
        {RULES.map((rule) => (
          <View key={rule.title} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={rule.icon} size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.cardTitle}>{rule.title}</Text>
              <Text style={styles.cardBody}>{rule.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => Linking.openURL(NYC_311_COMPLAINT_URL)}
        style={styles.ctaBtn}
      >
        <Ionicons name="open-outline" size={18} color="#FFFFFF" />
        <Text style={styles.ctaText}>Open NYC 311 Complaint Portal</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  intro: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  list: {
    gap: 12,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
