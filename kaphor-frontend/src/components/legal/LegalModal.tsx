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
import { colors, typography, radius } from '../../theme';
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
              <Text style={styles.modalTitle}>KAPHOR LEGAL & COMPLIANCE</Text>
              <Text style={styles.modalSubtitle}>Indian Regulatory & Fair Trade Framework</Text>
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
            <View style={styles.badgeRow}>
              <View style={styles.statuteBadge}>
                <Ionicons name="shield-checkmark" size={12} color={colors.white} />
                <Text style={styles.statuteBadgeText}>{activeDoc.badge}</Text>
              </View>
            </View>

            <Text style={styles.docTitle}>{activeDoc.title}</Text>
            <Text style={styles.statutoryRef}>{activeDoc.statutoryReference}</Text>
          </View>

          {/* Plain English Quick Take */}
          <View style={styles.quickTakeCard}>
            <View style={styles.quickTakeHeader}>
              <Ionicons name="flash-outline" size={16} color={colors.gold || '#C9A84C'} />
              <Text style={styles.quickTakeTitle}>PLAIN-LANGUAGE QUICK TAKE</Text>
            </View>
            <Text style={styles.quickTakeSub}>
              A quick 30-second summary before reading the formal statutory clauses:
            </Text>
            {activeDoc.quickTake.map((point, pIdx) => (
              <View key={pIdx} style={styles.quickTakeRow}>
                <Ionicons name="checkmark-circle" size={16} color="#1E3B2F" style={{ marginTop: 2 }} />
                <Text style={styles.quickTakeText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Full Statutory Clauses */}
          <Text style={styles.clausesSectionTitle}>FORMAL LEGAL PROVISIONS</Text>
          {activeDoc.clauses.map((clause, cIdx) => (
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
          ))}

          {/* Grievance Officer Quick Contact Footer */}
          <View style={styles.grievanceNotice}>
            <Ionicons name="mail" size={16} color={colors.textSecond} />
            <Text style={styles.grievanceNoticeText}>
              Questions or dispute escalations? Contact Grievance Officer at{' '}
              <Text style={{ fontWeight: '700', color: colors.crimson }}>grievance@kaphor.com</Text>
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
    paddingBottom: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
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
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
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
    padding: 20,
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
  clausesSectionTitle: {
    fontSize: 13,
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
  grievanceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    marginTop: 10,
  },
  grievanceNoticeText: {
    flex: 1,
    fontSize: 12,
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
    backgroundColor: colors.crimson,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
