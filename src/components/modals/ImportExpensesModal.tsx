// src/components/modals/ImportExpensesModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import FullscreenModal from '@/components/common/FullscreenModal';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { Friend, SplittingService } from '@/services/firebase/splitting';
import { CSVImportService, ImportResult } from '@/services/import/CSVImportService';

interface ImportExpensesModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupMembers: Array<{ id: string; name: string; email: string }>;
}

export default function ImportExpensesModal({ 
  visible, 
  onClose, 
  groupId,
  groupMembers 
}: ImportExpensesModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [processingStep, setProcessingStep] = useState<'idle' | 'picking' | 'parsing' | 'importing'>('idle');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<string | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setFileSelected(false);
      setFileName('');
      setImportResult(null);
      setProcessingStep('idle');
      setFileUri(null);
      setCsvData(null);
    }
  }, [visible]);

  const handleSelectFile = async () => {
    try {
      setProcessingStep('picking');
      
      const result = await CSVImportService.pickCSVFile();
      if (!result) {
        setProcessingStep('idle');
        return;
      }
      
      setFileUri(result.uri);
      setFileName(result.name);
      setFileSelected(true);
      setProcessingStep('idle');
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'Failed to select CSV file. Please try again.');
      setProcessingStep('idle');
    }
  };

  const handleImport = async () => {
    if (!fileUri || !user) return;
    
    try {
      setLoading(true);
      setProcessingStep('parsing');
      
      // Read the CSV file
      const csvContent = await CSVImportService.readCSVFile(fileUri);
      setCsvData(csvContent);
      
      // Parse the CSV data
      const parsedData = CSVImportService.parseCSVData(csvContent);
      
      setProcessingStep('importing');
      
      // Category mapping
      const categoryMapping: Record<string, string> = {
        'groceries': 'Groceries',
        'grocery': 'Groceries',
        'food': 'Food & Dining',
        'dining': 'Food & Dining',
        'restaurant': 'Food & Dining',
        'transport': 'Transportation',
        'transportation': 'Transportation',
        'entertainment': 'Entertainment',
        'utilities': 'Utilities',
        'utility': 'Utilities',
        'rent': 'Rent',
        'travel': 'Travel',
        'shopping': 'Shopping',
        'general': 'General'
      };
      
      // Import expenses
      const result = await CSVImportService.importExpensesToGroup(
        user.id,
        groupId,
        parsedData,
        categoryMapping,
        groupMembers
      );
      
      setImportResult(result);
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Failed to import expenses. Please check the CSV format and try again.');
    } finally {
      setLoading(false);
      setProcessingStep('idle');
    }
  };

  const renderFileSelection = () => (
    <View style={[styles.section, { borderColor: theme.colors.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Select CSV File
      </Text>
      
      {!fileSelected ? (
        <TouchableOpacity
          style={[styles.uploadButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          onPress={handleSelectFile}
          disabled={loading}
        >
          <Ionicons name="document-outline" size={32} color={theme.colors.primary} />
          <Text style={[styles.uploadText, { color: theme.colors.text }]}>
            Tap to select a CSV file
          </Text>
          <Text style={[styles.uploadSubtext, { color: theme.colors.textSecondary }]}>
            CSV should have columns for Date, Description, Category, Cost, Currency
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.selectedFile, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.fileInfo}>
            <Ionicons name="document-text-outline" size={24} color={theme.colors.primary} />
            <View style={styles.fileDetails}>
              <Text style={[styles.fileName, { color: theme.colors.text }]} numberOfLines={1}>
                {fileName}
              </Text>
              <Text style={[styles.fileStatus, { color: theme.colors.success }]}>
                Ready to import
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSelectFile} disabled={loading}>
            <Text style={[styles.changeButton, { color: theme.colors.primary }]}>Change</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          The CSV file should have names or phone numbers in columns that match group members.
        </Text>
      </View>
    </View>
  );

  const renderImportResult = () => {
    if (!importResult) return null;
    
    return (
      <View style={[styles.resultContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
          Import Complete
        </Text>
        
        <View style={styles.resultStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.success }]}>
              {importResult.imported}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Imported
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.warning }]}>
              {importResult.skipped}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Skipped
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.error }]}>
              {importResult.errors}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Errors
            </Text>
          </View>
        </View>
        
        {importResult.errors > 0 && (
          <View style={styles.errorDetails}>
            <Text style={[styles.errorTitle, { color: theme.colors.error }]}>
              Error Details:
            </Text>
            <ScrollView style={styles.errorsList} nestedScrollEnabled>
              {importResult.details
                .filter(detail => detail.status === 'error')
                .map((error, index) => (
                  <Text key={index} style={[styles.errorItem, { color: theme.colors.error }]}>
                    • Row {error.row}: {error.message}
                  </Text>
                ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderLoadingState = () => {
    if (!loading) return null;
    
    let message = 'Processing...';
    
    switch (processingStep) {
      case 'picking':
        message = 'Selecting file...';
        break;
      case 'parsing':
        message = 'Parsing CSV data...';
        break;
      case 'importing':
        message = 'Importing expenses...';
        break;
    }
    
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          {message}
        </Text>
      </View>
    );
  };

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
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Import Expenses
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {renderFileSelection()}
          {renderImportResult()}
          
          {/* Format Information */}
          <View style={[styles.section, { borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              CSV Format Example
            </Text>
            <View style={[styles.codeBox, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.codeText, { color: theme.colors.text }]}>
                Date,Description,Category,Cost,Currency,Person1,Person2,Person3{'\n'}
                2025-06-20,Groceries,Groceries,150.00,AUD,150.00,-75.00,-75.00{'\n'}
                2025-06-21,Dinner,Food,60.00,AUD,-20.00,60.00,-40.00
              </Text>
            </View>
            <Text style={[styles.formatHint, { color: theme.colors.textSecondary }]}>
              • Positive values: who paid{'\n'}
              • Negative values: what they owe{'\n'}
              • Names/emails must match group members
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Button
            title={importResult ? 'Close' : 'Cancel'}
            onPress={onClose}
            variant="outline"
            style={importResult ? styles.fullButton : styles.footerButton}
            disabled={loading}
          />
          {!importResult && (
            <Button
              title="Import"
              onPress={handleImport}
              style={styles.footerButton}
              disabled={!fileSelected || loading}
              loading={loading}
            />
          )}
        </View>

        {renderLoadingState()}
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
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
    borderBottomWidth: 1,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  uploadButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  selectedFile: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '500',
  },
  fileStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  changeButton: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  codeBox: {
    borderRadius: 8,
    padding: 16,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'Courier',
  },
  formatHint: {
    fontSize: 14,
    marginTop: 16,
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    padding: 20,
    flexDirection: 'row',
  },
  footerButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  fullButton: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  resultContainer: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  resultStats: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  errorDetails: {
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  errorsList: {
    maxHeight: 100,
  },
  errorItem: {
    fontSize: 14,
    marginBottom: 4,
  },
});
