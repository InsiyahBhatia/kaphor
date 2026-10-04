import os

def update_file(path, replacements):
    if not os.path.exists(path):
        print(f"Skipping {path}, does not exist")
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read().replace('\r\n', '\n')
    
    changed = False
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            changed = True
            print(f"Replaced in {path}: {old[:30]}...")
        else:
            print(f"Not found in {path}: {old[:30]}...")
            
    if changed:
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f"Updated {path}")

# 2. Swap screen image picker
swap_old_import = "import * as ImagePicker from 'expo-image-picker';"
swap_new_import = "import * as ImagePicker from 'expo-image-picker';\nimport { promptPhotoSelection } from '../../../src/utils/imagePicker';"

swap_old_picker = """  const pickConditionPhoto = () => {
    Alert.alert('Condition Evidence', 'Take a close-up photo with your camera or choose one from your gallery:', [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Grant camera access to take condition evidence photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!result.canceled && result.assets[0]?.uri) {
              setConditionPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 3));
            }
          } catch {
            Alert.alert('Error', 'Failed to capture photo');
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Grant photo access to add condition evidence.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!result.canceled && result.assets[0]?.uri) {
              setConditionPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 3));
            }
          } catch {
            Alert.alert('Error', 'Failed to pick photo');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };"""

swap_new_picker = """  const pickConditionPhoto = () => {
    promptPhotoSelection({
      title: 'Condition Evidence',
      quality: 0.85,
      base64: true,
      onImagePicked: (result) => {
        if (result?.uri) {
          setConditionPhotos((prev) => [...prev, result.uri].slice(0, 3));
        }
      },
      onError: (err) => {
        Alert.alert('Error', err?.message || 'Failed to capture or pick photo');
      },
    });
  };"""

update_file('app/(tabs)/swap/[id].tsx', [
    (swap_old_import, swap_new_import),
    (swap_old_picker, swap_new_picker),
])

# 3. AccountSettingsScreen
acc_old_import = "import * as ImagePicker from 'expo-image-picker';"
acc_new_import = "import * as ImagePicker from 'expo-image-picker';\nimport { promptPhotoSelection } from '../../utils/imagePicker';"

acc_old_picker = """      Alert.alert('Update Photo', 'Choose an option', [
        {
          text: 'Camera',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setAvatarUrl(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setAvatarUrl(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);"""

acc_new_picker = """      promptPhotoSelection({
        title: 'Update Profile Photo',
        quality: 0.8,
        onImagePicked: (res) => {
          if (res?.uri) setAvatarUrl(res.uri);
        },
        onError: (err) => {
          Alert.alert('Error', err?.message || 'Could not pick image');
        },
      });"""

update_file('src/screens/profile/AccountSettingsScreen.tsx', [
    (acc_old_import, acc_new_import),
    (acc_old_picker, acc_new_picker),
])

# 4. Messages attachment
msg_old_import = "import * as ImagePicker from 'expo-image-picker';"
msg_new_import = "import * as ImagePicker from 'expo-image-picker';\nimport { promptPhotoSelection } from '../../src/utils/imagePicker';"

msg_old_attach = """    Alert.alert('Send Image', 'Choose image source:', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);"""

msg_new_attach = """    promptPhotoSelection({
      title: 'Send Image',
      quality: 0.8,
      onImagePicked: (res) => {
        if (res?.uri) sendImageAttachment(res.uri);
      },
    });"""

update_file('app/messages/[conversationId].tsx', [
    (msg_old_import, msg_new_import),
    (msg_old_attach, msg_new_attach),
])

print("Finished updating all upload from camera handlers!")
