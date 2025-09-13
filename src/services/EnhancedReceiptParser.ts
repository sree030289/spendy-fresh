import { ParsedReceiptData } from './receiptParser';

export class EnhancedReceiptParser {
  private merchantPatterns = [
    /^([A-Z][A-Z\s&'.-]{2,})(?:\s*STORE|\s*LOCATION|\s*#\d+)?$/m,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/m,
    /^(.{3,30}?)\s+STORE\s*#?\d*/im,
    /^(.{3,30}?)\s+(?:RESTAURANT|CAFE|MARKET|SUPERMARKET)/im,
    /^\*{0,5}([A-Z][A-Za-z\s&'.-]{2,20})\*{0,5}$/m
  ];

  private totalPatterns = [
    /(?:^|\s)(?:TOTAL|AMOUNT\s+DUE|BALANCE\s+DUE|GRAND\s+TOTAL)[:\s]*\$?(\d+\.?\d{0,2})/im,
    /(?:^|\s)TOTAL[:\s]*\$?(\d+\.\d{2})(?:\s|$)/im,
    /(?:^|\s)\$(\d+\.\d{2})\s*TOTAL/im,
    /(?:^|\s)\$(\d+\.\d{2})(?:\s*$)/m,
    // More flexible patterns for poor OCR
    /(?:^|\s)T[O0][T7][A4@][L1][:\s]*\$?(\d+\.?\d{0,2})/im,
    /(?:^|\s)[T7][O0][T7][A4@][L1][:\s]*(\d+\.\d{2})/im
  ];

  private datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{1,2}-\d{1,2}-\d{2,4})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /(\d{1,2}\.\d{1,2}\.\d{2,4})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}/i,
    // Handle OCR mistakes in dates
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g
  ];

  private timePatterns = [
    /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i,
    /TIME[:\s]*(\d{1,2}:\d{2}(?::\d{2})?)/i,
    /(\d{1,2}:\d{2})\s*(?:AM|PM)/i
  ];

  private taxPatterns = [
    /(?:^|\s)(?:TAX|HST|GST|PST|VAT|SALES\s+TAX)[:\s]*\$?(\d+\.?\d{0,2})/im,
    /(?:^|\s)TAX[:\s]*(\d+\.\d{2})/im,
    // OCR error patterns
    /(?:^|\s)[T7][A4@][X][:\s]*\$?(\d+\.?\d{0,2})/im
  ];

  private subtotalPatterns = [
    /(?:^|\s)(?:SUBTOTAL|SUB\s*TOTAL|SUB-TOTAL)[:\s]*\$?(\d+\.?\d{0,2})/im,
    /(?:^|\s)SUBTOTAL[:\s]*(\d+\.\d{2})/im
  ];

  // Enhanced category keywords with more variations
  private categoryKeywords = {
    food: [
      'walmart', 'safeway', 'kroger', 'publix', 'whole foods', 'trader joe',
      'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'grocery',
      'deli', 'bakery', 'market', 'supermarket', 'mcdonalds', 'subway',
      'starbucks', 'dunkin', 'kfc', 'taco bell', 'chipotle', 'panera'
    ],
    transport: [
      'shell', 'exxon', 'chevron', 'bp', 'mobil', 'texaco', 'citgo',
      'gas', 'fuel', 'station', 'uber', 'lyft', 'taxi', 'parking',
      'arco', 'marathon', 'sunoco', '76', 'valero'
    ],
    shopping: [
      'target', 'costco', 'best buy', 'home depot', 'lowes', 'macy',
      'nordstrom', 'store', 'mall', 'retail', 'outlet', 'amazon',
      'walmart', 'cvs', 'walgreens', 'rite aid'
    ],
    entertainment: [
      'cinema', 'theater', 'movie', 'amc', 'regal', 'netflix',
      'spotify', 'game', 'entertainment', 'bowling', 'arcade'
    ],
    healthcare: [
      'cvs', 'walgreens', 'rite aid', 'pharmacy', 'hospital',
      'clinic', 'medical', 'doctor', 'dentist', 'urgent care'
    ],
    utilities: [
      'electric', 'power', 'water', 'gas', 'internet', 'phone',
      'cable', 'utility', 'verizon', 'att', 'comcast', 'spectrum'
    ]
  };

  async parseReceipt(ocrText: string, confidence: number): Promise<ParsedReceiptData> {
    console.log('🔍 Enhanced receipt parsing started');
    console.log('📄 OCR Text length:', ocrText.length);
    console.log('📊 OCR Confidence:', confidence);
    
    // Check if this is a fallback template
    if (ocrText.includes('OCR_PROCESSING_FAILED') || ocrText.includes('MANUAL_ENTRY_TEMPLATE')) {
      console.log('📋 Detected fallback template, providing manual entry structure');
      return {
        confidence: 0.1,
        category: 'other',
        merchant: 'Manual Entry Required',
        date: new Date().toISOString().split('T')[0],
        total: undefined,
        subtotal: undefined,
        tax: undefined,
        items: [],
        notes: 'OCR failed - please enter details manually'
      };
    }
    
    const lines = this.preprocessText(ocrText);
    console.log('📝 Processed lines:', lines.length);
    
    const parsedData: ParsedReceiptData = {
      confidence,
      merchant: this.extractMerchant(lines),
      total: this.extractTotal(lines),
      subtotal: this.extractSubtotal(lines),
      tax: this.extractTax(lines),
      date: this.extractDate(lines),
      time: this.extractTime(lines),
      items: this.extractItems(lines),
      paymentMethod: this.extractPaymentMethod(lines),
      address: this.extractAddress(lines),
      phone: this.extractPhone(lines)
    };

    parsedData.category = this.inferCategory(parsedData);
    
    const validatedData = this.validateAndCleanData(parsedData);
    console.log('✅ Enhanced receipt parsing completed');
    
    return validatedData;
  }

  private preprocessText(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !this.isLikelyNoise(line))
      .map(line => this.cleanOCRErrors(line));
  }

