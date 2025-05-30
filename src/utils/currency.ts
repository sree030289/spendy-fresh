export const getCurrencySymbol = (currencyCode: string): string => {
  const currencySymbols: { [key: string]: string } = {
    // Major currencies
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'KRW': '₩',
    'INR': '₹',
    'AUD': '$',
    'CAD': '$',
    'CHF': 'Fr',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'CZK': 'Kč',
    'HUF': 'Ft',
    'RUB': '₽',
    'TRY': '₺',
    'BRL': 'R$',
    'MXN': '$',
    'ARS': '$',
    'CLP': '$',
    'COP': '$',
    'PEN': 'S/',
    'UYU': '$U',
    'ZAR': 'R',
    'NGN': '₦',
    'EGP': '£',
    'MAD': 'DH',
    'KES': 'KSh',
    'GHS': '₵',
    'XOF': 'CFA',
    'XAF': 'FCFA',
    'THB': '฿',
    'VND': '₫',
    'PHP': '₱',
    'IDR': 'Rp',
    'MYR': 'RM',
    'SGD': '$',
    'HKD': '$',
    'TWD': 'NT$',
    'NZD': '$',
    'FJD': '$',
    'TOP': 'T$',
    'WST': 'T',
    'PGK': 'K',
    'SBD': '$',
    'VUV': 'Vt',
    'XPF': '₣',
    'AED': 'د.إ',
    'SAR': '﷼',
    'QAR': '﷼',
    'KWD': 'د.ك',
    'BHD': '.د.ب',
    'OMR': '﷼',
    'JOD': 'د.ا',
    'LBP': '£',
    'ILS': '₪',
    'PKR': '₨',
    'LKR': '₨',
    'NPR': '₨',
    'BTN': 'Nu.',
    'MVR': '.ރ',
    'AFN': '؋',
    'IRR': '﷼',
    'IQD': 'ع.د',
    // Add more as needed
  };
  
  return currencySymbols[currencyCode.toUpperCase()] || currencyCode;
};
export const formatCurrency = (amount: number, currencyCode: string): string => {
  const symbol = getCurrencySymbol(currencyCode);
  const formattedAmount = amount.toFixed(2);
  
  // For some currencies, symbol goes after the amount
  const symbolAfterCurrencies = ['SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'];
  
  if (symbolAfterCurrencies.includes(currencyCode.toUpperCase())) {
    return `${formattedAmount} ${symbol}`;
  }
  
  return `${symbol}${formattedAmount}`;
};