import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { PhoneNumberService } from '@/services/invite/PhoneNumberService';
import CountryCodePicker, { Country, getDefaultCountry } from './CountryCodePicker';

interface PhoneNumberInputProps {
  value: string;
  onChangeText: (phoneNumber: string) => void;
  onCountryChange?: (country: Country) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  autoFocus?: boolean;
}

export default function PhoneNumberInput({
  value,
  onChangeText,
  onCountryChange,
  placeholder = 'Phone number',
  error,
  disabled = false,
  style,
  inputStyle,
  autoFocus = false,
}: PhoneNumberInputProps) {
  const { theme } = useTheme();
  const [selectedCountry, setSelectedCountry] = useState<Country>(getDefaultCountry());
  const [formattedValue, setFormattedValue] = useState('');
  const [isValid, setIsValid] = useState(true);

  // Format phone number as user types
  useEffect(() => {
    if (value) {
      try {
        const formatted = PhoneNumberService.formatAsYouType(value, selectedCountry.code as any);
        setFormattedValue(formatted);
        
        // Validate the number
        const isValidNumber = PhoneNumberService.validate(value, selectedCountry.code as any);
        setIsValid(isValidNumber);
      } catch {
        setFormattedValue(value);
        setIsValid(false);
      }
    } else {
      setFormattedValue('');
      setIsValid(true);
    }
  }, [value, selectedCountry]);

  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
    onCountryChange?.(country);
    
    // If user has entered a number, try to reformat it for the new country
    if (value) {
      try {
        const formatted = PhoneNumberService.formatAsYouType(value, country.code as any);
        setFormattedValue(formatted);
        
        const isValidNumber = PhoneNumberService.validate(value, country.code as any);
        setIsValid(isValidNumber);
      } catch {
        // Keep the current value if reformatting fails
      }
    }
  };

  const handleTextChange = (text: string) => {
    // Remove formatting characters for storage
    const cleanText = text.replace(/[\s\-\(\)]/g, '');
    onChangeText(cleanText);
  };

  const getInputBorderColor = () => {
    if (error) return theme.colors.error;
    if (!isValid && value.length > 0) return theme.colors.warning;
    return theme.colors.border;
  };

  const getInputBorderWidth = () => {
    if (error || (!isValid && value.length > 0)) return 2;
    return 1;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputRow}>
        <CountryCodePicker
          selectedCountry={selectedCountry}
          onSelectCountry={handleCountryChange}
          style={[
            styles.countryPicker,
            {
              backgroundColor: theme.colors.surface,
              borderColor: getInputBorderColor(),
              borderWidth: getInputBorderWidth(),
            }
          ]}
        />
        
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: getInputBorderColor(),
              borderWidth: getInputBorderWidth(),
              color: theme.colors.text,
            },
            inputStyle,
          ]}
          value={formattedValue}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="phone-pad"
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={!disabled}
          autoFocus={autoFocus}
        />
      </View>

      {/* Validation and error messages */}
      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : !isValid && value.length > 0 ? (
        <Text style={[styles.warningText, { color: theme.colors.warning }]}>
          Invalid phone number format
        </Text>
      ) : value.length > 0 ? (
        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
          {PhoneNumberService.format(value, selectedCountry.code as any) || 'Formatting...'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryPicker: {
    // Country picker will size itself
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '400',
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  warningText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontStyle: 'italic',
  },
});

// Export types for external use
export type { Country };