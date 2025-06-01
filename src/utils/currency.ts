// src/utils/currency.ts - Currency formatting utilities

interface CurrencyConfig {
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
}

const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US', decimals: 2 },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE', decimals: 2 },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB', decimals: 2 },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', decimals: 0 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', decimals: 2 },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA', decimals: 2 },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH', decimals: 2 },
  CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', decimals: 2 },
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', decimals: 2 },
  BRL: { symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR', decimals: 2 },
  MXN: { symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX', decimals: 2 },
  KRW: { symbol: '₩', name: 'South Korean Won', locale: 'ko-KR', decimals: 0 },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', decimals: 2 },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'en-HK', decimals: 2 },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO', decimals: 2 },
  SEK: { symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE', decimals: 2 },
  DKK: { symbol: 'kr', name: 'Danish Krone', locale: 'da-DK', decimals: 2 },
  PLN: { symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL', decimals: 2 },
  CZK: { symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ', decimals: 2 },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint', locale: 'hu-HU', decimals: 0 },
  RUB: { symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU', decimals: 2 },
  TRY: { symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR', decimals: 2 },
  ZAR: { symbol: 'R', name: 'South African Rand', locale: 'en-ZA', decimals: 2 },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ', decimals: 2 },
  THB: { symbol: '฿', name: 'Thai Baht', locale: 'th-TH', decimals: 2 },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', decimals: 2 },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID', decimals: 0 },
  PHP: { symbol: '₱', name: 'Philippine Peso', locale: 'en-PH', decimals: 2 },
  VND: { symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN', decimals: 0 },
};

/**
 * Format a number as currency with proper locale formatting
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  options: {
    showSymbol?: boolean;
    showCode?: boolean;
    compact?: boolean;
    precision?: number;
  } = {}
): string {
  const {
    showSymbol = true,
    showCode = false,
    compact = false,
    precision,
  } = options;

  const config = CURRENCY_CONFIGS[currencyCode.toUpperCase()] || CURRENCY_CONFIGS.USD;
  const decimals = precision !== undefined ? precision : config.decimals;

  try {
    // Format using Intl.NumberFormat for proper locale support
    const formatter = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard',
    });

    let formatted = formatter.format(amount);

    // Handle custom formatting options
    if (!showSymbol && !showCode) {
      // Remove currency symbol/code
      formatted = formatted.replace(/[^\d.,\s-]/g, '').trim();
    } else if (showCode && !showSymbol) {
      // Replace symbol with code
      formatted = formatted.replace(config.symbol, currencyCode.toUpperCase());
    } else if (showSymbol && showCode) {
      // Add currency code after the formatted amount
      formatted = `${formatted} ${currencyCode.toUpperCase()}`;
    }

    return formatted;
  } catch (error) {
    // Fallback formatting if Intl.NumberFormat fails
    console.warn('Currency formatting failed, using fallback:', error);
    return fallbackFormatCurrency(amount, currencyCode, config, decimals);
  }
}

/**
 * Fallback currency formatting when Intl.NumberFormat isn't available
 */
function fallbackFormatCurrency(
  amount: number,
  currencyCode: string,
  config: CurrencyConfig,
  decimals: number
): string {
  const fixedAmount = amount.toFixed(decimals);
  const parts = fixedAmount.split('.');
  
  // Add thousand separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  const formattedNumber = parts.join('.');
  return `${config.symbol}${formattedNumber}`;
}

/**
 * Parse a currency string back to a number
 */
export function parseCurrency(currencyString: string, currencyCode: string = 'USD'): number {
  if (typeof currencyString !== 'string') {
    return typeof currencyString === 'number' ? currencyString : 0;
  }

  // Remove all non-numeric characters except decimal point and minus sign
  const cleaned = currencyString.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  const config = CURRENCY_CONFIGS[currencyCode.toUpperCase()];
  return config ? config.symbol : '$';
}

/**
 * Get currency name for a given currency code
 */
export function getCurrencyName(currencyCode: string): string {
  const config = CURRENCY_CONFIGS[currencyCode.toUpperCase()];
  return config ? config.name : 'US Dollar';
}

/**
 * Get list of supported currencies
 */
export function getSupportedCurrencies(): Array<{
  code: string;
  symbol: string;
  name: string;
}> {
  return Object.entries(CURRENCY_CONFIGS).map(([code, config]) => ({
    code,
    symbol: config.symbol,
    name: config.name,
  }));
}

/**
 * Format currency for display in lists/tables (compact format)
 */
export function formatCurrencyCompact(amount: number, currencyCode: string = 'USD'): string {
  return formatCurrency(amount, currencyCode, { compact: true });
}

/**
 * Format currency without symbol (just the number)
 */
export function formatCurrencyNumber(amount: number, currencyCode: string = 'USD'): string {
  return formatCurrency(amount, currencyCode, { showSymbol: false });
}

/**
 * Convert between currencies (requires exchange rates)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): number {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return amount;
  }
  
  return amount * exchangeRate;
}

/**
 * Format currency for input fields (no symbol, proper decimal places)
 */
export function formatCurrencyInput(amount: number, currencyCode: string = 'USD'): string {
  const config = CURRENCY_CONFIGS[currencyCode.toUpperCase()] || CURRENCY_CONFIGS.USD;
  return amount.toFixed(config.decimals);
}

/**
 * Validate if a currency code is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
  return currencyCode.toUpperCase() in CURRENCY_CONFIGS;
}

/**
 * Get decimal places for a currency
 */
export function getCurrencyDecimals(currencyCode: string): number {
  const config = CURRENCY_CONFIGS[currencyCode.toUpperCase()];
  return config ? config.decimals : 2;
}

/**
 * Format a range of currency values
 */
export function formatCurrencyRange(
  minAmount: number,
  maxAmount: number,
  currencyCode: string = 'USD'
): string {
  const min = formatCurrency(minAmount, currencyCode);
  const max = formatCurrency(maxAmount, currencyCode);
  return `${min} - ${max}`;
}

/**
 * Calculate and format percentage of total
 */
export function formatCurrencyPercentage(
  amount: number,
  total: number,
  currencyCode: string = 'USD'
): string {
  const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
  const formatted = formatCurrency(amount, currencyCode);
  return `${formatted} (${percentage}%)`;
}

/**
 * Format currency with custom precision for different contexts
 */
export function formatCurrencyPrecise(
  amount: number,
  currencyCode: string = 'USD',
  context: 'display' | 'calculation' | 'storage' = 'display'
): string {
  const precision = context === 'calculation' ? 4 : context === 'storage' ? 2 : undefined;
  return formatCurrency(amount, currencyCode, { precision });
}

export default {
  formatCurrency,
  parseCurrency,
  getCurrencySymbol,
  getCurrencyName,
  getSupportedCurrencies,
  formatCurrencyCompact,
  formatCurrencyNumber,
  convertCurrency,
  formatCurrencyInput,
  isSupportedCurrency,
  getCurrencyDecimals,
  formatCurrencyRange,
  formatCurrencyPercentage,
  formatCurrencyPrecise,
};