import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { socialService } from '../../../src/services/socialService';

export default function SocialScreen() {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await socialService.getFeed();
      setFeed(data);
    } catch (error) {
      console.error('Failed to load social feed', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Kaphor Social</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/social/create')}>
          <Ionicons name="add-circle-outline" size={28} color="#C9A84C" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stories}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.storyContainer}>
            <View style={styles.storyCircle}>
              <Image 
                source={{ uri: `https://i.pravatar.cc/150?u=${i}` }} 
                style={styles.storyImage}
              />
            </View>
            <Text style={styles.storyUser}>User_{i}</Text>
          </View>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.feed}>
          {feed.length === 0 ? (
            <Text style={styles.emptyText}>Nothing here yet. Follow someone to see their posts!</Text>
          ) : (
            feed.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Image source={{ uri: post.user?.avatarUrl || 'https://i.pravatar.cc/150?u=9' }} style={styles.postAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postUsername}>{post.user?.displayName || 'Anonymous'}</Text>
                    <Text style={styles.postLocation}>{post.location || 'Kaphor World'}</Text>
                  </View>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: '#C9A84C' }}
                    onPress={async () => {
                      try {
                        const { data } = await (await import('../../../src/services/api')).default.post(`/social/follow/${post.user?.id}`);
                      } catch {}
                    }}
                  >
                    <Text style={{ color: '#C9A84C', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>FOLLOW</Text>
                  </TouchableOpacity>
                </View>
                
                <Image 
                  source={{ uri: post.imageUrl || 'https://images.unsplash.com/photo-1600000000000?q=80&w=800&auto=format&fit=crop' }} 
                  style={styles.postImage}
                />

                <View style={styles.postActions}>
                  <View style={styles.mainActions}>
                    <TouchableOpacity onPress={() => socialService.likePost(post.id)}>
                      <Ionicons name={post.isLiked ? "heart" : "heart-outline"} size={24} color={post.isLiked ? "#9B1B30" : "white"} />
                    </TouchableOpacity>
                    <Ionicons name="chatbubble-outline" size={24} color="white" />
                    <Ionicons name="paper-plane-outline" size={24} color="white" />
                  </View>
                  {post.garmentId && (
                    <TouchableOpacity 
                      style={styles.shopLook}
                      onPress={() => router.push(`/(tabs)/shop/${post.garmentId}`)}
                    >
                      <Text style={styles.shopLookText}>SHOP THE LOOK</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.postContent}>
                  <Text style={styles.postCaption}>
                    <Text style={styles.bold}>{post.user?.displayName || 'User'}</Text> {post.caption}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  stories: {
    paddingLeft: 24,
    marginBottom: 32,
  },
  storyContainer: {
    alignItems: 'center',
    marginRight: 20,
  },
  storyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#C9A84C',
    padding: 3,
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
  },
  storyUser: {
    color: '#6B5C52',
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 1,
  },
  feed: {
    paddingHorizontal: 0,
  },
  postCard: {
    marginBottom: 32,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postUsername: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  postLocation: {
    color: '#6B5C52',
    fontSize: 10,
  },
  postImage: {
    width: '100%',
    height: 400,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    alignItems: 'center',
  },
  mainActions: {
    flexDirection: 'row',
    gap: 16,
  },
  shopLook: {
    backgroundColor: '#C9A84C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  shopLookText: {
    color: '#1A0C10',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  postContent: {
    paddingHorizontal: 12,
  },
  postCaption: {
    color: 'white',
    fontSize: 13,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
  emptyText: {
    color: '#6B5C52',
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
    paddingHorizontal: 40,
    lineHeight: 20,
    fontFamily: 'CormorantGaramond_700Bold',
  },
});
