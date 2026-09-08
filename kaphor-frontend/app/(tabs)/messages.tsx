import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../src/theme';
import { Header } from '../../src/components/common/Header';
import { KaphorImage } from '../../src/components/KaphorImage';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { messageService, ConversationSummary } from '../../src/services/messageService';
import { getSocket, connectSocket } from '../../src/services/socket';

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const list = await messageService.listConversations();
      setConversations(list);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();

      // Listen for incoming live socket events to update inbox in real time
      const socket = connectSocket() || getSocket();
      if (socket) {
        const handler = () => {
          loadConversations();
        };
        socket.on('new_direct_message', handler);
        return () => {
          socket.off('new_direct_message', handler);
        };
      }
    }, [loadConversations])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: ConversationSummary }) => {
    const isUnread = item.unreadCount > 0;
    return (
      <TouchableOpacity
        style={[styles.convCard, isUnread && styles.convCardUnread]}
        onPress={() => router.push(`/messages/${item.id}` as any)}
        activeOpacity={0.75}
      >
        {/* User Avatar */}
        <View style={styles.avatarWrap}>
          <KaphorImage
            uri={item.otherUser.avatar || ''}
            style={styles.avatar}
            contentFit="cover"
          />
          {item.otherUser.isVerified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="shield-checkmark" size={12} color="#C9A84C" />
            </View>
          )}
        </View>

        {/* Conversation Info */}
        <View style={styles.convInfo}>
          <View style={styles.convHeader}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, isUnread && styles.userNameUnread]} numberOfLines={1}>
                {item.otherUser.displayName}
              </Text>
              {item.otherUser.isVerified && <VerifiedBadge size="compact" />}
            </View>
            <Text style={styles.timeText}>{formatTime(item.lastMessageAt)}</Text>
          </View>

          {/* Garment Context Tag */}
          {item.garment && (
            <View style={styles.garmentBadge}>
              <Ionicons name="pricetag-outline" size={10} color={colors.textMuted} />
              <Text style={styles.garmentBadgeText} numberOfLines={1}>
                {item.garment.brand} · {item.garment.title}
              </Text>
            </View>
          )}

          {/* Message snippet */}
          <Text
            style={[styles.messageSnippet, isUnread && styles.messageSnippetUnread]}
            numberOfLines={1}
          >
            {item.lastMessageText || 'Tap to start conversation'}
          </Text>
        </View>

        {/* Garment Thumbnail */}
        {item.garment?.image && (
          <KaphorImage
            uri={item.garment.image}
            style={styles.garmentThumb}
            contentFit="cover"
          />
        )}

        {/* Unread Pill */}
        {isUnread && (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{item.unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="MESSAGES" />

      {/* Safety Notice Bar */}
      <View style={styles.safetyBar}>
        <Ionicons name="shield-checkmark" size={14} color="#C9A84C" />
        <Text style={styles.safetyBarText}>
          Kaphor Encrypted Chat • Direct Buyer & Seller Communications
        </Text>
      </View>

      {loading ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator color={colors.charcoal} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.charcoal} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={42} color={colors.charcoal} />
              </View>
              <Text style={styles.emptyTitle}>NO CONVERSATIONS YET</Text>
              <Text style={styles.emptyDesc}>
                When you inquire about garments or negotiate deals with circular sellers, your direct chat threads appear here.
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => router.push('/(tabs)/shop')}
                activeOpacity={0.8}
              >
                <Text style={styles.exploreBtnText}>EXPLORE MARKETPLACE →</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: colors.charcoal,
    borderBottomWidth: 1,
    borderBottomColor: '#C9A84C',
  },
  safetyBarText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(30,31,34,0.15)',
    gap: 12,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
    elevation: 2,
  },
  convCardUnread: {
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    elevation: 3,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.charcoal,
    padding: 2,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  convInfo: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
  },
  userNameUnread: {
    fontWeight: '900',
  },
  timeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  garmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cream,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
  },
  garmentBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
  },
  messageSnippet: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  messageSnippetUnread: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  garmentThumb: {
    width: 42,
    height: 48,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  unreadPill: {
    backgroundColor: colors.red,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadPillText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  emptyTitle: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyDesc: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  exploreBtn: {
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  exploreBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
