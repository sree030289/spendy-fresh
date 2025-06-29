import * as FileSystem from 'expo-file-system';
// import TextRecognition from '@react-native-ml-kit/text-recognition';
// import TesseractOcr from 'react-native-tesseract-ocr';

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBoxes?: Array<{
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}

export interface OCRConfig {
  useMLKit: boolean;
  useTesseract: boolean;
  useCloudVision: boolean;
  language: string;
  confidenceThreshold: number;
  enablePreprocessing: boolean;
}

export class AdvancedOCRService {
  private config: OCRConfig;

  constructor(config: Partial<OCRConfig> = {}) {
    this.config = {
      useMLKit: true,
      useTesseract: false,
      useCloudVision: true,
      language: 'en',
      confidenceThreshold: 0.7,
      enablePreprocessing: true,
      ...config
    };
  }

  async processImage(imageUri: string): Promise<OCRResult> {
    try {
      // Step 1: Preprocess image if enabled
      const processedUri = this.config.enablePreprocessing 
        ? await this.preprocessImage(imageUri)
        : imageUri;

      // Step 2: Try multiple OCR methods
      const results = await Promise.allSettled([
        this.config.useMLKit ? this.runMLKitOCR(processedUri) : Promise.reject('ML Kit disabled'),
        this.config.useTesseract ? this.runTesseractOCR(processedUri) : Promise.reject('Tesseract disabled'),
        this.config.useCloudVision ? this.runCloudVisionOCR(processedUri) : Promise.reject('Cloud Vision disabled')
      ]);

      // Step 3: Select best result
      return this.selectBestResult(results);
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error('Failed to process image with OCR');
    }
  }

  private async preprocessImage(imageUri: string): Promise<string> {
    try {
      // This would implement image preprocessing techniques:
      // - Contrast enhancement
      // - Noise reduction
      // - Perspective correction
      // - Binarization
      
      // For now, return original URI
      // In production, use react-native-image-resizer or similar
      return imageUri;
    } catch (error) {
      console.warn('Image preprocessing failed, using original:', error);
      return imageUri;
    }
  }

  private async runMLKitOCR(imageUri: string): Promise<OCRResult> {
    /*
    try {
      const result = await TextRecognition.recognize(imageUri);
      return {
        text: result.text,
        confidence: this.estimateMLKitConfidence(result),
        boundingBoxes: result.blocks?.map(block => ({
          text: block.text,
          bounds: block.frame
        }))
      };
    } catch (error) {
      throw new Error('ML Kit OCR failed');
    }
    */
    
    // Mock result for demo
    return {
      text: "Sample ML Kit OCR result",
      confidence: 0.9,
      boundingBoxes: []
    };
  }

  private async runTesseractOCR(imageUri: string): Promise<OCRResult> {
    /*
    try {
      const result = await TesseractOcr.recognize(imageUri, this.config.language, {
        whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,:/- \n',
        blacklist: '',
        psm: '6' // Uniform block of text
      });
      
      return {
        text: result.text,
        confidence: result.confidence / 100
      };
    } catch (error) {
      throw new Error('Tesseract OCR failed');
    }
    */
    
    // Mock result for demo
    return {
      text: "Sample Tesseract OCR result",
      confidence: 0.85
    };
  }

  private async runCloudVisionOCR(imageUri: string): Promise<OCRResult> {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64 },
              features: [
                { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
              ],
              imageContext: {
                languageHints: [this.config.language]
              }
            }]
          })
        }
      );

      const data = await response.json();
      
      if (data.responses?.[0]?.fullTextAnnotation) {
        return {
          text: data.responses[0].fullTextAnnotation.text,
          confidence: 0.95,
          boundingBoxes: data.responses[0].textAnnotations?.slice(1).map((annotation: any) => ({
            text: annotation.description,
            bounds: this.convertGoogleBounds(annotation.boundingPoly)
          }))
        };
      }
      
      throw new Error('No text detected by Cloud Vision');
    } catch (error) {
      throw new Error('Cloud Vision OCR failed');
    }
  }

  private selectBestResult(results: PromiseSettledResult<OCRResult>[]): OCRResult {
    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<OCRResult> => 
        result.status === 'fulfilled')
      .map(result => result.value)
      .filter(result => result.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence);

    if (successfulResults.length === 0) {
      throw new Error('No OCR method produced satisfactory results');
    }

    return successfulResults[0];
  }

  private estimateMLKitConfidence(result: any): number {
    // ML Kit doesn't provide confidence scores, so estimate based on:
    // - Text length
    // - Number of recognized blocks
    // - Presence of common receipt patterns
    
    const textLength = result.text?.length || 0;
    const blockCount = result.blocks?.length || 0;
    
    let confidence = 0.7; // Base confidence
    
    if (textLength > 50) confidence += 0.1;
    if (blockCount > 5) confidence += 0.1;
    if (/\$\d+\.\d{2}/.test(result.text)) confidence += 0.1; // Has price patterns
    
    return Math.min(confidence, 0.95);
  }

  private convertGoogleBounds(boundingPoly: any): { x: number; y: number; width: number; height: number } {
    const vertices = boundingPoly.vertices;
    const xs = vertices.map((v: any) => v.x || 0);
    const ys = vertices.map((v: any) => v.y || 0);
    
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }
}