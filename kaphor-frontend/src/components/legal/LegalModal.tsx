import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { LEGAL_DOCUMENTS, LegalDocument } from '../../data/legalPolicies';

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  initialDocId?: string;
  onAccept?: () => void;
  showAcceptButton?: boolean;
  acceptButtonText?: string;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  visible,
  onClose,
  initialDocId = 'terms-and-conditions',
  onAccept,
  showAcceptButton = false,
  acceptButtonText = 'I UNDERSTAND & AGREE',
}) => {
  const [selectedId, setSelectedId] = useState<string>(initialDocId);

  useEffect(() => {
    if (initialDocId) {
      setSelectedId(initialDocId);
    }
  }, [initialDocId, visible]);

  const activeDoc: LegalDocument =
    LEGAL_DOCUMENTS.find((d) => d.id === selectedId) || LEGAL_DOCUMENTS[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Modal Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>KAPHOR</Text>
              <Text style={styles.modalSubtitle}>Legal & Compliance Documents</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Horizontal Document Switcher Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {LEGAL_DOCUMENTS.map((doc) => {
              const isActive = doc.id === selectedId;
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSelectedId(doc.id)}
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

        {/* Document Content Scroll */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Document Header Card */}
          <View style={styles.docHeaderCard}>
            <Text style={styles.docTitle}>{activeDoc.title}</Text>
            <Text style={styles.docMeta}>Last updated: 20 September 2026 · Version 1.0</Text>
            <View style={styles.headerRule} />
            <Text style={styles.statutoryRef}>{activeDoc.statutoryReference}</Text>
          </View>

          {/* Full Statutory Clauses */}
          <Text style={styles.clausesSectionTitle}>AGREEMENT CLAUSES</Text>
          {activeDoc.clauses.map((clause, cIdx) => (
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
          ))}

          {/* Grievance Officer Quick Contact Footer */}
          <View style={styles.grievanceNotice}>
            <Ionicons name="mail-outline" size={16} color={colors.ink} />
            <Text style={styles.grievanceNoticeText}>
              For questions or dispute escalations, contact the Grievance Officer at{' '}
              <Text style={{ fontWeight: '700', color: colors.ink }}>grievance@kaphor.com</Text>.
            </Text>
          </View>
        </ScrollView>

        {/* Optional Modal Bottom Action Bar */}
        {showAcceptButton && onAccept && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => {
                onAccept();
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-done" size={18} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.acceptButtonText}>{acceptButtonText}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 10,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 0,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24.5,
    fontFamily: typography.headings,
    fontWeight: '400',
    letterSpacing: 2.5,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13.5,
    fontFamily: typography.mono,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
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
    fontSize: 13.5,
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
    fontSize: 28,
    fontFamily: typography.headings,
    fontWeight: '400',
    color: colors.textPrimary,
    letterSpacing: 1.2,
    lineHeight: 28,
    marginBottom: 6,
  },
  docMeta: {
    fontSize: 13.5,
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
    fontSize: 13.5,
    fontFamily: typography.mono,
    color: colors.textSecond,
    lineHeight: 16,
  },
  clausesSectionTitle: {
    fontSize: 14.5,
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
    fontSize: 17,
    fontFamily: typography.monoBold,
    color: colors.textPrimary,
    marginBottom: 10,
    lineHeight: 19,
    letterSpacing: 0.3,
  },
  clauseBody: {
    fontSize: 17,
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
    fontSize: 12,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.4,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  legalBasisText: {
    fontSize: 15,
    fontFamily: typography.mono,
    color: colors.textMuted,
    lineHeight: 17,
  },
  grievanceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.bgCard,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    marginTop: 8,
  },
  grievanceNoticeText: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: typography.body,
    color: colors.textSecond,
    lineHeight: 18,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptButton: {
    backgroundColor: colors.ink,
    height: 52,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: colors.cream,
    fontSize: 17,
    fontFamily: typography.mono,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
});
