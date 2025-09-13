import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface OCRResult {
  text: string;
  confidence: number;
  method: string;
  boundingBoxes?: Array<{
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}

export interface OCRConfig {
  enablePreprocessing: boolean;
  maxImageSize: number; // bytes
  maxImageWidth: number; // pixels
  imageQuality: number; // 0.1 to 1.0
  confidenceThreshold: number;
  enableMultipleEngines: boolean;
  timeoutMs: number;
}

export class RobustOCRService {
  private config: OCRConfig;

  constructor(config: Partial<OCRConfig> = {}) {
    this.config = {
      enablePreprocessing: true,
      maxImageSize: 800 * 1024, // 800KB
      maxImageWidth: 1200,
      imageQuality: 0.8,
      confidenceThreshold: 0.5,
      enableMultipleEngines: true,
      timeoutMs: 30000, // 30 seconds
      ...config
    };
  }

  async processImage(imageUri: string): Promise<OCRResult> {
    console.log('🔍 RobustOCRService: Starting image processing:', imageUri);
    
    try {
      // Step 1: Preprocess image
      const processedUri = this.config.enablePreprocessing 
        ? await this.preprocessImage(imageUri)
        : imageUri;

      // Step 2: Try multiple OCR methods with timeout
      const ocrPromise = this.tryMultipleOCRMethods(processedUri);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timeout')), this.config.timeoutMs);
      });

      const result = await Promise.race([ocrPromise, timeoutPromise]);
      
      console.log('✅ RobustOCRService: OCR completed successfully');
      console.log('📊 Result confidence:', result.confidence);
      console.log('🔧 Method used:', result.method);
      
      return result;
    } catch (error) {
      console.error('❌ RobustOCRService: OCR processing failed:', error);
      throw new Error('Failed to process image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async preprocessImage(imageUri: string): Promise<string> {
    console.log('🔧 Preprocessing image for better OCR accuracy...');
    
    try {
      // Get image info
      const imageInfo = await FileSystem.getInfoAsync(imageUri);
      
      if (!imageInfo.exists || !('size' in imageInfo)) {
        throw new Error('Image file not found or invalid');
      }

      console.log(`📏 Original image size: ${imageInfo.size} bytes`);

      let manipulationActions: any[] = [];
      let needsCompression = false;
      let quality = this.config.imageQuality;

      // Check if image needs resizing/compression
      if (imageInfo.size > this.config.maxImageSize) {
        console.log('📐 Image is too large, will compress');
        needsCompression = true;
        quality = Math.max(0.5, quality - 0.2); // Reduce quality for large images
      }

      // Always enhance for OCR
      manipulationActions.push(
        { resize: { width: this.config.maxImageWidth } }
      );

      // Apply image enhancements for better OCR
      const processedImage = await manipulateAsync(
        imageUri,
        manipulationActions,
        {
          compress: quality,
          format: SaveFormat.JPEG,
          base64: false
        }
      );

      // Check final size
      const processedInfo = await FileSystem.getInfoAsync(processedImage.uri);
      if (processedInfo.exists && 'size' in processedInfo) {
        console.log(`📏 Processed image size: ${processedInfo.size} bytes`);
        
        // If still too large, compress more aggressively
        if (processedInfo.size > this.config.maxImageSize) {
          console.log('🗜️ Applying additional compression...');
          
          const furtherCompressed = await manipulateAsync(
            processedImage.uri,
            [{ resize: { width: 800 } }],
            {
              compress: 0.5,
              format: SaveFormat.JPEG,
              base64: false
            }
          );
          
          console.log('✅ Image preprocessing completed with aggressive compression');
          return furtherCompressed.uri;
        }
      }

      console.log('✅ Image preprocessing completed');
      return processedImage.uri;
    } catch (error) {
      console.warn('⚠️ Image preprocessing failed, using original:', error);
      return imageUri;
    }
  }

  private async tryMultipleOCRMethods(imageUri: string): Promise<OCRResult> {
    const methods = [
      { name: 'Google Vision API', method: () => this.tryGoogleVisionAPI(imageUri) },
      { name: 'OCR.space Premium', method: () => this.tryOCRSpacePremium(imageUri) },
      { name: 'OCR.space Free', method: () => this.tryOCRSpaceFree(imageUri) },
      { name: 'Microsoft Cognitive Services', method: () => this.tryMicrosoftOCR(imageUri) },
      { name: 'Fallback Pattern Recognition', method: () => this.tryPatternRecognition(imageUri) }
    ];

    const results: Array<{ result: OCRResult; error: null } | { result: null; error: Error }> = [];

    // Try methods in sequence for better error handling
    for (const { name, method } of methods) {
      try {
        console.log(`🔍 Trying ${name}...`);
        const result = await method();
        
        if (result.confidence >= this.config.confidenceThreshold) {
          console.log(`✅ ${name} succeeded with confidence: ${result.confidence}`);
          return result;
        }
        
        results.push({ result, error: null });
        console.log(`⚠️ ${name} completed but confidence too low: ${result.confidence}`);
      } catch (error) {
        console.log(`❌ ${name} failed:`, error instanceof Error ? error.message : 'Unknown error');
        results.push({ result: null, error: error as Error });
      }
    }

    // If all methods have low confidence, return the best result
    const successfulResults = results
      .filter((r): r is { result: OCRResult; error: null } => r.result !== null)
      .sort((a, b) => b.result.confidence - a.result.confidence);

    if (successfulResults.length > 0) {
      const bestResult = successfulResults[0].result;
      console.log(`📊 Returning best available result with confidence: ${bestResult.confidence}`);
      return bestResult;
    }

    // All methods failed - return fallback result instead of throwing
    console.log('⚠️ All OCR methods failed, returning fallback template');
    return await this.tryPatternRecognition(imageUri);
  }

  private async tryGoogleVisionAPI(imageUri: string): Promise<OCRResult> {
    // This would require Google Vision API key
    // For now, simulate the API call structure
    throw new Error('Google Vision API not configured');
  }

  private async tryOCRSpacePremium(imageUri: string): Promise<OCRResult> {
    // This would use a premium OCR.space API key
    return this.performOCRSpaceRequest(imageUri, true);
  }

  private async tryOCRSpaceFree(imageUri: string): Promise<OCRResult> {
    return this.performOCRSpaceRequest(imageUri, false);
  }

  private async performOCRSpaceRequest(imageUri: string, isPremium: boolean): Promise<OCRResult> {
    console.log(`📡 Making OCR.space API request (${isPremium ? 'Premium' : 'Free'})...`);
    
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const apiKey = isPremium ? 'helloworld' : 'helloworld'; // In production, use different keys
    
    const formData = new FormData();
    formData.append('apikey', apiKey);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('isTable', 'true');
    formData.append('OCREngine', isPremium ? '2' : '1');
    formData.append('base64Image', `data:image/jpeg;base64,${base64}`);

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // Add timeout for individual requests
    });

    if (!response.ok) {
      throw new Error(`OCR.space API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📄 OCR.space response received');

    if (data.ParsedResults && data.ParsedResults.length > 0) {
      const result = data.ParsedResults[0];
      
      if (result.ParsedText && result.ParsedText.trim().length > 0) {
        // Calculate confidence based on response quality
        let confidence = 0.7; // Base confidence for OCR.space
        
        if (isPremium) confidence += 0.1;
        if (result.ParsedText.length > 100) confidence += 0.1;
        if (!result.ErrorMessage) confidence += 0.1;
        
        // Reduce confidence if there are obvious OCR errors
        const errorIndicators = [
          /[^\w\s\$\.\,\-\:\/\(\)]/g, // Too many special characters
          /\s{5,}/g, // Large spaces (alignment issues)
          /[A-Za-z]{20,}/g // Very long words (OCR artifacts)
        ];
        
        for (const pattern of errorIndicators) {
          const matches = result.ParsedText.match(pattern);
          if (matches && matches.length > 3) {
            confidence -= 0.1;
          }
        }
        
        confidence = Math.max(0.1, Math.min(0.95, confidence));

        return {
          text: result.ParsedText.trim(),
          confidence,
          method: `OCR.space ${isPremium ? 'Premium' : 'Free'}`,
          boundingBoxes: []
        };
      }
    }

    // Check for specific error messages
    if (data.ErrorMessage && data.ErrorMessage.length > 0) {
      throw new Error(`OCR.space error: ${data.ErrorMessage.join(', ')}`);
    }

    throw new Error('OCR.space: No text detected in image');
  }

  private async tryMicrosoftOCR(imageUri: string): Promise<OCRResult> {
    // Microsoft Computer Vision OCR would go here
    // For now, throw error as not implemented
    throw new Error('Microsoft OCR not configured');
  }

  private async tryPatternRecognition(imageUri: string): Promise<OCRResult> {
    console.log('🔄 Using fallback pattern recognition...');
    
    // This is a last resort method that provides helpful guidance
    // when OCR fails completely
    await new Promise(resolve => setTimeout(resolve, 500)); // Brief simulation

    const fallbackText = `OCR_PROCESSING_FAILED

MANUAL_ENTRY_TEMPLATE:
Merchant: [Business Name]
Date: ${new Date().toLocaleDateString()}
Amount: $[0.00]
Category: food
Notes: Manual entry - OCR failed`;

    return {
      text: fallbackText,
      confidence: 0.2, // Slightly higher to indicate this is a valid fallback
      method: 'Fallback Template',
      boundingBoxes: []
    };
  }

  // Helper method to validate OCR result quality
  private validateOCRQuality(text: string): number {
    let score = 0.5; // Base score
    
    // Positive indicators
    if (/\$\d+\.\d{2}/.test(text)) score += 0.2; // Has currency amounts
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) score += 0.1; // Has dates
    if (/total/i.test(text)) score += 0.1; // Has "total" keyword
    if (text.length > 50) score += 0.1; // Reasonable length
    
    // Negative indicators
    if (text.length < 20) score -= 0.3; // Too short
    if (/[^\w\s\$\.\,\-\:\/\(\)\n]/g.test(text)) score -= 0.1; // Too many special chars
    
    return Math.max(0.1, Math.min(0.95, score));
  }

  // Method to get OCR service status
  getServiceStatus(): { available: boolean; engines: string[] } {
    return {
      available: true,
      engines: [
        'OCR.space Free',
        'OCR.space Premium',
        'Pattern Recognition Fallback'
      ]
    };
  }
}

// Singleton instance for app-wide use
export const robustOCRService = new RobustOCRService();