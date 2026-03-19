import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';

export default function CreatePostScreen() {
  const router = useRouter();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handlePost = async () => {
    if (!caption) { Alert.alert('Write a caption', 'Share your style story.'); return; }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      if (image) {
        formData.append('image', { uri: image, type: 'image/jpeg', name: 'post.jpg' } as any);
      }
      await api.post('/social/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Posted!', 'Your style story is live.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to post.');
    } finally { setPosting(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NEW POST</Text>
        <TouchableOpacity onPress={handlePost} disabled={posting}>
          {posting ? <ActivityIndicator color="#C9A84C" size="small" /> : <Text style={styles.shareText}>SHARE</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.imageArea} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <>
              <Ionicons name="image-outline" size={48} color="#C9A84C" />
              <Text style={styles.imageText}>TAP TO ADD PHOTO</Text>
            </>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.captionInput}
          placeholder="Share your style story..."
          placeholderTextColor="#6B5C52"
          value={caption}
          onChangeText={setCaption}
          multiline
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  cancelText: { color: '#6B5C52', fontSize: 14, letterSpacing: 1 },
  shareText: { color: '#C9A84C', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  content: { padding: 24, paddingBottom: 100 },
  imageArea: { width: '100%', height: 300, borderWidth: 1, borderColor: '#3A2C30', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2A1C20', marginBottom: 24, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imageText: { color: '#6B5C52', fontSize: 11, letterSpacing: 2, marginTop: 12 },
  captionInput: { minHeight: 100, color: 'white', fontSize: 16, lineHeight: 24, borderBottomWidth: 1, borderBottomColor: '#3A2C30', paddingVertical: 12 },
});
