import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SolarIcon } from '../src/components/common/SolarIcon';
import { colors, typography } from '../src/theme';
import { Header } from '../src/components/common/Header';
import { LEGAL_DOCUMENTS, LegalDocument } from '../src/data/legalPolicies';

export default function LegalCenterScreen() {
  const router = useRouter();
  const { doc: initialDocParam } = useLocalSearchParams<{ doc?: string }>();

  const [activeDocId, setActiveDocId] = useState<string>(
    initialDocParam || 'terms-and-conditions'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const activeDoc: LegalDocument =
    LEGAL_DOCUMENTS.find((d) => d.id === activeDocId) || LEGAL_DOCUMENTS[0];

  const filteredClauses = activeDoc.clauses.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.heading.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q) ||
      (c.legalBasis && c.legalBasis.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="LEGAL & COMPLIANCE" showBack fallbackPath="/(tabs)/profile" />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <SolarIcon name="search" size={16} color={colors.textMuted} />
          <TextInput accessibilityLabel="Search policies (e.g. payments, taxes, return, privacy)"
            placeholder="Search policies (e.g. payments, taxes, return, privacy)"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setSearchQuery('')}>
              <SolarIcon name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Document Switcher Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {LEGAL_DOCUMENTS.map((doc) => {
            const isActive = doc.id === activeDocId;
            return (
              <TouchableOpacity
                key={doc.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => {
                  setActiveDocId(doc.id);
                  setSearchQuery('');
                }}
                activeOpacity={0.7}
              >
                <SolarIcon
                  name={doc.icon as any}
                  size={14}
                  color={isActive ? colors.white : colors.textSecond}
                  style={{ marginRight: 6 }}
                />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {doc.shortTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Policy Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Document Header */}
        <View style={styles.docHeaderCard}>
          <Text style={styles.docTitle}>{activeDoc.title}</Text>
          <Text style={styles.docMeta}>Last updated: 20 September 2026 · Version 1.0</Text>
          <View style={styles.headerRule} />
          <Text style={styles.statutoryRef}>{activeDoc.statutoryReference}</Text>
        </View>

        {/* Formal Provisions */}
        <Text style={styles.sectionHeader}>
          {searchQuery
            ? `SEARCH RESULTS (${filteredClauses.length} CLAUSES FOUND)`
            : 'AGREEMENT CLAUSES'}
        </Text>

        {filteredClauses.length === 0 ? (
          <View style={styles.noResultsCard}>
            <SolarIcon name="search-outline" size={32} color={colors.textMuted} />
            <Text style={styles.noResultsTitle}>No matching clauses found</Text>
            <Text style={styles.noResultsSub}>
              Try searching a different keyword or switch to another policy document.
            </Text>
          </View>
        ) : (
          filteredClauses.map((clause, cIdx) => (
            <View key={cIdx} style={styles.clauseCard}>
              <Text style={styles.clauseHeading}>{clause.heading}</Text>
              <Text style={styles.clauseBody}>{clause.content}</Text>
              {clause.legalBasis ? (
                <View style={styles.legalBasisBox}>
                  <Text style={styles.legalBasisLabel}>Statutory Basis</Text>
                  <Text style={styles.legalBasisText}>{clause.legalBasis}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}

        {/* Grievance Redressal Card */}
        <View style={styles.grievanceCard}>
          <View style={styles.grievanceHeader}>
            <SolarIcon name="information-circle-outline" size={20} color={colors.ink} />
            <Text style={styles.grievanceTitle}>STATUTORY GRIEVANCE REDRESSAL</Text>
          </View>
          <Text style={styles.grievanceText}>
            Under Rule 3(2) of the IT Rules 2021 and the DPDP Act 2023, complaints are acknowledged within 24 hours and addressed within 15 days.
          </Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Grievance Officer</Text>
            <Text style={styles.contactValue}>grievance@kaphor.com</Text>
          </View>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>National Consumer Helpline</Text>
            <Text style={styles.contactValue}>1915 / consumerhelpline.gov.in</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 0,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.mono,
    color: colors.textPrimary,
  },
  chipsWrapper: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    paddingTop: 10,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 0,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textSecond,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chipTextActive: {
    color: colors.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  docHeaderCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderTopWidth: 3,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 24,
  },
  docTitle: {
    fontSize: 24,
    fontFamily: typography.headings,
    fontWeight: '400',
    color: colors.textPrimary,
    letterSpacing: 1.2,
    lineHeight: 30,
    marginBottom: 6,
  },
  docMeta: {
    fontSize: 11,
    fontFamily: typography.mono,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  headerRule: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  statutoryRef: {
    fontSize: 11,
    fontFamily: typography.mono,
    color: colors.textSecond,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: colors.textSecond,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  clauseCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  clauseHeading: {
    fontSize: 13,
    fontFamily: typography.monoBold,
    color: colors.textPrimary,
    marginBottom: 10,
    lineHeight: 19,
    letterSpacing: 0.3,
  },
  clauseBody: {
    fontSize: 13,
    fontFamily: typography.body,
    lineHeight: 22,
    color: colors.textSecond,
    marginBottom: 12,
  },
  legalBasisBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  legalBasisLabel: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.4,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  legalBasisText: {
    fontSize: 11,
    fontFamily: typography.mono,
    color: colors.textMuted,
    lineHeight: 17,
  },
  noResultsCard: {
    backgroundColor: colors.bgCard,
    padding: 30,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  noResultsTitle: {
    fontSize: 14,
    fontFamily: typography.monoBold,
    color: colors.textPrimary,
    marginTop: 10,
  },
  noResultsSub: {
    fontSize: 12,
    fontFamily: typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  grievanceCard: {
    backgroundColor: colors.bgCard,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  grievanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  grievanceTitle: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.textPrimary,
  },
  grievanceText: {
    fontSize: 12,
    fontFamily: typography.body,
    lineHeight: 19,
    color: colors.textSecond,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactLabel: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  contactValue: {
    fontSize: 11,
    fontFamily: typography.mono,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
