// src/components/common/DateTimePicker.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DateTimePickerProps {
  value: Date;
  mode: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (date: Date) => void;
  onCancel?: () => void;
  title?: string;
  visible: boolean;
  onClose: () => void;
}

export const CustomDateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  mode,
  minimumDate,
  maximumDate,
  onChange,
  onCancel,
  title,
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const [tempDate, setTempDate] = useState(value);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      onClose();
      if (event.type === 'set' && selectedDate) {
        onChange(selectedDate);
      } else if (onCancel) {
        onCancel();
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onChange(tempDate);
    onClose();
  };

  const handleCancel = () => {
    setTempDate(value);
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const formatDate = (date: Date): string => {
    if (mode === 'time') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } else if (mode === 'date') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  };

  if (Platform.OS === 'android') {
    return (
      <>
        {visible && (
          <DateTimePicker
            value={value}
            mode={mode}
            display="default"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleDateChange}
          />
        )}
      </>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: theme.colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {title || `Select ${mode === 'date' ? 'Date' : mode === 'time' ? 'Time' : 'Date & Time'}`}
          </Text>
          
          <TouchableOpacity onPress={handleConfirm} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: theme.colors.primary }]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected Value Display */}
        <View style={[styles.selectedContainer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons 
            name={mode === 'time' ? 'time-outline' : 'calendar-outline'} 
            size={24} 
            color={theme.colors.primary} 
          />
          <Text style={[styles.selectedText, { color: theme.colors.text }]}>
            {formatDate(tempDate)}
          </Text>
        </View>

        {/* Picker */}
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={tempDate}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleDateChange}
            textColor={theme.colors.text}
            style={styles.picker}
          />
        </View>

        {/* Quick Options for Date */}
        {mode === 'date' && (
          <View style={styles.quickOptionsContainer}>
            <Text style={[styles.quickOptionsTitle, { color: theme.colors.text }]}>
              Quick Select
            </Text>
            <View style={styles.quickOptionsRow}>
              <TouchableOpacity
                style={[styles.quickOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => setTempDate(new Date())}
              >
                <Text style={[styles.quickOptionText, { color: theme.colors.text }]}>
                  Today
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.quickOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setTempDate(tomorrow);
                }}
              >
                <Text style={[styles.quickOptionText, { color: theme.colors.text }]}>
                  Tomorrow
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.quickOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setTempDate(nextWeek);
                }}
              >
                <Text style={[styles.quickOptionText, { color: theme.colors.text }]}>
                  Next Week
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Options for Time */}
        {mode === 'time' && (
          <View style={styles.quickOptionsContainer}>
            <Text style={[styles.quickOptionsTitle, { color: theme.colors.text }]}>
              Common Times
            </Text>
            <View style={styles.quickOptionsGrid}>
              {['09:00', '12:00', '15:00', '18:00', '21:00'].map((timeStr) => (
                <TouchableOpacity
                  key={timeStr}
                  style={[styles.quickOption, { backgroundColor: theme.colors.surface }]}
                  onPress={() => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    const newDate = new Date(tempDate);
                    newDate.setHours(hours, minutes, 0, 0);
                    setTempDate(newDate);
                  }}
                >
                  <Text style={[styles.quickOptionText, { color: theme.colors.text }]}>
                    {new Date(0, 0, 0, parseInt(timeStr.split(':')[0]), parseInt(timeStr.split(':')[1])).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    gap: 12,
  },
  selectedText: {
    fontSize: 18,
    fontWeight: '500',
  },
  pickerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  picker: {
    height: 200,
  },
  quickOptionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  quickOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  quickOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default CustomDateTimePicker;