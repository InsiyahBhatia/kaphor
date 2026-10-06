import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import { SolarIcon } from './common/SolarIcon';
import { colors, typography, spacing, radius } from '../theme';
import { hapticFeedback } from '../utils/haptics';
import { Spinner } from './common/Loader';
import { getErrorMessage } from '../utils/errors';

interface DelistOptionsModalProps {
  visible: boolean;
  item: any;
  onClose: () => void;
  onPauseToggle: (item: any) => Promise<void>;
  onMoveToWardrobe: (item: any) => Promise<void>;
  onDelete: (item: any) => Promise<void>;
}

export function DelistOptionsModal({
  visible,
  item,
  onClose,
  onPauseToggle,
  onMoveToWardrobe,
  onDelete,
}: DelistOptionsModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!item) return null;

  const isPaused = !item.isActive;

  const handlePause = async () => {
    try {
      hapticFeedback.light();
      setLoadingAction('pause');
      await onPauseToggle(item);
      onClose();
    } catch (err: any) {
      Alert.alert('Action Failed', getErrorMessage(err, 'Could not update listing status.'));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWardrobe = async () => {
    Alert.alert(
      'Move to Wardrobe',
      `Move "${item.title}" off the marketplace and return it to your personal digital wardrobe?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'MOVE TO WARDROBE',
          onPress: async () => {
            try {
              hapticFeedback.medium();
              setLoadingAction('wardrobe');
              await onMoveToWardrobe(item);
              onClose();
            } catch (err: any) {
              Alert.alert('Action Failed', getErrorMessage(err, 'Could not move to wardrobe.'));
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Listing Permanently',
      `Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticFeedback.heavy();
              setLoadingAction('delete');
              await onDelete(item);
              onClose();
            } catch (err: any) {
              Alert.alert('Error', getErrorMessage(err, 'Could not delete listing.'));
            } finally {
              setLoadingAction(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>MANAGE LISTING</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{item.title}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <SolarIcon name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {/* 1. Pause / Resume Listing */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={handlePause}
              disabled={loadingAction !== null}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: isPaused ? colors.emeraldLight : colors.goldLight }]}>
                <SolarIcon
                  name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                  size={24}
                  color={isPaused ? colors.forest : colors.orange}
                />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>
                  {isPaused ? 'RESUME LISTING' : 'PAUSE LISTING'}
                </Text>
                <Text style={styles.optionDesc}>
                  {isPaused
                    ? 'Reactivate this listing so buyers can discover and purchase it in the feed.'
                    : 'Temporarily hide from the feed and search without losing any listing details.'}
                </Text>
              </View>
              {loadingAction === 'pause' ? (
                <Spinner size="small" color={colors.charcoal} />
              ) : (
                <SolarIcon name="chevron-forward" size={18} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {/* 2. Move to Wardrobe */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={handleWardrobe}
              disabled={loadingAction !== null}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.overlayLight }]}>
                <SolarIcon name="shirt-outline" size={22} color={colors.navy} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>MOVE TO WARDROBE</Text>
                <Text style={styles.optionDesc}>
                  Delist from the marketplace and return to your private digital closet for personal styling.
                </Text>
              </View>
              {loadingAction === 'wardrobe' ? (
                <Spinner size="small" color={colors.navy} />
              ) : (
                <SolarIcon name="chevron-forward" size={18} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {/* 3. Delete Permanently */}
            <TouchableOpacity
              style={[styles.optionCard, styles.deleteCard]}
              onPress={handleDelete}
              disabled={loadingAction !== null}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.crimsonLight }]}>
                <SolarIcon name="trash-outline" size={22} color={colors.crimson} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.crimson }]}>DELETE LISTING</Text>
                <Text style={styles.optionDesc}>
                  Permanently remove this listing from the marketplace.
                </Text>
              </View>
              {loadingAction === 'delete' ? (
                <Spinner size="small" color={colors.crimson} />
              ) : (
                <SolarIcon name="chevron-forward" size={18} color={colors.crimson} />
              )}
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    borderTopWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  title: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    marginTop: 2,
    maxWidth: 260,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    gap: 12,
    marginBottom: spacing.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: 12,
  },
  deleteCard: {
    borderColor: colors.crimsonLight,
    backgroundColor: colors.crimsonLight,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.textPrimary,
  },
  optionDesc: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textSecond,
    marginTop: 3,
    lineHeight: 15,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.charcoal,
    borderRadius: radius.sm,
  },
  cancelBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.cream,
  },
});
