# Fix react-native-webview native module issue
# Run this from the kaphor-frontend directory

echo "=== Fixing react-native-webview native module ==="

# 1. Install the Expo-compatible version
echo "→ Installing Expo-compatible react-native-webview..."
npx expo install react-native-webview

# 2. Clear all caches
echo "→ Clearing caches..."
npx expo start -c

# 3. If still failing, try rebuilding the dev client
# npx expo run:android
# npx expo run:ios
