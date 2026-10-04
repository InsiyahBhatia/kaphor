with open('app/(tabs)/studio/upcycle.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('\r\n', '\n')

old_code = """  const pickImage = () => {
    Alert.alert('Add Garment Photo', 'Take a new photo with your camera or choose one from your gallery:', [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') { Alert.alert('Permission needed', 'Grant camera permission to take a photo.'); return; }
            const pick = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!pick.canceled && pick.assets?.[0]) setImage(pick.assets[0].uri);
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
            if (status !== 'granted') { Alert.alert('Permission needed', 'Grant gallery permission to select a photo.'); return; }
            const pick = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!pick.canceled && pick.assets?.[0]) setImage(pick.assets[0].uri);
          } catch {
            Alert.alert('Error', 'Failed to pick photo');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };"""

new_code = """  const pickImage = () => {
    promptPhotoSelection({
      title: 'Add Garment Photo',
      quality: 0.85,
      base64: true,
      onImagePicked: (res) => {
        if (res.uri) setImage(res.uri);
      },
      onError: (err) => {
        Alert.alert('Error', err?.message || 'Failed to capture or pick photo');
      },
    });
  };"""

if old_code in text:
    text = text.replace(old_code, new_code)
    with open('app/(tabs)/studio/upcycle.tsx', 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print("SUCCESS")
else:
    print("NOT FOUND")
