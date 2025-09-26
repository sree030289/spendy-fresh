import { parsePhoneNumber, AsYouType, CountryCode } from 'libphonenumber-js';

export class PhoneNumberService {
  /**
   * Normalize phone number to E.164 format
   * @param phoneNumber - Raw phone number input
   * @param defaultCountry - Default country code (e.g., 'US')
   * @returns Normalized phone number in E.164 format
   */
  static normalize(phoneNumber: string, defaultCountry?: CountryCode): string {
    try {
      if (!phoneNumber?.trim()) {
        throw new Error('Phone number is required');
      }

      const cleanPhoneNumber = phoneNumber.trim();
      const parsedNumber = parsePhoneNumber(cleanPhoneNumber, defaultCountry);
      
      if (!parsedNumber) {
        throw new Error('Unable to parse phone number');
      }

      if (!parsedNumber.isValid()) {
        throw new Error('Invalid phone number format');
      }

      return parsedNumber.format('E.164');
    } catch (error) {
      console.error('Phone number normalization error:', error);
      throw new Error(`Phone number validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if phone number is valid
   * @param phoneNumber - Phone number to validate
   * @param defaultCountry - Default country code
   * @returns Boolean indicating validity
   */
  static validate(phoneNumber: string, defaultCountry?: CountryCode): boolean {
    try {
      if (!phoneNumber?.trim()) {
        return false;
      }

      const parsedNumber = parsePhoneNumber(phoneNumber.trim(), defaultCountry);
      return parsedNumber?.isValid() ?? false;
    } catch (error) {
      console.error('Phone number validation error:', error);
      return false;
    }
  }

  /**
   * Format phone number for display (international format)
   * @param phoneNumber - Phone number to format
   * @param defaultCountry - Default country code
   * @returns Formatted phone number
   */
  static format(phoneNumber: string, defaultCountry?: CountryCode): string {
    try {
      if (!phoneNumber?.trim()) {
        return phoneNumber;
      }

      const parsedNumber = parsePhoneNumber(phoneNumber.trim(), defaultCountry);
      
      if (!parsedNumber?.isValid()) {
        return phoneNumber; // Return original if invalid
      }

      return parsedNumber.formatInternational();
    } catch (error) {
      console.error('Phone number formatting error:', error);
      return phoneNumber; // Return original on error
    }
  }

  /**
   * Format phone number as user types (progressive formatting)
   * @param phoneNumber - Partial phone number being typed
   * @param defaultCountry - Default country code
   * @returns Formatted phone number for input display
   */
  static formatAsYouType(phoneNumber: string, defaultCountry?: CountryCode): string {
    try {
      if (!phoneNumber?.trim()) {
        return phoneNumber;
      }

      const formatter = new AsYouType(defaultCountry);
      return formatter.input(phoneNumber.trim());
    } catch (error) {
      console.error('Phone number as-you-type formatting error:', error);
      return phoneNumber;
    }
  }

  /**
   * Get country code from phone number
   * @param phoneNumber - Phone number to analyze
   * @param defaultCountry - Default country code
   * @returns Country code or null if not determinable
   */
  static getCountryCode(phoneNumber: string, defaultCountry?: CountryCode): CountryCode | null {
    try {
      if (!phoneNumber?.trim()) {
        return null;
      }

      const parsedNumber = parsePhoneNumber(phoneNumber.trim(), defaultCountry);
      return parsedNumber?.country ?? null;
    } catch (error) {
      console.error('Phone number country detection error:', error);
      return null;
    }
  }

  /**
   * Check if two phone numbers are the same (normalized comparison)
   * @param phoneNumber1 - First phone number
   * @param phoneNumber2 - Second phone number
   * @param defaultCountry - Default country code
   * @returns Boolean indicating if numbers are the same
   */
  static areEqual(phoneNumber1: string, phoneNumber2: string, defaultCountry?: CountryCode): boolean {
    try {
      if (!phoneNumber1?.trim() || !phoneNumber2?.trim()) {
        return false;
      }

      const normalized1 = this.normalize(phoneNumber1, defaultCountry);
      const normalized2 = this.normalize(phoneNumber2, defaultCountry);
      
      return normalized1 === normalized2;
    } catch (error) {
      console.error('Phone number comparison error:', error);
      return false;
    }
  }

  /**
   * Extract phone number from various formats and clean it
   * @param input - Input string that might contain phone number
   * @returns Cleaned phone number or null if not found
   */
  static extractPhoneNumber(input: string): string | null {
    try {
      if (!input?.trim()) {
        return null;
      }

      // Remove common non-digit characters but keep + for international format
      const cleaned = input.trim().replace(/[^\d+\-\(\)\s]/g, '');
      
      if (cleaned.length < 10) { // Minimum reasonable phone number length
        return null;
      }

      return cleaned;
    } catch (error) {
      console.error('Phone number extraction error:', error);
      return null;
    }
  }
}