  private cleanOCRErrors(line: string): string {
    // Common OCR error corrections
    const corrections = [
      [/[Il1|]\$(\d)/g, '\$$1'], // Fix dollar sign issues
      [/(\d)[Il1|](\d)/g, '$1.$2'], // Fix decimal points
      [/[O0](\d+\.\d{2})/g, '$$$1'], // Fix currency OCR errors
      [/T[O0][T7][A4@][L1]/ig, 'TOTAL'], // Fix TOTAL OCR errors
      [/[T7][A4@][X]/ig, 'TAX'], // Fix TAX OCR errors
      [/S[U\[]B[T7][O0][T7][A4@][L1]/ig, 'SUBTOTAL'], // Fix SUBTOTAL
      [/\s+/g, ' '], // Normalize whitespace
    ];
    
    let cleaned = line;
    for (const [pattern, replacement] of corrections) {
      cleaned = cleaned.replace(pattern, replacement as string);
    }
    
    return cleaned;
  }

  private isLikelyNoise(line: string): boolean {
    const noisePatterns = [
      /^[^a-zA-Z0-9]*$/,  // Only special characters
      /^.{1,2}$/,         // Too short
      /^[*-=_]{3,}$/,     // Lines of repeating characters
      /^[|\s]*$/,         // Only pipes and spaces
      /^\d{4,}\s*$/,      // Long number sequences (likely OCR artifacts)
    ];
    
    return noisePatterns.some(pattern => pattern.test(line));
  }

  private extractMerchant(lines: string[]): string | undefined {
    console.log('🏪 Extracting merchant name...');
    
    // Look in first 8 lines for merchant name (increased from 5)
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const line = lines[i];
      
      for (const pattern of this.merchantPatterns) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].length > 2 && match[1].length < 50) {
          const merchant = this.cleanMerchantName(match[1]);
          console.log('✅ Found merchant:', merchant);
          return merchant;
        }
      }
    }

    // Fallback: use machine learning approach
    const fallbackMerchant = this.inferMerchantWithML(lines);
    if (fallbackMerchant) {
      console.log('✅ Inferred merchant:', fallbackMerchant);
    }
    return fallbackMerchant;
  }

  private cleanMerchantName(name: string): string {
    return name
      .replace(/[^\w\s&'.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private inferMerchantWithML(lines: string[]): string | undefined {
    // Enhanced heuristic approach
    const topLines = lines.slice(0, 6);
    
    // Look for lines that might be merchant names
    const candidates = topLines
      .filter(line => {
        // Must contain letters
        if (!/[a-zA-Z]/.test(line)) return false;
        // Should be reasonable length
        if (line.length < 3 || line.length > 40) return false;
        // Shouldn't be all numbers
        if (/^\d+$/.test(line.replace(/\s/g, ''))) return false;
        // Shouldn't be date/time
        if (/\d{1,2}[\/\-:]\d{1,2}/.test(line)) return false;
        return true;
      })
      .map(line => ({
        text: line,
        score: this.scoreMerchantCandidate(line)
      }))
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0) {
      return this.cleanMerchantName(candidates[0].text);
    }
    
    return undefined;
  }

  private scoreMerchantCandidate(line: string): number {
    let score = 0;
    
    // Positive indicators
    if (/^[A-Z]/.test(line)) score += 2; // Starts with capital
    if (/[A-Z]{2,}/.test(line)) score += 1; // Has capital letters
    if (/(?:STORE|MARKET|SHOP|CAFE|RESTAURANT)/i.test(line)) score += 3;
    if (line.length >= 5 && line.length <= 25) score += 1; // Good length
    
    // Check against known merchants
    const lowerLine = line.toLowerCase();
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (keywords.some(keyword => lowerLine.includes(keyword))) {
        score += 5;
        break;
      }
    }
    
    // Negative indicators
    if (/\d{4,}/.test(line)) score -= 2; // Long numbers
    if (/[*#@$%^&(){}[\]<>]/.test(line)) score -= 1; // Special characters
    if (/^(THE|AND|FOR|WITH|AT)$/i.test(line)) score -= 3; // Common words
    
    return score;
  }

  private extractTotal(lines: string[]): number | undefined {
    console.log('💰 Extracting total amount...');
    
    // Search from bottom up as total is usually at the end
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
      const line = lines[i];
      
      for (const pattern of this.totalPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const amount = parseFloat(match[1]);
          if (this.isReasonableAmount(amount)) {
            console.log('✅ Found total:', amount);
            return amount;
          }
        }
      }
    }

    // Fallback: find largest reasonable amount
    const fallbackTotal = this.findLargestAmount(lines);
    if (fallbackTotal) {
      console.log('✅ Inferred total:', fallbackTotal);
    }
    return fallbackTotal;
  }

  private findLargestAmount(lines: string[]): number | undefined {
    const amounts: number[] = [];
    const amountPattern = /\$?(\d+\.\d{2})/g;
    
    for (const line of lines) {
      let match;
      while ((match = amountPattern.exec(line)) !== null) {
        const amount = parseFloat(match[1]);
        if (this.isReasonableAmount(amount)) {
          amounts.push(amount);
        }
      }
    }
    
    if (amounts.length === 0) return undefined;
    
    // Return largest amount that appears reasonable for a total
    const sortedAmounts = amounts.sort((a, b) => b - a);
    
    // If there's a clear largest amount, use it
    if (sortedAmounts[0] > sortedAmounts[1] * 1.5 || sortedAmounts.length === 1) {
      return sortedAmounts[0];
    }
    
    return sortedAmounts[0];
  }

  private extractDate(lines: string[]): string | undefined {
    console.log('📅 Extracting date...');
    
    // Look in first half of receipt for date
    for (const line of lines.slice(0, Math.floor(lines.length / 2) + 5)) {
      for (const pattern of this.datePatterns) {
        const matches = line.match(pattern);
        if (matches) {
          const dateStr = matches[1] || matches[0];
          const normalizedDate = this.normalizeDate(dateStr);
          if (normalizedDate) {
            console.log('✅ Found date:', normalizedDate);
            return normalizedDate;
          }
        }
      }
    }
    
    return undefined;
  }

  private normalizeDate(dateStr: string): string | undefined {
    try {
      // Handle various date formats
      let date: Date;
      
      // Try parsing directly first
      date = new Date(dateStr);
      
      // If that doesn't work, try different formats
      if (isNaN(date.getTime())) {
        // Try MM/DD/YYYY format
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const [part1, part2, part3] = parts.map(p => parseInt(p));
          
          // Assume MM/DD/YYYY or DD/MM/YYYY
          let year = part3;
          if (year < 100) year += 2000; // Handle 2-digit years
          
          date = new Date(year, part1 - 1, part2);
          
          // If invalid, try DD/MM/YYYY
          if (isNaN(date.getTime())) {
            date = new Date(year, part2 - 1, part1);
          }
        }
      }
      
      // Validate date is reasonable
      if (isNaN(date.getTime())) return undefined;
      
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const oneMonthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      
      if (date < oneYearAgo || date > oneMonthFromNow) {
        return undefined;
      }
      
      return date.toISOString().split('T')[0];
    } catch {
      return undefined;
    }
  }

  private extractItems(lines: string[]): Array<{name: string, price: number, quantity?: number}> {
    console.log('📝 Extracting line items...');
    
    const items: Array<{name: string, price: number, quantity?: number}> = [];
    
    const itemPatterns = [
      /^(.+?)\s+(\d+)\s*@\s*\$?(\d+\.\d{2})\s*=?\s*\$?(\d+\.\d{2})?$/,  // Name Qty @ Price = Total
      /^(.+?)\s+(\d+)\s*x\s*\$?(\d+\.\d{2})$/,  // Name Qty x Price
      /^(.+?)\s+\$?(\d+\.\d{2})$/,               // Name Price
      /^(\d+)\s+(.+?)\s+\$?(\d+\.\d{2})$/,      // Qty Name Price
    ];

    for (const line of lines) {
      for (let i = 0; i < itemPatterns.length; i++) {
        const pattern = itemPatterns[i];
        const match = line.match(pattern);
        
        if (match) {
          const parsed = this.parseItemLine(match, i);
          if (parsed && this.isLikelyItem(parsed.name) && parsed.price > 0 && parsed.price < 1000) {
            items.push(parsed);
            break;
          }
        }
      }
    }

    console.log('✅ Found items:', items.length);
    return items;
  }

  private parseItemLine(match: RegExpMatchArray, patternIndex: number): {name: string, price: number, quantity?: number} | null {
    try {
      switch (patternIndex) {
        case 0: // Name Qty @ Price = Total
          return {
            name: match[1].trim(),
            quantity: parseInt(match[2]),
            price: parseFloat(match[4] || match[3])
          };
        case 1: // Name Qty x Price
          return {
            name: match[1].trim(),
            quantity: parseInt(match[2]),
            price: parseFloat(match[3]) * parseInt(match[2])
          };
        case 2: // Name Price
          return {
            name: match[1].trim(),
            price: parseFloat(match[2]),
            quantity: 1
          };
        case 3: // Qty Name Price
          return {
            quantity: parseInt(match[1]),
            name: match[2].trim(),
            price: parseFloat(match[3])
          };
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private isLikelyItem(name: string): boolean {
    const excludePatterns = [
      /total/i, /subtotal/i, /tax/i, /discount/i, /change/i,
      /cash/i, /credit/i, /debit/i, /visa/i, /mastercard/i,
      /thank/i, /receipt/i, /store/i, /cashier/i, /register/i,
      /^\d+$/, // Just numbers
      /^[*-=]{2,}$/, // Decorative lines
      /phone/i, /address/i, /manager/i
    ];
    
    return name.length > 2 && 
           !excludePatterns.some(pattern => pattern.test(name)) &&
           /[a-zA-Z]/.test(name); // Must contain at least one letter
  }

  private extractTax(lines: string[]): number | undefined {
    for (const line of lines) {
      for (const pattern of this.taxPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const amount = parseFloat(match[1]);
          if (amount >= 0 && amount < 1000) {
            return amount;
          }
        }
      }
    }
    return undefined;
  }

  private extractSubtotal(lines: string[]): number | undefined {
    for (const line of lines) {
      for (const pattern of this.subtotalPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const amount = parseFloat(match[1]);
          if (this.isReasonableAmount(amount)) {
            return amount;
          }
        }
      }
    }
    return undefined;
  }

  private extractTime(lines: string[]): string | undefined {
    for (const line of lines.slice(0, Math.floor(lines.length / 2))) {
      for (const pattern of this.timePatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    return undefined;
  }

  private extractPaymentMethod(lines: string[]): string | undefined {
    const paymentPatterns = [
      /(visa|mastercard|amex|discover|american express)/i,
      /card[:\s]*\*+(\d{4})/i,
      /(cash|credit|debit)/i,
      /(apple pay|google pay|samsung pay)/i,
      /chip\s+(credit|debit)/i
    ];

    for (const line of lines.slice(-20)) {
      for (const pattern of paymentPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1].toLowerCase();
        }
      }
    }
    return undefined;
  }

  private extractAddress(lines: string[]): string | undefined {
    const addressPatterns = [
      /\d+\s+[A-Za-z\s]+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive)/i,
      /[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/,
    ];

    for (const line of lines.slice(0, 15)) {
      for (const pattern of addressPatterns) {
        if (pattern.test(line)) {
          return line.trim();
        }
      }
    }
    return undefined;
  }

  private extractPhone(lines: string[]): string | undefined {
    const phonePattern = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    
    for (const line of lines.slice(0, 15)) {
      const match = line.match(phonePattern);
      if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    }
    return undefined;
  }

  private isReasonableAmount(amount: number): boolean {
    return amount > 0 && amount < 50000;
  }

  private inferCategory(data: ParsedReceiptData): string {
    const searchText = [
      data.merchant,
      data.address,
      ...(data.items?.map(item => item.name) || [])
    ].join(' ').toLowerCase();

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (keywords.some(keyword => searchText.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  private validateAndCleanData(data: ParsedReceiptData): ParsedReceiptData {
    // Validate total vs subtotal + tax
    if (data.total && data.subtotal && data.tax) {
      const calculatedTotal = data.subtotal + data.tax;
      if (Math.abs(calculatedTotal - data.total) > 1) {
        console.warn('Total/subtotal/tax mismatch detected');
      }
    }

    // If no total but have items, calculate from items
    if (!data.total && data.items && data.items.length > 0) {
      const itemsTotal = data.items.reduce((sum, item) => sum + item.price, 0);
      if (itemsTotal > 0) {
        data.total = itemsTotal;
        console.log('✅ Calculated total from items:', itemsTotal);
      }
    }

    // Clean up merchant name
    if (data.merchant) {
      data.merchant = data.merchant.replace(/[^\w\s&'.-]/g, '').trim();
      if (data.merchant.length < 2) {
        delete data.merchant;
      }
    }

    // Validate items
    if (data.items) {
      data.items = data.items.filter(item => 
        item.name.length > 1 && 
        item.price > 0 && 
        item.price < 10000
      );
      
      if (data.items.length === 0) {
        delete data.items;
      }
    }

    return data;
  }
}

export const enhancedReceiptParser = new EnhancedReceiptParser();