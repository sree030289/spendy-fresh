// src/services/firebase/CurrencyConversionService.ts
interface ExchangeRates {
  [currencyCode: string]: number;
}

interface CurrencyConversionConfig {
  baseCurrency: string; // USD
  exchangeRates: ExchangeRates;
  lastUpdated: Date;
  source: string;
}

class CurrencyConversionService {
  private static instance: CurrencyConversionService;
  private exchangeRates: ExchangeRates = {};
  private lastUpdated: Date | null = null;
  private baseCurrency = 'USD';

  // Fallback exchange rates (updated periodically, used when API fails)
  private fallbackRates: ExchangeRates = {
    USD: 1.0,
    EUR: 0.85,
    GBP: 0.73,
    JPY: 110.0,
    AUD: 1.35,
    CAD: 1.25,
    CHF: 0.92,
    CNY: 6.45,
    INR: 74.5,
    BRL: 5.2,
    MXN: 20.1,
    KRW: 1180.0,
    SGD: 1.35,
    HKD: 7.8,
    NOK: 8.5,
    SEK: 8.7,
    DKK: 6.4,
    PLN: 3.9,
    CZK: 21.5,
    HUF: 295.0,
    RUB: 74.0,
    TRY: 8.5,
    ZAR: 14.2,
    NZD: 1.42,
    THB: 31.5,
    MYR: 4.15,
    IDR: 14200.0,
    PHP: 50.5,
    VND: 23000.0,
  };

  static getInstance(): CurrencyConversionService {
    if (!CurrencyConversionService.instance) {
      CurrencyConversionService.instance = new CurrencyConversionService();
    }
    return CurrencyConversionService.instance;
  }

  /**
   * Initialize the service and load exchange rates
   */
  async initialize(): Promise<void> {
    try {
      await this.loadExchangeRates();
    } catch (error) {
      console.warn('Failed to load exchange rates, using fallback rates:', error);
      this.exchangeRates = { ...this.fallbackRates };
      this.lastUpdated = new Date();
    }
  }

  /**
   * Load exchange rates from Firebase or external API
   */
  private async loadExchangeRates(): Promise<void> {
    try {
      // First try to load from Firebase (cached rates)
      const cachedRates = await this.loadRatesFromFirebase();
      
      if (cachedRates && this.isRatesFresh(cachedRates.lastUpdated)) {
        console.log('🔄 Using cached exchange rates from Firebase');
        this.exchangeRates = cachedRates.exchangeRates;
        this.lastUpdated = cachedRates.lastUpdated;
        return;
      }

      // If cached rates are stale, fetch fresh rates
      console.log('🌐 Fetching fresh exchange rates...');
      const freshRates = await this.fetchFreshRates();
      
      if (freshRates) {
        this.exchangeRates = freshRates;
        this.lastUpdated = new Date();
        
        // Save to Firebase for caching
        await this.saveRatesToFirebase();
      } else {
        throw new Error('Failed to fetch fresh rates');
      }
    } catch (error) {
      console.error('Error loading exchange rates:', error);
      // Use fallback rates
      this.exchangeRates = { ...this.fallbackRates };
      this.lastUpdated = new Date();
    }
  }

