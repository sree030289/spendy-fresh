import { useState } from 'react';
import { robustOCRService, OCRConfig } from './RobustOCRService';
import { enhancedReceiptParser } from './EnhancedReceiptParser';
import { ParsedReceiptData } from './receiptParser';

export interface ScanResult {
  success: boolean;
  data?: ParsedReceiptData;
  error?: string;
  ocrMethod?: string;
  processingTime?: number;
}

export const useRobustReceiptScanner = (config?: Partial<OCRConfig>) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const scanReceipt = async (imageUri: string): Promise<ScanResult> => {
    const startTime = Date.now();
    setIsProcessing(true);
    setError(null);
    setProgress('Starting receipt scan...');
    
    try {
      console.log('🚀 Starting robust receipt scanning for:', imageUri);
      
      // Step 1: OCR Processing
      setProgress('Processing image with OCR...');
      const ocrResult = await robustOCRService.processImage(imageUri);
      
      console.log('📊 OCR completed:', {
        method: ocrResult.method,
        confidence: ocrResult.confidence,
        textLength: ocrResult.text.length
      });
      
      // Step 2: Parse Receipt Data
      setProgress('Extracting receipt data...');
      const parsedData = await enhancedReceiptParser.parseReceipt(
        ocrResult.text, 
        ocrResult.confidence
      );
      
      // Step 3: Validate and enhance results
      setProgress('Validating extracted data...');
      const enhancedData = await enhanceExtractedData(parsedData);
      
      const processingTime = Date.now() - startTime;
      
      console.log('✅ Receipt scanning completed successfully:', {
        processingTime: `${processingTime}ms`,
        method: ocrResult.method,
        confidence: enhancedData.confidence,
        extractedFields: getExtractedFields(enhancedData)
      });
      
      setProgress('Scan completed successfully!');
      
      return {
        success: true,
        data: enhancedData,
        ocrMethod: ocrResult.method,
        processingTime
      };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown scanning error';
      const processingTime = Date.now() - startTime;
      
      console.error('❌ Receipt scanning failed:', {
        error: errorMessage,
        processingTime: `${processingTime}ms`,
        imageUri
      });
      
      setError(errorMessage);
      setProgress('Scan failed');
      
      // Return partial success with fallback data for manual entry
      return {
        success: false,
        error: errorMessage,
        data: createFallbackData(errorMessage),
        processingTime
      };
      
    } finally {
      setIsProcessing(false);
    }
  };

  const getExtractedFields = (data: ParsedReceiptData): string[] => {
    const fields: string[] = [];
    if (data.merchant) fields.push('Merchant');
    if (data.total) fields.push('Total');
    if (data.date) fields.push('Date');
    if (data.items && data.items.length > 0) fields.push(`${data.items.length} Items`);
    if (data.tax) fields.push('Tax');
    if (data.subtotal) fields.push('Subtotal');
    if (data.paymentMethod) fields.push('Payment Method');
    if (data.category) fields.push('Category');
    return fields;
  };

  const enhanceExtractedData = async (data: ParsedReceiptData): Promise<ParsedReceiptData> => {
    // Apply business logic and corrections
    const enhanced = { ...data };
    
    // Auto-fill today's date if no date found
    if (!enhanced.date) {
      enhanced.date = new Date().toISOString().split('T')[0];
    }
    
    // Ensure category is set
    if (!enhanced.category || enhanced.category === 'other') {
      enhanced.category = inferCategoryFromContext(enhanced);
    }
    
    // Calculate missing values
    if (enhanced.total && enhanced.tax && !enhanced.subtotal) {
      enhanced.subtotal = Math.max(0, enhanced.total - enhanced.tax);
    }
    
    // Boost confidence if we have key data
    let confidenceBoost = 0;
    if (enhanced.merchant) confidenceBoost += 0.1;
    if (enhanced.total && enhanced.total > 0) confidenceBoost += 0.2;
    if (enhanced.date) confidenceBoost += 0.1;
    if (enhanced.items && enhanced.items.length > 0) confidenceBoost += 0.15;
    
    enhanced.confidence = Math.min(0.95, (enhanced.confidence || 0) + confidenceBoost);
    
    return enhanced;
  };

  const inferCategoryFromContext = (data: ParsedReceiptData): string => {
    // Use time of day and amount to infer category
    const amount = data.total || 0;
    const now = new Date();
    const hour = now.getHours();
    
    // Meal times
    if ((hour >= 6 && hour <= 10) && amount < 20) return 'food'; // Breakfast
    if ((hour >= 11 && hour <= 14) && amount < 50) return 'food'; // Lunch
    if ((hour >= 17 && hour <= 22) && amount < 100) return 'food'; // Dinner
    
    // Amount-based inference
    if (amount > 40 && amount < 200) return 'shopping';
    if (amount > 20 && amount < 80) return 'food';
    if (amount < 10) return 'food';
    
    return 'other';
  };

  const createFallbackData = (error: string): ParsedReceiptData => {
    return {
      confidence: 0.1,
      category: 'other',
      date: new Date().toISOString().split('T')[0],
      // Add error context for user
      merchant: `Scan failed: ${error.substring(0, 50)}...`
    };
  };

  const retryWithDifferentSettings = async (imageUri: string): Promise<ScanResult> => {
    console.log('🔄 Retrying scan with different settings...');
    
    // Try with more aggressive preprocessing
    const retryConfig: Partial<OCRConfig> = {
      enablePreprocessing: true,
      maxImageSize: 600 * 1024, // Smaller file size
      maxImageWidth: 1000,      // Lower resolution
      imageQuality: 0.9,        // Higher quality
      confidenceThreshold: 0.3, // Lower threshold
      enableMultipleEngines: true,
      timeoutMs: 45000 // Longer timeout
    };
    
    const robustOCRServiceRetry = new (await import('./RobustOCRService')).RobustOCRService(retryConfig);
    
    const startTime = Date.now();
    setProgress('Retrying with enhanced settings...');
    
    try {
      const ocrResult = await robustOCRServiceRetry.processImage(imageUri);
      const parsedData = await enhancedReceiptParser.parseReceipt(
        ocrResult.text, 
        ocrResult.confidence
      );
      
      const enhancedData = await enhanceExtractedData(parsedData);
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: enhancedData,
        ocrMethod: `${ocrResult.method} (Retry)`,
        processingTime
      };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Retry failed';
      return {
        success: false,
        error: errorMessage,
        data: createFallbackData(errorMessage),
        processingTime: Date.now() - startTime
      };
    }
  };

  const getServiceStatus = () => {
    return robustOCRService.getServiceStatus();
  };

  const clearError = () => {
    setError(null);
    setProgress('');
  };

  return {
    scanReceipt,
    retryWithDifferentSettings,
    getServiceStatus,
    clearError,
    isProcessing,
    error,
    progress
  };
};