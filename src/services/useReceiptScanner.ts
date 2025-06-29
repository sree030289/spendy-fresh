import { useState } from 'react';
import { AdvancedOCRService, OCRConfig } from '../services/ocrService';
import { AdvancedReceiptParser, ParsedReceiptData } from '../services/receiptParser';

export const useReceiptScanner = (config?: Partial<OCRConfig>) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const ocrService = new AdvancedOCRService(config);
  const parser = new AdvancedReceiptParser();

  const scanReceipt = async (imageUri: string): Promise<ParsedReceiptData> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Step 1: OCR
      const ocrResult = await ocrService.processImage(imageUri);
      
      // Step 2: Parse
      const parsedData = await parser.parseReceipt(ocrResult.text, ocrResult.confidence);
      
      return parsedData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    scanReceipt,
    isProcessing,
    error
  };
};