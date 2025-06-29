export interface ParsedReceiptData {
  merchant?: string;
  total?: number;
  subtotal?: number;
  tax?: number;
  date?: string;
  time?: string;
  items?: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
  paymentMethod?: string;
  category?: string;
  address?: string;
  phone?: string;
  confidence: number;
}

export class AdvancedReceiptParser {
  private merchantPatterns = [
    /^([A-Z][A-Z\s&'.-]{2,})(?:\s*STORE|\s*LOCATION|\s*#\d+)?$/m,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/m,
    /^(.+?)\s+STORE\s*#?\d+/im,
  ];

  private totalPatterns = [
    /(?:total|amount due|balance due)[:\s]*\$?(\d+\.?\d{0,2})/i,
    /grand\s*total[:\s]*\$?(\d+\.?\d{0,2})/i,
    /final\s*total[:\s]*\$?(\d+\.?\d{0,2})/i,
    /\$(\d+\.\d{2})(?:\s*$|\s*total)/im,
  ];

  private datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{1,2}-\d{1,2}-\d{2,4})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}/i,
  ];

  private timePatterns = [
    /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i,
    /time[:\s]*(\d{1,2}:\d{2}(?::\d{2})?)/i,
  ];

  private taxPatterns = [
    /(?:tax|hst|gst|pst|vat)[:\s]*\$?(\d+\.?\d{0,2})/i,
    /sales\s*tax[:\s]*\$?(\d+\.?\d{0,2})/i,
  ];

  private subtotalPatterns = [
    /(?:subtotal|sub\s*total)[:\s]*\$?(\d+\.?\d{0,2})/i,
  ];

  private categoryKeywords = {
    food: [
      'walmart', 'safeway', 'kroger', 'publix', 'whole foods', 'trader joe',
      'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'grocery',
      'deli', 'bakery', 'market', 'supermarket'
    ],
    transport: [
      'shell', 'exxon', 'chevron', 'bp', 'mobil', 'texaco', 'citgo',
      'gas', 'fuel', 'station', 'uber', 'lyft', 'taxi', 'parking'
    ],
    shopping: [
      'target', 'costco', 'best buy', 'home depot', 'lowes', 'macy',
      'nordstrom', 'store', 'mall', 'retail', 'outlet'
    ],
    entertainment: [
      'cinema', 'theater', 'movie', 'amc', 'regal', 'netflix',
      'spotify', 'game', 'entertainment'
    ],
    healthcare: [
      'cvs', 'walgreens', 'rite aid', 'pharmacy', 'hospital',
      'clinic', 'medical', 'doctor', 'dentist'
    ],
    utilities: [
      'electric', 'power', 'water', 'gas', 'internet', 'phone',
      'cable', 'utility'
    ]
  };

  async parseReceipt(ocrText: string, confidence: number): Promise<ParsedReceiptData> {
    const lines = this.preprocessText(ocrText);
    
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
    
    return this.validateAndCleanData(parsedData);
  }

  private preprocessText(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !this.isLikelyNoise(line));
  }

  private isLikelyNoise(line: string): boolean {
    // Filter out common OCR noise patterns
    const noisePatterns = [
      /^[^a-zA-Z0-9]*$/,  // Only special characters
      /^.{1,2}$/,         // Too short
      /^[*-=_]{3,}$/,     // Lines of repeating characters
    ];
    
    return noisePatterns.some(pattern => pattern.test(line));
  }

  private extractMerchant(lines: string[]): string | undefined {
    // Look in first 5 lines for merchant name
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      
      for (const pattern of this.merchantPatterns) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].length > 2) {
          return this.cleanMerchantName(match[1]);
        }
      }
    }

    // Fallback: use machine learning approach
    return this.inferMerchantWithML(lines);
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
    // Simple heuristic: longest line in top 3 that contains letters
    const topLines = lines.slice(0, 3);
    const candidates = topLines.filter(line => 
      /[a-zA-Z]/.test(line) && line.length > 3
    );
    
    if (candidates.length > 0) {
      return this.cleanMerchantName(
        candidates.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        )
      );
    }
    
    return undefined;
  }

  private extractTotal(lines: string[]): number | undefined {
    // Search from bottom up
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      const line = lines[i];
      
      for (const pattern of this.totalPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const amount = parseFloat(match[1]);
          if (this.isReasonableAmount(amount)) {
            return amount;
          }
        }
      }
    }

    // Fallback: find largest amount
    return this.findLargestAmount(lines);
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

  private extractDate(lines: string[]): string | undefined {
    for (const line of lines.slice(0, Math.floor(lines.length / 2))) {
      for (const pattern of this.datePatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return this.normalizeDate(match[1]);
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

  private extractItems(lines: string[]): Array<{name: string, price: number, quantity?: number}> {
    const items: Array<{name: string, price: number, quantity?: number}> = [];
    
    // Patterns for line items
    const itemPatterns = [
      /^(.+?)\s+(\d*\.?\d*)\s*\$?(\d+\.\d{2})$/,  // Name Qty Price
      /^(.+?)\s+\$?(\d+\.\d{2})$/,               // Name Price
      /^(\d+)\s+(.+?)\s+\$?(\d+\.\d{2})$/,       // Qty Name Price
    ];

    for (const line of lines) {
      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          const parsed = this.parseItemLine(match, pattern);
          if (parsed && this.isLikelyItem(parsed.name)) {
            items.push(parsed);
            break; // Move to next line
          }
        }
      }
    }

    return items;
  }

  private parseItemLine(match: RegExpMatchArray, pattern: RegExp): {name: string, price: number, quantity?: number} | null {
    try {
      // Different parsing based on pattern
      if (pattern.source.includes('(\d+)\s+(.+?)')) {
        // Qty Name Price format
        return {
          quantity: parseInt(match[1]),
          name: match[2].trim(),
          price: parseFloat(match[3])
        };
      } else if (pattern.source.includes('(\d*\.?\d*)\s*\$?(\d+\.\d{2})')) {
        // Name Qty Price format
        return {
          name: match[1].trim(),
          quantity: match[2] ? parseFloat(match[2]) : 1,
          price: parseFloat(match[3])
        };
      } else {
        // Name Price format
        return {
          name: match[1].trim(),
          price: parseFloat(match[2]),
          quantity: 1
        };
      }
    } catch {
      return null;
    }
  }

  private isLikelyItem(name: string): boolean {
    // Filter out non-item text
    const excludePatterns = [
      /total/i, /subtotal/i, /tax/i, /discount/i, /change/i,
      /cash/i, /credit/i, /debit/i, /visa/i, /mastercard/i,
      /thank/i, /receipt/i, /store/i, /cashier/i, /register/i,
      /^\d+$/, // Just numbers
      /^[*-=]{2,}$/ // Decorative lines
    ];
    
    return name.length > 2 && 
           !excludePatterns.some(pattern => pattern.test(name));
  }

  private extractPaymentMethod(lines: string[]): string | undefined {
    const paymentPatterns = [
      /(visa|mastercard|amex|discover|american express)/i,
      /card[:\s]*\*+(\d{4})/i,
      /(cash|credit|debit)/i,
      /(apple pay|google pay|samsung pay)/i,
    ];

    for (const line of lines.slice(-15)) {
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
    // Look for address patterns in first 10 lines
    const addressPatterns = [
      /\d+\s+[A-Za-z\s]+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive)/i,
      /[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/,
    ];

    for (const line of lines.slice(0, 10)) {
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
    
    for (const line of lines.slice(0, 10)) {
      const match = line.match(phonePattern);
      if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    }
    return undefined;
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
    
    return amounts.length > 0 ? Math.max(...amounts) : undefined;
  }

  private isReasonableAmount(amount: number): boolean {
    return amount > 0 && amount < 50000;
  }

  private normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
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
        // Large discrepancy, prefer extracted total
        console.warn('Total/subtotal/tax mismatch detected');
      }
    }

    // Validate date is not in future
    if (data.date) {
      const receiptDate = new Date(data.date);
      const today = new Date();
      if (receiptDate > today) {
        delete data.date;
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
    }

    return data;
  }
}