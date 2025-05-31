// src/components/reminders/NotificationSettingsModal.tsx - Updated with real functionality
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import { NotificationService } from '@/services/notifications/NotificationService';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface NotificationSettings {
  enabled: boolean;
  reminderDays: number[];
  timeOfDay: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

const REMINDER_DAY_OPTIONS = [
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
  { value: 14, label: '2 weeks before' },
  { value: 30, label: '1 month before' },
];

export default function NotificationSettingsModal({ visible, onClose }: NotificationSettingsModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showQuietStartPicker, setShowQuietStartPicker] = useState(false);
  const [showQuietEndPicker, setShowQuietEndPicker] = useState(false);
  
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    reminderDays: [1, 3, 7],
    timeOfDay: '09:00',
    pushEnabled: true,
    emailEnabled: false,
    smsEnabled: false,
    soundEnabled: true,
    vibrationEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });

  useEffect(() => {
    if (visible && user) {
      loadSettings();
    }
  }, [visible, user]);

  const loadSettings = async () => {
    try {
      const userSettings = await NotificationService.getNotificationSettings(user?.id || '');
      if (userSettings) {
        setSettings(userSettings);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!user) return;

    try {
      await NotificationService.sendTestNotification(user.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const toggleReminderDay = (day: number) => {
    const newReminderDays = settings.reminderDays.includes(day)
      ? settings.reminderDays.filter(d => d !== day)
      : [...settings.reminderDays, day].sort((a, b) => a - b);
    
    setSettings({ ...settings, reminderDays: newReminderDays });
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleTimeSelect = (date: Date, type: 'main' | 'quietStart' | 'quietEnd') => {
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    if (type === 'main') {
      setSettings({ ...settings, timeOfDay: timeString });
    } else if (type === 'quietStart') {
      setSettings({ ...settings, quietHoursStart: timeString });
    } else if (type === 'quietEnd') {
      setSettings({ ...settings, quietHoursEnd: timeString });
    }
  };

  const createTimeFromString = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const SettingRow = ({ 
    icon, 
    title, 
    description, 
    value, 
    onToggle,
    disabled = false 
  }: {
    icon: string;
    title: string;
    description?: string;
    value: boolean;
    onToggle: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <View style={[
      styles.settingRow, 
      { backgroundColor: theme.colors.surface },
      disabled && { opacity: 0.5 }
    ]}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={20} color={theme.colors.primary} />
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          {description && (
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={value ? 'white' : theme.colors.textSecondary}
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: theme.colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Notifications
          </Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={styles.headerButton}
            disabled={loading}
          >
            <Text style={[styles.headerButtonText, { 
              color: loading ? theme.colors.textSecondary : theme.colors.primary 
            }]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Toggle */}
          <View style={styles.section}>
            <SettingRow
              icon="notifications-outline"
              title="Enable Notifications"
              description="Receive reminders about upcoming bills"
              value={settings.enabled}
              onToggle={(value) => setSettings({ ...settings, enabled: value })}
            />
          </View>

          {/* Notification Types */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Notification Types
            </Text>
            
            <SettingRow
              icon="phone-portrait-outline"
              title="Push Notifications"
              description="Show notifications on this device"
              value={settings.pushEnabled}
              onToggle={(value) => setSettings({ ...settings, pushEnabled: value })}
              disabled={!settings.enabled}
            />
            
            <SettingRow
              icon="mail-outline"
              title="Email Notifications"
              description="Send reminders to your email"
              value={settings.emailEnabled}
              onToggle={(value) => setSettings({ ...settings, emailEnabled: value })}
              disabled={!settings.enabled}
            />
            
            <SettingRow
              icon="chatbubble-outline"
              title="SMS Notifications"
              description="Send text message reminders"
              value={settings.smsEnabled}
              onToggle={(value) => setSettings({ ...settings, smsEnabled: value })}
              disabled={!settings.enabled}
            />
          </View>

          {/* Sound & Vibration */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Alert Settings
            </Text>
            
            <SettingRow
              icon="volume-high-outline"
              title="Sound"
              description="Play sound with notifications"
              value={settings.soundEnabled}
              onToggle={(value) => setSettings({ ...settings, soundEnabled: value })}
              disabled={!settings.enabled}
            />
            
            <SettingRow
              icon="phone-portrait-outline"
              title="Vibration"
              description="Vibrate when receiving notifications"
              value={settings.vibrationEnabled}
              onToggle={(value) => setSettings({ ...settings, vibrationEnabled: value })}
              disabled={!settings.enabled}
            />
          </View>

          {/* Reminder Timing */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Reminder Timing
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
              When would you like to be reminded?
            </Text>

            {REMINDER_DAY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.reminderDayOption,
                  { backgroundColor: theme.colors.surface },
                  !settings.enabled && { opacity: 0.5 }
                ]}
                onPress={() => !settings.enabled ? null : toggleReminderDay(option.value)}
                disabled={!settings.enabled}
              >
                <Text style={[styles.reminderDayLabel, { color: theme.colors.text }]}>
                  {option.label}
                </Text>
                <View style={[
                  styles.checkbox,
                  { borderColor: theme.colors.border },
                  settings.reminderDays.includes(option.value) && { 
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary 
                  }
                ]}>
                  {settings.reminderDays.includes(option.value) && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notification Time */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Daily Notification Time
            </Text>
            
            <TouchableOpacity
              style={[
                styles.timeSelector,
                { backgroundColor: theme.colors.surface },
                !settings.enabled && { opacity: 0.5 }
              ]}
              onPress={() => {
                if (!settings.enabled) return;
                setShowTimePicker(true);
              }}
              disabled={!settings.enabled}
            >
              <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.timeText, { color: theme.colors.text }]}>
                {formatTime(settings.timeOfDay)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Quiet Hours
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
              Don't send notifications during these hours
            </Text>
            
            <View style={styles.quietHoursContainer}>
              <TouchableOpacity
                style={[
                  styles.timeSelector,
                  styles.quietTimeSelector,
                  { backgroundColor: theme.colors.surface },
                  !settings.enabled && { opacity: 0.5 }
                ]}
                onPress={() => {
                  if (!settings.enabled) return;
                  setShowQuietStartPicker(true);
                }}
                disabled={!settings.enabled}
              >
                <Text style={[styles.quietLabel, { color: theme.colors.textSecondary }]}>
                  Start
                </Text>
                <Text style={[styles.timeText, { color: theme.colors.text }]}>
                  {settings.quietHoursStart ? formatTime(settings.quietHoursStart) : 'Not set'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeSelector,
                  styles.quietTimeSelector,
                  { backgroundColor: theme.colors.surface },
                  !settings.enabled && { opacity: 0.5 }
                ]}
                onPress={() => {
                  if (!settings.enabled) return;
                  setShowQuietEndPicker(true);
                }}
                disabled={!settings.enabled}
              >
                <Text style={[styles.quietLabel, { color: theme.colors.textSecondary }]}>
                  End
                </Text>
                <Text style={[styles.timeText, { color: theme.colors.text }]}>
                  {settings.quietHoursEnd ? formatTime(settings.quietHoursEnd) : 'Not set'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Test Notification */}
          <View style={styles.section}>
            <Button
              title="Send Test Notification"
              onPress={handleTestNotification}
              variant="outline"
              style={styles.testButton}
              disabled={!settings.enabled}
            />
          </View>

          {/* Info */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Notifications help you stay on top of your bills and avoid late fees. 
              You can always change these settings later.
            </Text>
          </View>
        </ScrollView>

        {/* Time Pickers */}
        <DateTimePicker
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onDateSelect={(date) => handleTimeSelect(date, 'main')}
          initialDate={createTimeFromString(settings.timeOfDay)}
          mode="time"
          title="Daily Notification Time"
        />

        <DateTimePicker
          visible={showQuietStartPicker}
          onClose={() => setShowQuietStartPicker(false)}
          onDateSelect={(date) => handleTimeSelect(date, 'quietStart')}
          initialDate={settings.quietHoursStart ? createTimeFromString(settings.quietHoursStart) : new Date()}
          mode="time"
          title="Quiet Hours Start"
        />

        <DateTimePicker
          visible={showQuietEndPicker}
          onClose={() => setShowQuietEndPicker(false)}
          onDateSelect={(date) => handleTimeSelect(date, 'quietEnd')}
          initialDate={settings.quietHoursEnd ? createTimeFromString(settings.quietHoursEnd) : new Date()}
          mode="time"
          title="Quiet Hours End"
        />
      </SafeAreaView>
    </Modal>
  );
}

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
    borderBottomColor: '#E5E7EB',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  reminderDayOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reminderDayLabel: {
    fontSize: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  timeText: {
    flex: 1,
    fontSize: 16,
  },
  quietHoursContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  quietTimeSelector: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  quietLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testButton: {
    marginTop: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});