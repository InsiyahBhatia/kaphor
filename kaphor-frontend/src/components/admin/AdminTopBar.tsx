import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function AdminTopBar({ title, subtitle, onBack, onRefresh, refreshing }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={18} color={colors.ink} />
      </TouchableOpacity>
      <View style={styles.titleCol}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle.toUpperCase()}</Text>
        ) : null}
      </View>
      {onRefresh && (
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={refreshing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="refresh" size={18} color={colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: { flex: 1 },
  title: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 4,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});