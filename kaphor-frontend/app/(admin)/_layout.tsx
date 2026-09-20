import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="users" />
      <Stack.Screen name="listings" />
      <Stack.Screen name="queues" />
      <Stack.Screen name="audit" />
    </Stack>
  );
}