  /**
   * Load cached exchange rates from Firebase
   */
  private async loadRatesFromFirebase(): Promise<CurrencyConversionConfig | null> {
    try {
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore();
      
      const ratesDoc = doc(db, 'appConfig', 'exchangeRates');
      const docSnapshot = await getDoc(ratesDoc);
      
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        return {
          baseCurrency: data.baseCurrency || 'USD',
          exchangeRates: data.exchangeRates || {},
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          source: data.source || 'firebase'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error loading rates from Firebase:', error);
      return null;
    }
  }

  /**
   * Save exchange rates to Firebase for caching
   */
  private async saveRatesToFirebase(): Promise<void> {
    try {
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');
      const db = getFirestore();
      
      const ratesDoc = doc(db, 'appConfig', 'exchangeRates');
      await setDoc(ratesDoc, {
        baseCurrency: this.baseCurrency,
        exchangeRates: this.exchangeRates,
        lastUpdated: new Date(),
        source: 'api',
        version: '1.0.0'
      });
      
      console.log('💾 Exchange rates saved to Firebase');
    } catch (error) {
      console.error('Error saving rates to Firebase:', error);
    }
  }

  /**
   * Fetch fresh exchange rates from external API
   */
  private async fetchFreshRates(): Promise<ExchangeRates | null> {
    try {
      // Using a free exchange rate API (you can replace with your preferred service)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      
      if (!response.ok) {
        throw new Error(`API response: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Fresh exchange rates fetched successfully');
      
      return {
        USD: 1.0, // Base currency
        ...data.rates
      };
    } catch (error) {
      console.error('Error fetching fresh rates:', error);
      return null;
    }
  }

  /**
   * Check if cached rates are still fresh (less than 24 hours old)
   */
  private isRatesFresh(lastUpdated: Date): boolean {
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate < 24; // Refresh every 24 hours
  }

  /**
   * Convert amount from one currency to another
   */
  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): number {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // Same currency, no conversion needed
    if (from === to) {
      return amount;
    }

    // Get exchange rates
    const fromRate = this.exchangeRates[from] || this.fallbackRates[from] || 1;
    const toRate = this.exchangeRates[to] || this.fallbackRates[to] || 1;

    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate;
    const convertedAmount = usdAmount * toRate;

    console.log(`💱 Converting ${amount} ${from} to ${to}: ${convertedAmount.toFixed(2)}`);
    return convertedAmount;
  }

  /**
   * Convert subscription pricing to user's currency
   */
  convertSubscriptionPricing(pricing: any, userCurrency: string): any {
    const userCurr = userCurrency.toUpperCase();
    
    // If already in user's currency, return as-is
    if (pricing.monthly.currency === userCurr) {
      return pricing;
    }

    const convertedPricing: any = {
      monthly: {
        price: this.convertCurrency(pricing.monthly.price, pricing.monthly.currency, userCurr),
        currency: userCurr,
        originalPrice: pricing.monthly.originalPrice 
          ? this.convertCurrency(pricing.monthly.originalPrice, pricing.monthly.currency, userCurr)
          : undefined
      },
      yearly: {
        price: this.convertCurrency(pricing.yearly.price, pricing.yearly.currency, userCurr),
        currency: userCurr,
        originalPrice: pricing.yearly.originalPrice
          ? this.convertCurrency(pricing.yearly.originalPrice, pricing.yearly.currency, userCurr)
          : undefined,
        monthlyEquivalent: this.convertCurrency(pricing.yearly.price, pricing.yearly.currency, userCurr) / 12
      }
    };

    // Recalculate savings in new currency
    if (pricing.savings) {
      const yearlyMonthly = convertedPricing.monthly.price * 12;
      const amount = yearlyMonthly - convertedPricing.yearly.price;
      const percentage = Math.round((amount / yearlyMonthly) * 100);
      
      convertedPricing.savings = {
        percentage,
        amount
      };
    }

    console.log(`🔄 Converted pricing from ${pricing.monthly.currency} to ${userCurr}:`, convertedPricing);
    return convertedPricing;
  }

  /**
   * Get available exchange rates
   */
  getExchangeRates(): ExchangeRates {
    return { ...this.exchangeRates };
  }

  /**
   * Get last update time
   */
  getLastUpdated(): Date | null {
    return this.lastUpdated;
  }

  /**
   * Force refresh exchange rates
   */
  async refreshRates(): Promise<void> {
    console.log('🔄 Force refreshing exchange rates...');
    await this.loadExchangeRates();
  }

  /**
   * Check if a currency is supported
   */
  isCurrencySupported(currencyCode: string): boolean {
    const code = currencyCode.toUpperCase();
    return code in this.exchangeRates || code in this.fallbackRates;
  }

  /**
   * Get conversion rate between two currencies
   */
  getConversionRate(fromCurrency: string, toCurrency: string): number {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) return 1;

    const fromRate = this.exchangeRates[from] || this.fallbackRates[from] || 1;
    const toRate = this.exchangeRates[to] || this.fallbackRates[to] || 1;

    return toRate / fromRate;
  }
}

export default CurrencyConversionService;
