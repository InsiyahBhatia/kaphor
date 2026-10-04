import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImageResult {
  uri: string;
  base64?: string | null;
}

/**
 * Capture an image from camera with seamless web and native support.
 */
export async function capturePhotoFromCamera(options?: {
  quality?: number;
  base64?: boolean;
}): Promise<PickedImageResult | null> {
  const quality = options?.quality ?? 0.85;
  const includeBase64 = options?.base64 ?? true;

  // On Web: use HTML5 file input with camera capture
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.style.display = 'none';

        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            input.remove();
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : null;
            resolve({
              uri: dataUrl,
              base64: includeBase64 ? b64 : null,
            });
            input.remove();
          };
          reader.onerror = () => {
            resolve(null);
            input.remove();
          };
          reader.readAsDataURL(file);
        };

        document.body.appendChild(input);
        input.click();
      } catch (err) {
        console.warn('Web camera input fallback error:', err);
        // Fallback to ImagePicker launchImageLibraryAsync
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality,
          base64: includeBase64,
        })
          .then((res) => {
            if (!res.canceled && res.assets && res.assets[0]) {
              resolve({
                uri: res.assets[0].uri,
                base64: res.assets[0].base64 || null,
              });
            } else {
              resolve(null);
            }
          })
          .catch(() => resolve(null));
      }
    });
  }

  // On Native (iOS / Android)
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera permissions in settings to take photos of your garments.',
        [
          { text: 'Choose from Gallery', onPress: () => {} },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality,
      base64: includeBase64,
      allowsEditing: false, // allowsEditing can cause crashes on certain Android versions without crop activity
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      return {
        uri: result.assets[0].uri,
        base64: result.assets[0].base64 || null,
      };
    }
    return null;
  } catch (err: any) {
    console.warn('Camera launch error, falling back to library:', err);
    // Graceful fallback to gallery if camera fails
    return pickPhotoFromGallery(options);
  }
}

/**
 * Pick an image from photo library/gallery.
 */
export async function pickPhotoFromGallery(options?: {
  quality?: number;
  base64?: boolean;
}): Promise<PickedImageResult | null> {
  const quality = options?.quality ?? 0.85;
  const includeBase64 = options?.base64 ?? true;

  // On Web: use HTML5 file input for immediate reliable upload
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';

        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            input.remove();
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : null;
            resolve({
              uri: dataUrl,
              base64: includeBase64 ? b64 : null,
            });
            input.remove();
          };
          reader.onerror = () => {
            resolve(null);
            input.remove();
          };
          reader.readAsDataURL(file);
        };

        document.body.appendChild(input);
        input.click();
      } catch (err) {
        console.warn('Web gallery input fallback error:', err);
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality,
          base64: includeBase64,
        })
          .then((res) => {
            if (!res.canceled && res.assets && res.assets[0]) {
              resolve({
                uri: res.assets[0].uri,
                base64: res.assets[0].base64 || null,
              });
            } else {
              resolve(null);
            }
          })
          .catch(() => resolve(null));
      }
    });
  }

  // Native
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Gallery Permission Required',
        'Please grant access to your photo library to select photos.'
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality,
      base64: includeBase64,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      return {
        uri: result.assets[0].uri,
        base64: result.assets[0].base64 || null,
      };
    }
    return null;
  } catch (err) {
    console.warn('Gallery launch error:', err);
    return null;
  }
}

export interface PromptPhotoOptions {
  title?: string;
  message?: string;
  quality?: number;
  base64?: boolean;
  onImagePicked?: (image: PickedImageResult) => void;
  onImageSelected?: (image: PickedImageResult) => void;
  onError?: (err: any) => void;
}

/**
 * Universal prompt to choose between Camera or Gallery across Web & Native
 */
export function promptPhotoSelection(
  optionsOrTitle: string | PromptPhotoOptions,
  callback?: (image: PickedImageResult) => void
) {
  let title = 'Upload Photo';
  let onSelected: (img: PickedImageResult) => void = () => {};
  let quality = 0.85;
  let base64 = true;
  let onError: ((err: any) => void) | undefined;

  if (typeof optionsOrTitle === 'string') {
    title = optionsOrTitle;
    if (callback) onSelected = callback;
  } else if (optionsOrTitle && typeof optionsOrTitle === 'object') {
    title = optionsOrTitle.title || 'Upload Photo';
    if (optionsOrTitle.onImagePicked) onSelected = optionsOrTitle.onImagePicked;
    else if (optionsOrTitle.onImageSelected) onSelected = optionsOrTitle.onImageSelected;
    if (optionsOrTitle.quality !== undefined) quality = optionsOrTitle.quality;
    if (optionsOrTitle.base64 !== undefined) base64 = optionsOrTitle.base64;
    onError = optionsOrTitle.onError;
  }

  const handleResult = (res: PickedImageResult | null) => {
    if (res) {
      onSelected(res);
    }
  };

  // On Web: file input with camera environment capture
  if (Platform.OS === 'web') {
    capturePhotoFromCamera({ quality, base64 })
      .then(handleResult)
      .catch((err) => {
        if (onError) onError(err);
      });
    return;
  }

  Alert.alert(
    title,
    'Take a new photo with your camera or select an existing photo from your library:',
    [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const res = await capturePhotoFromCamera({ quality, base64 });
            handleResult(res);
          } catch (err) {
            if (onError) onError(err);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const res = await pickPhotoFromGallery({ quality, base64 });
            handleResult(res);
          } catch (err) {
            if (onError) onError(err);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
}
