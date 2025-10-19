// src/components/modals/ExportModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import FullscreenModal from '@/components/common/FullscreenModal';
import { Group } from '@/services/firebase/splitting-disabled';
import { SubscriptionService } from '@/services/SubscriptionService';

// Helper function to get active member count
const getActiveMemberCount = (members: any[]): number => {
  if (!members || !Array.isArray(members)) return 0;
  return members.filter(member => member.isActive !== false).length;
};

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  group: Group | null;
  currentUserId: string;
  onExportComplete: (format: 'csv' | 'pdf') => Promise<void>;
}

export default function ExportModal({
  visible,
  onClose,
  group,
  currentUserId,
  onExportComplete,
}: ExportModalProps) {
  const { theme } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf'>('csv');

  if (!group) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Check if user has premium subscription
      const subscriptionService = SubscriptionService.getInstance();
      const isPremium = await subscriptionService.isPremiumUser(currentUserId);

      if (!isPremium) {
        // Show subscription modal for export feature
        setIsExporting(false);
        onClose();
        
        if ((global as any).showSubscriptionModal) {
          // Show subscription modal with canClose = true to allow users to go back
          (global as any).showSubscriptionModal('premium_feature', 'Group Export', true);
        } else {
          Alert.alert(
            'Premium Feature',
            'Group export is available for premium users only. Upgrade to access this feature.',
            [{ text: 'OK' }]
          );
        }
        return;
      }

      // Proceed with export for premium users
      await onExportComplete(selectedFormat);
      
      Alert.alert(
        'Export Complete! 📄',
        `Group data has been exported as ${selectedFormat.toUpperCase()} file.`,
        [{ text: 'OK', onPress: onClose }]
      );

    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert(
        'Export Failed',
        error.message || 'Failed to export group data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      format: 'csv' as const,
      title: 'CSV File',
      subtitle: 'Spreadsheet format, works with Excel',
      icon: 'document-text',
      color: '#10B981',
    },
    {
      format: 'pdf' as const,
      title: 'PDF Report',
      subtitle: 'Formatted report with charts',
      icon: 'document',
      color: '#EF4444',
    },
  ];

  return (
    <FullscreenModal visible={visible} onClose={onClose} title="Export Group Data" showBackButton={false}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={theme.colors.text}  />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Export Group Data
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Group Info */}
          <View style={[styles.groupInfo, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.groupIcon, { backgroundColor: theme.colors.primary }]}>
              <Icon name="people" size={24} color="white"  />
            </View>
            <View style={styles.groupDetails}>
              <Text style={[styles.groupName, { color: theme.colors.text }]}>
                {group.name}
              </Text>
              <Text style={[styles.groupMeta, { color: theme.colors.textSecondary }]}>
                {getActiveMemberCount(group.members)} members • {group.currency}
              </Text>
            </View>
            <View style={[styles.premiumBadge, { backgroundColor: '#FFD700' }]}>
              <Icon name="star" size={16} color="#FFF"  />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          </View>

          {/* Export Options */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Choose Export Format
            </Text>
            
            {exportOptions.map((option) => (
              <TouchableOpacity
                key={option.format}
                style={[
                  styles.optionCard,
                  { 
                    backgroundColor: theme.colors.surface,
                    borderColor: selectedFormat === option.format ? option.color : theme.colors.border,
                    borderWidth: selectedFormat === option.format ? 2 : 1,
                  }
                ]}
                onPress={() => setSelectedFormat(option.format)}
                disabled={isExporting}
              >
                <View style={[styles.optionIcon, { backgroundColor: option.color }]}>
                  <Icon name={option.icon as any} size={24} color="white" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                    {option.title}
                  </Text>
                  <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                    {option.subtitle}
                  </Text>
                </View>
                {selectedFormat === option.format && (
                  <Icon name="success" size={24} color={option.color}  />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Export Contents Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              What's Included
            </Text>
            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
              {[
                'All expenses with details',
                'Member information',
                'Balance summaries',
                'Payment history',
                'Group statistics',
                selectedFormat === 'pdf' ? 'Charts and visualizations' : 'Data ready for analysis'
              ].map((item, index) => (
                <View key={index} style={styles.infoItem}>
                  <Icon name="success" size={16} color={theme.colors.success}  />
                  <Text style={[styles.infoText, { color: theme.colors.text }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>
          <Button
            title={isExporting ? 'Exporting...' : `Export as ${selectedFormat.toUpperCase()}`}
            onPress={handleExport}
            disabled={isExporting}
            style={[styles.exportButton, { backgroundColor: theme.colors.primary }]}
            icon={isExporting ? undefined : <Icon name="download" size={20} color={theme.colors.textInverse} />}
          />
          {isExporting && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Preparing export...
              </Text>
            </View>
          )}
        </View>
      </View>
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 14,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  premiumText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  exportButton: {
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
});