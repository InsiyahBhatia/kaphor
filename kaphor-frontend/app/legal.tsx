import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';
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
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Search policies (e.g. escrow, taxes, return, privacy)"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
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
                <Ionicons
                  name={doc.icon as any}
                  size={14}
                  color={isActive ? colors.white : colors.textSecond}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
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
          <View style={styles.badgeRow}>
            <View style={styles.statuteBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.white} />
              <Text style={styles.statuteBadgeText}>{activeDoc.badge}</Text>
            </View>
          </View>
          <Text style={styles.docTitle}>{activeDoc.title}</Text>
          <Text style={styles.statutoryRef}>{activeDoc.statutoryReference}</Text>
        </View>

        {/* Quick Take Card */}
        {!searchQuery && (
          <View style={styles.quickTakeCard}>
            <View style={styles.quickTakeHeader}>
              <Ionicons name="flash-outline" size={16} color="#8A6D1C" />
              <Text style={styles.quickTakeTitle}>PLAIN-LANGUAGE QUICK TAKE</Text>
            </View>
            <Text style={styles.quickTakeSub}>
              Summary of key points before formal statutory language:
            </Text>
            {activeDoc.quickTake.map((point, pIdx) => (
              <View key={pIdx} style={styles.quickTakeRow}>
                <Ionicons name="checkmark-circle" size={16} color="#1E3B2F" style={{ marginTop: 2 }} />
                <Text style={styles.quickTakeText}>{point}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Formal Provisions */}
        <Text style={styles.sectionHeader}>
          {searchQuery
            ? `SEARCH RESULTS (${filteredClauses.length} CLAUSES FOUND)`
            : 'FORMAL LEGAL PROVISIONS'}
        </Text>

        {filteredClauses.length === 0 ? (
          <View style={styles.noResultsCard}>
            <Ionicons name="search-outline" size={32} color={colors.textMuted} />
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
                  <Text style={styles.legalBasisLabel}>Statutory Authority:</Text>
                  <Text style={styles.legalBasisText}>{clause.legalBasis}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}

        {/* Grievance Redressal Card */}
        <View style={styles.grievanceCard}>
          <View style={styles.grievanceHeader}>
            <Ionicons name="information-circle" size={20} color={colors.crimson} />
            <Text style={styles.grievanceTitle}>STATUTORY GRIEVANCE REDRESSAL</Text>
          </View>
          <Text style={styles.grievanceText}>
            Under Rule 3(2) of the IT Rules 2021 and the DPDP Act 2023, complaints are acknowledged within 24 hours and addressed within 15 days.
          </Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Grievance Officer:</Text>
            <Text style={styles.contactValue}>Insiyah Bhatia (grievance@kaphor.com)</Text>
          </View>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>National Consumer Helpline:</Text>
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
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  chipsWrapper: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.crimson,
    borderColor: colors.crimson,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecond,
    letterSpacing: 0.5,
  },
  chipTextActive: {
    color: colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  docHeaderCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statuteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3B2F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  statuteBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  docTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  statutoryRef: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  quickTakeCard: {
    backgroundColor: '#FBF8F1',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8DCB8',
    marginBottom: 20,
  },
  quickTakeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  quickTakeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#8A6D1C',
    letterSpacing: 1.2,
  },
  quickTakeSub: {
    fontSize: 12,
    color: colors.textSecond,
    marginBottom: 12,
  },
  quickTakeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  quickTakeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: colors.textSecond,
    marginBottom: 12,
  },
  clauseCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  clauseHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  clauseBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecond,
    marginBottom: 10,
  },
  legalBasisBox: {
    backgroundColor: colors.bg,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.crimson,
  },
  legalBasisLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  legalBasisText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  noResultsCard: {
    backgroundColor: colors.bgCard,
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  noResultsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 10,
  },
  noResultsSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  grievanceCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  grievanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  grievanceTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  grievanceText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecond,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecond,
  },
  contactValue: {
    fontSize: 11,
    color: colors.crimson,
    fontWeight: '600',
  },
});
