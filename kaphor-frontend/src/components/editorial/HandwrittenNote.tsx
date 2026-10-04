import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, typography } from '../../theme';

interface HandwrittenNoteProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  rotation?: string;
  hasTape?: boolean;
}

export function HandwrittenNote({
  children,
  style,
  textStyle,
  rotation = '-1.5deg',
  hasTape = false,
}: HandwrittenNoteProps) {
  return (
    <View
      style={[
        styles.noteContainer,
        { transform: [{ rotate: rotation }] },
        style,
      ]}
    >
      {hasTape && <View style={styles.tape} />}
      <Text style={[styles.noteText, textStyle]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noteContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(250, 247, 240, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(23, 23, 23, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    position: 'relative',
  },
  tape: {
    position: 'absolute',
    top: -6,
    left: '35%',
    width: 32,
    height: 10,
    backgroundColor: 'rgba(184, 154, 62, 0.25)',
    borderWidth: 0.5,
    borderColor: 'rgba(184, 154, 62, 0.4)',
    transform: [{ rotate: '2deg' }],
  },
  noteText: {
    fontFamily: typography.script || typography.accent,
    fontSize: 15,
    lineHeight: 20,
    color: colors.inkSoft,
    letterSpacing: 0.2,
  },
});
