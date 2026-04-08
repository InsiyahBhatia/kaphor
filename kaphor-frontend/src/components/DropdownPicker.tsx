import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';

interface Option {
  id: string;
  label: string;
  group?: string;
  desc?: string;
}

interface DropdownPickerProps {
  label: string;
  options: Option[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  isGrouped?: boolean;
}

export const DropdownPicker: React.FC<DropdownPickerProps> = ({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = 'SELECT OPTION',
  isGrouped = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((o) => o.id === selectedValue);

  const renderItem = ({ item }: { item: Option | { type: 'header'; label: string } }) => {
    if ('type' in item && item.type === 'header') {
      return (
        <View style={styles.headerItem}>
          <Text style={styles.headerText}>{item.label}</Text>
        </View>
      );
    }

    const typedItem = item as Option;
    const isSelected = typedItem.id === selectedValue;

    return (
      <TouchableOpacity
        style={[styles.optionItem, isSelected && styles.optionItemActive]}
        onPress={() => {
          onSelect(typedItem.id);
          setModalVisible(false);
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
            {typedItem.label}
          </Text>
          {typedItem.desc && (
            <Text style={styles.optionDesc} numberOfLines={1}>
              {typedItem.desc}
            </Text>
          )}
        </View>
        {isSelected && <Ionicons name="checkmark-sharp" size={20} color={colors.red} />}
      </TouchableOpacity>
    );
  };

  const data: (Option | { type: 'header'; label: string })[] = [];
  if (isGrouped) {
    const groups = Array.from(new Set(options.map((o) => o.group).filter(Boolean)));
    groups.forEach((group) => {
      data.push({ type: 'header', label: group! });
      data.push(...options.filter((o) => o.group === group));
    });
    // Add ungrouped items
    const ungrouped = options.filter((o) => !o.group);
    if (ungrouped.length > 0) {
      data.push({ type: 'header', label: 'OTHER' });
      data.push(...ungrouped);
    }
  } else {
    data.push(...options);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.triggerText, !selectedOption && { color: colors.textMuted }]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons name="chevron-down-sharp" size={20} color={colors.charcoal} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label} // REFINEMENT</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-sharp" size={24} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={data}
              renderItem={renderItem}
              keyExtractor={(item, index) => ('id' in item ? item.id : `header-${index}`)}
              contentContainerStyle={styles.listContent}
              stickyHeaderIndices={isGrouped ? data.map((item, idx) => ('type' in item ? idx : -1)).filter(i => i !== -1) : []}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.red,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  trigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  triggerText: {
    fontFamily: typography.mono,
    fontSize: 14,
    color: colors.charcoal,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cream,
    height: '70%',
    borderTopWidth: 4,
    borderTopColor: colors.charcoal,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,26,26,0.1)',
  },
  modalTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    letterSpacing: 2,
  },
  listContent: {
    paddingBottom: 40,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,26,26,0.05)',
    backgroundColor: colors.cream,
  },
  optionItemActive: {
    backgroundColor: colors.white,
  },
  optionLabel: {
    fontFamily: typography.mono,
    fontSize: 14,
    color: colors.charcoal,
    fontWeight: '600',
  },
  optionLabelActive: {
    color: colors.red,
    fontWeight: '800',
  },
  optionDesc: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  headerItem: {
    backgroundColor: colors.charcoal,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  headerText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
