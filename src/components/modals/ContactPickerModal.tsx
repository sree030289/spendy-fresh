import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import FullscreenModal from '@/components/common/FullscreenModal';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (contacts: Array<{ name: string; phoneNumber: string }>) => void;
  maxSelection?: number;
  alreadySelected?: Array<{ name: string; phoneNumber: string }>;
}

export default function ContactPickerModal({
  visible,
  onClose,
  onConfirm,
  maxSelection = 10,
  alreadySelected = [],
}: ContactPickerModalProps) {
  const { theme } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredContacts(
        contacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(query) ||
            contact.phoneNumber.includes(query)
        )
      );
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant contacts permission to select contacts.',
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        const contactsWithPhone: Contact[] = [];
        
        data.forEach((contact) => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            contact.phoneNumbers.forEach((phone) => {
              if (phone.number) {
                const name = contact.name || contact.firstName || contact.lastName || 'Unknown';
                contactsWithPhone.push({
                  id: `${contact.id}_${phone.number}`,
                  name: name.trim(),
                  phoneNumber: phone.number.trim(),
                });
              }
            });
          }
        });

        // Sort alphabetically
        contactsWithPhone.sort((a, b) => a.name.localeCompare(b.name));
        setContacts(contactsWithPhone);
        setFilteredContacts(contactsWithPhone);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        if (newSet.size >= maxSelection) {
          Alert.alert(
            'Maximum Reached',
            `You can only select up to ${maxSelection} contacts.`,
            [{ text: 'OK' }]
          );
          return prev;
        }
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selected = contacts.filter((c) => selectedContacts.has(c.id));
    onConfirm(selected.map((c) => ({ name: c.name, phoneNumber: c.phoneNumber })));
    setSelectedContacts(new Set());
    setSearchQuery('');
    onClose();
  };

  const handleCancel = () => {
    setSelectedContacts(new Set());
    setSearchQuery('');
    onClose();
  };

  const renderContactItem = ({ item }: { item: Contact }) => {
    const isSelected = selectedContacts.has(item.id);
    const isAlreadyAdded = alreadySelected.some(
      (c) => c.phoneNumber === item.phoneNumber
    );

    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          {
            backgroundColor: isSelected
              ? theme.colors.primary + '15'
              : theme.colors.background,
            opacity: isAlreadyAdded ? 0.5 : 1,
          },
        ]}
        onPress={() => !isAlreadyAdded && toggleContactSelection(item.id)}
        disabled={isAlreadyAdded}
      >
        <View style={styles.contactInfo}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.colors.primary + '20' },
            ]}
          >
            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.contactDetails}>
            <Text style={[styles.contactName, { color: theme.colors.text }]}>
              {item.name}
              {isAlreadyAdded && (
                <Text style={[styles.alreadyAddedText, { color: theme.colors.textSecondary }]}>
                  {' '}(Already selected)
                </Text>
              )}
            </Text>
            <Text style={[styles.contactPhone, { color: theme.colors.textSecondary }]}>
              {item.phoneNumber}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              backgroundColor: isSelected ? theme.colors.primary : 'transparent',
            },
          ]}
        >
          {isSelected && <Icon name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FullscreenModal visible={visible} onClose={handleCancel} title="Select Contacts">
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <Icon name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search contacts..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Selection Count */}
        <View style={styles.selectionHeader}>
          <Text style={[styles.selectionCount, { color: theme.colors.textSecondary }]}>
            {selectedContacts.size} of {maxSelection} selected
          </Text>
          {selectedContacts.size > 0 && (
            <TouchableOpacity onPress={() => setSelectedContacts(new Set())}>
              <Text style={[styles.clearButton, { color: theme.colors.primary }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contact List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading contacts...
            </Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="people" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {searchQuery ? 'No contacts found' : 'No contacts available'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item.id}
            style={styles.contactList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: selectedContacts.size === 0 ? 0.5 : 1,
              },
            ]}
            onPress={handleConfirm}
            disabled={selectedContacts.size === 0}
          >
            <Text style={styles.confirmButtonText}>
              Add {selectedContacts.size > 0 ? `${selectedContacts.size} ` : ''}Contact
              {selectedContacts.size !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  contactList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  contactInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  alreadyAddedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  contactPhone: {
    fontSize: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  actionButtons: {
    padding: 16,
    paddingBottom: 32,
  },
  confirmButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
