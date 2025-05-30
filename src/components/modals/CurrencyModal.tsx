import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { COUNTRIES } from '@/constants/countries';

interface CurrencyModalProps {
  visible: boolean;
  currentCurrency: string;
  onClose: () => void;
  onUpdate: (newCurrency: string) => Promise<void>;
}

const CurrencyModal: React.FC<CurrencyModalProps> = ({
  visible,
  currentCurrency,
  onClose,
  onUpdate
}) => {
  const { theme } = useTheme();
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedCurrency(currentCurrency);
      setSearchQuery('');
      setIsUpdating(false);
    }
  }, [visible, currentCurrency]);

  // Get unique currencies from countries data
  const currencies = [...new Set(COUNTRIES.map(c => c.currency))].sort();
  
  // Filter currencies based on search
  const filteredCurrencies = currencies.filter(currency => {
    const country = COUNTRIES.find(c => c.currency === currency);
    return currency.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (country && country.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const getCurrencyInfo = (currency: string) => {
    const country = COUNTRIES.find(c => c.currency === currency);
    const countries = COUNTRIES.filter(c => c.currency === currency);
    
    return {
      flag: country?.flag || '💰',
      name: currency,
      description: countries.length === 1 
        ? country?.name || 'Unknown'
        : `${countries.length} countries`,
    };
  };

  const handleUpdate = async () => {
    if (selectedCurrency === currentCurrency) {
      onClose();
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(selectedCurrency);
      
      // Show success and close
      Alert.alert(
        'Currency Updated!',
        `Your currency has been successfully changed to ${selectedCurrency}.`,
        [
          {
            text: 'OK',
            onPress: onClose
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update currency. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const CurrencyItem = ({ currency }: { currency: string }) => {
    const currencyInfo = getCurrencyInfo(currency);
    const isSelected = currency === selectedCurrency;
    const isCurrentCurrency = currency === currentCurrency;

    return (
      <TouchableOpacity
        style={[
          styles.currencyItem,
          {
            backgroundColor: isSelected 
              ? `${theme.colors.primary}15` 
              : theme.colors.background,
            borderColor: isSelected 
              ? theme.colors.primary 
              : theme.colors.border,
            borderWidth: isSelected ? 2 : 1,
          }
        ]}
        onPress={() => setSelectedCurrency(currency)}
        activeOpacity={0.7}
      >
        <View style={styles.currencyLeft}>
          <Text style={styles.currencyFlag}>{currencyInfo.flag}</Text>
          <View style={styles.currencyInfo}>
            <View style={styles.currencyHeader}>
              <Text style={[
                styles.currencyCode, 
                { 
                  color: theme.colors.text,
                  fontWeight: isSelected ? '700' : '600'
                }
              ]}>
                {currencyInfo.name}
              </Text>
              {isCurrentCurrency && (
                <View style={[
                  styles.currentBadge,
                  { backgroundColor: theme.colors.success }
                ]}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.currencyDescription, 
              { color: theme.colors.textSecondary }
            ]}>
              {currencyInfo.description}
            </Text>
          </View>
        </View>
        
        <View style={styles.currencyRight}>
          {isSelected && (
            <Ionicons 
              name="checkmark-circle" 
              size={24} 
              color={theme.colors.primary} 
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={isUpdating}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Change Currency
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Current Currency Info */}
        <View style={[styles.currentCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.currentHeader}>
            <Ionicons name="card-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.currentTitle, { color: theme.colors.text }]}>
              Current: {currentCurrency}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }
            ]}
            placeholder="Search currencies..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!isUpdating}
          />
          <Ionicons
            name="search-outline"
            size={20}
            color={theme.colors.textSecondary}
            style={styles.searchIcon}
          />
        </View>

        {/* Currency List */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Available Currencies ({filteredCurrencies.length})
          </Text>
          
          {filteredCurrencies.map((currency) => (
            <CurrencyItem key={currency} currency={currency} />
          ))}
          
          {filteredCurrencies.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No currencies found
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {selectedCurrency !== currentCurrency && (
            <View style={[styles.changeInfo, { backgroundColor: `${theme.colors.primary}10` }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.changeText, { color: theme.colors.primary }]}>
                Changing from {currentCurrency} to {selectedCurrency}
              </Text>
            </View>
          )}
          
          <View style={styles.buttons}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="outline"
              style={styles.button}
              disabled={isUpdating}
            />
            <Button
              title={selectedCurrency === currentCurrency ? "No Changes" : "Update Currency"}
              onPress={handleUpdate}
              loading={isUpdating}
              disabled={selectedCurrency === currentCurrency}
              style={styles.button}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  currentCard: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencyFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  currencyDescription: {
    fontSize: 12,
  },
  currencyRight: {
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  footer: {
    padding: 20,
    paddingTop: 16,
  },
  changeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
});

export default CurrencyModal;