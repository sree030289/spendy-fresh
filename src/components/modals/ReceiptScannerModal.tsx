// src/components/modals/ReceiptScannerModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';

interface ReceiptScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onReceiptProcessed: (receiptData: ReceiptData) => void;
}

interface ReceiptData {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  tax?: number;
  tip?: number;
  merchant?: string;
  date?: Date;
}

interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  selected: boolean;
}

export default function ReceiptScannerModal({ visible, onClose, onReceiptProcessed }: ReceiptScannerModalProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState<'capture' | 'processing' | 'review'>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [merchant, setMerchant] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [tip, setTip] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (visible) {
      resetScanner();
    }
  }, [visible]);

  const resetScanner = () => {
    setStep('capture');
    setImageUri(null);
    setReceiptItems([]);
    setMerchant('');
    setSubtotal(0);
    setTax(0);
    setTip(0);
    setTotal(0);
    setLoading(false);
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is needed to scan receipts',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library permission is needed to select receipt images',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      processReceipt(result.assets[0].uri);
    }
  };

  const handleSelectPhoto = async () => {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      processReceipt(result.assets[0].uri);
    }
  };

  const processReceipt = async (uri: string) => {
    setStep('processing');
    setLoading(true);

    try {
      // Simulate AI processing of receipt
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mock receipt data - in real implementation, this would come from OCR/AI service
      const mockReceiptData = {
        merchant: 'Restaurant ABC',
        items: [
          { id: '1', name: 'Chicken Burger', quantity: 2, price: 15.99, selected: true },
          { id: '2', name: 'Caesar Salad', quantity: 1, price: 12.50, selected: true },
          { id: '3', name: 'Soft Drink', quantity: 2, price: 4.50, selected: true },
          { id: '4', name: 'Fries', quantity: 1, price: 6.99, selected: true },
        ],
        subtotal: 39.98,
        tax: 3.20,
        tip: 8.00,
        total: 51.18
      };

      setMerchant(mockReceiptData.merchant);
      setReceiptItems(mockReceiptData.items);
      setSubtotal(mockReceiptData.subtotal);
      setTax(mockReceiptData.tax);
      setTip(mockReceiptData.tip);
      setTotal(mockReceiptData.total);
      setStep('review');

    } catch (error) {
      console.error('Receipt processing error:', error);
      Alert.alert('Error', 'Failed to process receipt. Please try again.');
      setStep('capture');
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setReceiptItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, selected: !item.selected }
        : item
    ));
    
    // Recalculate totals
    const updatedItems = receiptItems.map(item => 
      item.id === itemId 
        ? { ...item, selected: !item.selected }
        : item
    );
    
    const newSubtotal = updatedItems
      .filter(item => item.selected)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    setSubtotal(newSubtotal);
    setTotal(newSubtotal + tax + tip);
  };

  const updateItemPrice = (itemId: string, newPrice: number) => {
    setReceiptItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, price: newPrice }
        : item
    ));
    
    // Recalculate totals
    const newSubtotal = receiptItems
      .filter(item => item.selected)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    setSubtotal(newSubtotal);
    setTotal(newSubtotal + tax + tip);
  };

  const handleConfirmReceipt = () => {
    const selectedItems = receiptItems.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item from the receipt.');
      return;
    }

    const receiptData: ReceiptData = {
      items: selectedItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total: subtotal, // Use only selected items total
      tax: tax,
      tip: tip,
      merchant: merchant,
      date: new Date()
    };

    onReceiptProcessed(receiptData);
    onClose();
  };

  const renderCaptureStep = () => (
    <View style={styles.captureContainer}>
      <View style={styles.captureHeader}>
        <Ionicons name="camera" size={64} color={theme.colors.primary} />
        <Text style={[styles.captureTitle, { color: theme.colors.text }]}>
          Scan Receipt
        </Text>
        <Text style={[styles.captureDescription, { color: theme.colors.textSecondary }]}>
          Take a photo of your receipt or select one from your gallery
        </Text>
      </View>

      <View style={styles.captureButtons}>
        <TouchableOpacity
          style={[styles.captureButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleTakePhoto}
        >
          <Ionicons name="camera" size={24} color="white" />
          <Text style={styles.captureButtonText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, { backgroundColor: theme.colors.secondary }]}
          onPress={handleSelectPhoto}
        >
          <Ionicons name="images" size={24} color="white" />
          <Text style={styles.captureButtonText}>From Gallery</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.aiFeatureCard, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="sparkles" size={24} color={theme.colors.primary} />
        <View style={styles.aiFeatureContent}>
          <Text style={[styles.aiFeatureTitle, { color: theme.colors.text }]}>
            AI-Powered Processing
          </Text>
          <Text style={[styles.aiFeatureDescription, { color: theme.colors.textSecondary }]}>
            Automatically extract items, prices, and totals from your receipt
          </Text>
        </View>
      </View>
    </View>
  );

  const renderProcessingStep = () => (
    <View style={styles.processingContainer}>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.receiptImage} />
      )}
      
      <View style={styles.processingContent}>
        <View style={styles.processingSpinner}>
          <Ionicons name="hourglass" size={48} color={theme.colors.primary} />
        </View>
        <Text style={[styles.processingTitle, { color: theme.colors.text }]}>
          Processing Receipt...
        </Text>
        <Text style={[styles.processingDescription, { color: theme.colors.textSecondary }]}>
          Our AI is reading your receipt and extracting the details
        </Text>
        
        <View style={styles.processingSteps}>
          <View style={styles.processingStep}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            <Text style={[styles.processingStepText, { color: theme.colors.textSecondary }]}>
              Image uploaded
            </Text>
          </View>
          <View style={styles.processingStep}>
            <Ionicons name="time" size={20} color={theme.colors.primary} />
            <Text style={[styles.processingStepText, { color: theme.colors.textSecondary }]}>
              Extracting text...
            </Text>
          </View>
          <View style={styles.processingStep}>
            <Ionicons name="ellipse-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.processingStepText, { color: theme.colors.textSecondary }]}>
              Identifying items...
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView contentContainerStyle={styles.reviewContainer}>
      {imageUri && (
        <View style={styles.receiptPreview}>
          <Image source={{ uri: imageUri }} style={styles.receiptThumbnail} />
          <View style={styles.receiptInfo}>
            <Text style={[styles.merchantName, { color: theme.colors.text }]}>
              {merchant}
            </Text>
            <Text style={[styles.receiptDate, { color: theme.colors.textSecondary }]}>
              {new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.itemsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Receipt Items ({receiptItems.filter(item => item.selected).length} selected)
        </Text>
        
        {receiptItems.map((item) => (
          <View key={item.id} style={[styles.receiptItem, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity
              style={styles.itemCheckbox}
              onPress={() => toggleItemSelection(item.id)}
            >
              <View style={[
                styles.checkbox,
                item.selected && [styles.checkedBox, { backgroundColor: theme.colors.primary }]
              ]}>
                {item.selected && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
            </TouchableOpacity>
            
            <View style={styles.itemDetails}>
              <Text style={[styles.itemName, { color: theme.colors.text }]}>
                {item.name}
              </Text>
              <Text style={[styles.itemQuantity, { color: theme.colors.textSecondary }]}>
                Qty: {item.quantity}
              </Text>
            </View>
            
            <View style={styles.itemPrice}>
              <TextInput
                style={[styles.priceInput, { color: theme.colors.text }]}
                value={item.price.toFixed(2)}
                onChangeText={(text) => {
                  const newPrice = parseFloat(text) || 0;
                  updateItemPrice(item.id, newPrice);
                }}
                keyboardType="decimal-pad"
                editable={item.selected}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.totalsSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Totals</Text>
        
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.totalValue, { color: theme.colors.text }]}>
            ${subtotal.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Tax</Text>
          <TextInput
            style={[styles.totalInput, { color: theme.colors.text }]}
            value={tax.toFixed(2)}
            onChangeText={(text) => {
              const newTax = parseFloat(text) || 0;
              setTax(newTax);
              setTotal(subtotal + newTax + tip);
            }}
            keyboardType="decimal-pad"
          />
        </View>
        
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Tip</Text>
          <TextInput
            style={[styles.totalInput, { color: theme.colors.text }]}
            value={tip.toFixed(2)}
            onChangeText={(text) => {
              const newTip = parseFloat(text) || 0;
              setTip(newTip);
              setTotal(subtotal + tax + newTip);
            }}
            keyboardType="decimal-pad"
          />
        </View>
        
        <View style={styles.totalDivider} />
        
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabelFinal, { color: theme.colors.text }]}>Total</Text>
          <Text style={[styles.totalValueFinal, { color: theme.colors.text }]}>
            ${total.toFixed(2)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {step === 'capture' ? 'Scan Receipt' : step === 'processing' ? 'Processing...' : 'Review Receipt'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {step === 'capture' && renderCaptureStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'review' && renderReviewStep()}
        </View>

        {/* Footer */}
        {step === 'review' && (
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Button
              title="Use This Receipt"
              onPress={handleConfirmReceipt}
              style={styles.confirmButton}
            />
          </View>
        )}
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
    flex: 1,
  },
  captureContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  captureHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  captureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  captureDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  captureButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  captureButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  aiFeatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 16,
    maxWidth: 320,
  },
  aiFeatureContent: {
    flex: 1,
  },
  aiFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  aiFeatureDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  receiptImage: {
    width: 200,
    height: 250,
    borderRadius: 12,
    marginBottom: 32,
  },
  processingContent: {
    alignItems: 'center',
  },
  processingSpinner: {
    marginBottom: 20,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  processingDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  processingSteps: {
    gap: 12,
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  processingStepText: {
    fontSize: 14,
  },
  reviewContainer: {
    flexGrow: 1,
    padding: 20,
  },
  receiptPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  receiptThumbnail: {
    width: 60,
    height: 80,
    borderRadius: 8,
  },
  receiptInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  receiptDate: {
    fontSize: 14,
  },
  itemsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  receiptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemCheckbox: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    borderColor: 'transparent',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
  },
  itemPrice: {
    minWidth: 80,
  },
  priceInput: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  totalsSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  totalInput: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minWidth: 80,
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValueFinal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    borderTopWidth: 1,
    padding: 20,
  },
  confirmButton: {
    width: '100%',
  },
});