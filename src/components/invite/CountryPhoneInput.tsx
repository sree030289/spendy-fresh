import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { PhoneNumberService } from '../../services/invite/PhoneNumberService';
import { CountryCode } from 'libphonenumber-js';

interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  dialCode: string;
}

const POPULAR_COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
];

interface CountryPhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  countryCode: CountryCode;
  onCountryChange: (countryCode: CountryCode) => void;
  placeholder?: string;
  editable?: boolean;
  error?: string;
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  value,
  onChangeText,
  countryCode,
  onCountryChange,
  placeholder = "Phone number",
  editable = true,
  error
}) => {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [formattedValue, setFormattedValue] = useState(value);

  const currentCountry = POPULAR_COUNTRIES.find(c => c.code === countryCode) || POPULAR_COUNTRIES[0];

  const handleTextChange = (text: string) => {
    try {
      // Format as user types
      const formatted = PhoneNumberService.formatAsYouType(text, countryCode);
      setFormattedValue(formatted);
      onChangeText(text);
    } catch (error) {
      setFormattedValue(text);
      onChangeText(text);
    }
  };

  const handleCountrySelect = (country: Country) => {
    onCountryChange(country.code);
    setShowCountryPicker(false);
  };

  const isValidPhone = value ? PhoneNumberService.validate(value, countryCode) : true;

  return (
    <View style={styles.container}>
      <View style={[styles.inputContainer, error || !isValidPhone ? styles.inputError : null]}>
        {/* Country Picker */}
        <TouchableOpacity 
          style={styles.countryButton}
          onPress={() => setShowCountryPicker(!showCountryPicker)}
          disabled={!editable}
        >
          <Text style={styles.flag}>{currentCountry.flag}</Text>
          <Text style={styles.dialCode}>{currentCountry.dialCode}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {/* Phone Input */}
        <TextInput
          style={styles.phoneInput}
          value={formattedValue}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          keyboardType="phone-pad"
          editable={editable}
          placeholderTextColor="#999"
        />
      </View>

      {/* Country Picker Dropdown */}
      {showCountryPicker && (
        <View style={styles.countryList}>
          {POPULAR_COUNTRIES.map((country) => (
            <TouchableOpacity
              key={country.code}
              style={styles.countryItem}
              onPress={() => handleCountrySelect(country)}
            >
              <Text style={styles.flag}>{country.flag}</Text>
              <Text style={styles.countryName}>{country.name}</Text>
              <Text style={styles.dialCode}>{country.dialCode}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Error Message */}
      {(error || (!isValidPhone && value)) && (
        <Text style={styles.errorText}>
          {error || "Please enter a valid phone number"}
        </Text>
      )}

      {/* Validation Info */}
      {value && isValidPhone && (
        <Text style={styles.validText}>
          ✓ {PhoneNumberService.format(value, countryCode)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 50,
  },
  inputError: {
    borderColor: '#ff4444',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  flag: {
    fontSize: 20,
    marginRight: 8,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginRight: 4,
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#666',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  countryList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  validText: {
    color: '#22c55e',
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
});
