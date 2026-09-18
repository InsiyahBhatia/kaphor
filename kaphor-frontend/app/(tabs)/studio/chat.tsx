import React from 'react';
import ShopAIChatScreen from '../shop/ai-chat';

export type {
  AgentActionLog,
  AgentCard,
  AgentOutfitItem,
  AgentOutfitLook,
} from '../shop/ai-chat';

/**
 * Unified AI Stylist Agent screen for Studio / Circular tab.
 * Uses the exact same autonomous stylist engine, session memory, and UI as the Shop tab.
 */
export default function StudioAIChatScreen() {
  return <ShopAIChatScreen fallbackPath="/(tabs)/circular" />;
}
