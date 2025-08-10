// src/components/modals/ImportSplitwise.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { Friend, Group, Expense, ExpenseSplit, SplittingService } from '@/services/firebase/splitting-disabled';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

interface ImportSplitwiseModalProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface ImportFingerprint {
  fileName: string;
  contentHash: string;
  importDate: Date;
}

interface ParsedCSVData {
  date: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  participants: {
    name: string;
    email?: string;
    phone?: string;
    paid: number;
    owed: number;
  }[];
}

interface ImportStatus {
  groupsCreated: number;
  expensesImported: number;
  friendsInvited: number;
  errors: number;
}

export default function ImportSplitwiseModal({ 
  visible, 
  onClose,
  onImportComplete
}: ImportSplitwiseModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState('');
  const [processingStep, setProcessingStep] = useState<'idle' | 'picking' | 'parsing' | 'importing'>('idle');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSVData[]>([]);
  const [groupName, setGroupName] = useState('');
  const [createNewGroup, setCreateNewGroup] = useState(true);
  const [existingGroups, setExistingGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [participantMapping, setParticipantMapping] = useState<Map<string, string>>(new Map());
  const [inviteStatusMap, setInviteStatusMap] = useState<Map<string, 'existing' | 'invited' | 'error'>>(new Map());
  const [participantSelection, setParticipantSelection] = useState<Map<string, boolean>>(new Map());
  const [importFingerprints, setImportFingerprints] = useState<ImportFingerprint[]>([]);

  // Fetch existing groups when modal opens
  useEffect(() => {
    if (visible && user) {
      fetchExistingGroups();
    }
  }, [visible, user]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setFileSelected(false);
      setFileName('');
      setProcessingStep('idle');
      setFileUri(null);
      setCsvData(null);
      setParsedData([]);
      setGroupName('');
      setCreateNewGroup(true);
      setSelectedGroupId('');
      setImportStatus(null);
      setParticipantMapping(new Map());
      setInviteStatusMap(new Map());
      setParticipantSelection(new Map());
    }
  }, [visible]);

  const fetchExistingGroups = async () => {
    try {
      if (!user) return;
      const groups = await SplittingService.getUserGroups(user.id);
      setExistingGroups(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleSelectFile = async () => {
    try {
      setProcessingStep('picking');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true
      });
      
      if (result.canceled) {
        setProcessingStep('idle');
        return;
      }
      
      setFileUri(result.assets[0].uri);
      setFileName(result.assets[0].name);
      setFileSelected(true);
      
      // Automatically parse the CSV after file selection
      setProcessingStep('parsing');
      await parseCSVData(result.assets[0].uri);
      
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'Failed to select CSV file. Please try again.');
      setProcessingStep('idle');
    }
  };

  const parseCSVData = async (uri?: string) => {
    const filePathToUse = uri || fileUri;
    
    if (!filePathToUse) {
      Alert.alert('Error', 'Please select a CSV file first');
      return;
    }

    try {
      setProcessingStep('parsing');
      setLoading(true);

      // Read CSV file content
      const fileContent = await FileSystem.readAsStringAsync(filePathToUse);
      setCsvData(fileContent);

      const lines = fileContent.split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file is empty or has invalid format');
      }

      // Parse header - correctly handle quoted headers
      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine);
      
      // Clean up headers
      const cleanHeaders = headers.map(h => h.trim().replace(/^"|"$/g, ''));

      // Validate expected headers (case insensitive)
      const requiredHeaders = ['Date', 'Description', 'Category', 'Cost', 'Currency'];
      const missingHeaders = requiredHeaders.filter(
        h => !cleanHeaders.some(header => header.toLowerCase().includes(h.toLowerCase()))
      );

      if (missingHeaders.length > 0) {
        throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
      }

      // Find column indices for the required fields (case insensitive)
      const dateIndex = cleanHeaders.findIndex(h => h.toLowerCase().includes('date'));
      const descIndex = cleanHeaders.findIndex(h => h.toLowerCase().includes('description'));
      const catIndex = cleanHeaders.findIndex(h => h.toLowerCase().includes('category'));
      const costIndex = cleanHeaders.findIndex(
        h => h.toLowerCase().includes('cost') || h.toLowerCase().includes('amount')
      );
      const currencyIndex = cleanHeaders.findIndex(h => h.toLowerCase().includes('currency'));
      
      // Determine if this is a valid Splitwise export
      if (dateIndex < 0 || descIndex < 0 || catIndex < 0 || costIndex < 0) {
        throw new Error('Invalid Splitwise CSV format. Please check your export and try again.');
      }

      // Extract participant names from headers (columns after core expense data)
      // In Splitwise export, participant columns are typically after the core expense fields
      const participantStartIndex = Math.max(
        dateIndex, descIndex, catIndex, costIndex, currencyIndex
      ) + 1;
      
      // Get participant names - exclude any summary columns by checking for keywords in headers
      const rawParticipants = cleanHeaders
        .slice(participantStartIndex)
        .filter(h => h && 
                     !h.toLowerCase().includes('total') && 
                     !h.toLowerCase().includes('sum') &&
                     !h.toLowerCase().includes('notes') &&
                     !h.toLowerCase().includes('net balance') &&
                     h.trim() !== '');

      // Process participants to extract names and contact info
      // Splitwise sometimes exports with phone numbers as headers
      const participants = rawParticipants.map(header => {
        let name = header.trim();
        let email = undefined;
        let phone = undefined;
        
        // Check if header is a phone number - improved pattern
        const phonePattern = /^[\+]?[\d\s\-\(\)]{7,}$/;
        const cleanedHeader = header.replace(/\s/g, ''); // Remove spaces for testing
        const hasPlus = header.includes('+');
        const digitsOnly = header.replace(/\D/g, '');
        const isPhoneNumber = (hasPlus && digitsOnly.length >= 7) || phonePattern.test(cleanedHeader);
        
        console.log(`Testing header "${header}" - cleanedHeader: "${cleanedHeader}", hasPlus: ${hasPlus}, digitsOnly: "${digitsOnly}", isPhoneNumber: ${isPhoneNumber}`);
        
        if (isPhoneNumber) {
          // This header is a phone number
          phone = digitsOnly; // Extract digits only
          name = `Contact ${phone.slice(-4)}`; // Create a readable name
          console.log(`Detected phone number header: "${header}" -> phone: ${phone}, name: ${name}`);
        } else {
          // Not a phone number, try to extract contact info from name
          
          // Try to extract email from header (sometimes in parentheses)
          const emailMatch = name.match(/\(([^)]+@[^)]+)\)/);
          if (emailMatch && emailMatch[1]) {
            email = emailMatch[1].trim();
            name = name.replace(emailMatch[0], '').trim();
            console.log(`Extracted email from name: ${email}`);
          }
          
          // Try to extract phone from header if not already identified
          const phoneMatch = name.match(/\((\+?[\d\s\-]{7,})\)/) || name.match(/\((\d{3}[-\s]?\d{3}[-\s]?\d{4})\)/);
          if (phoneMatch && phoneMatch[1]) {
            phone = phoneMatch[1].replace(/\D/g, ''); // Strip non-digits
            name = name.replace(phoneMatch[0], '').trim();
            console.log(`Extracted phone from name: ${phone}`);
          }
        }
        
        const result = { name, email, phone, originalHeader: header };
        console.log(`Processed participant: "${header}" -> name: "${name}", phone: "${phone}", email: "${email}"`);
        return result;
      });

      console.log('Found participants:', participants.map(p => `${p.name} (phone: ${p.phone}, email: ${p.email}, original: "${p.originalHeader}")`));

      console.log('Extracted participant headers:', rawParticipants);
      
      if (participants.length === 0) {
        throw new Error('No participants found in the CSV file');
      }

      // Parse data rows
      const parsed: ParsedCSVData[] = [];
      
      // Skip potential header row (sometimes Splitwise includes two header rows)
      let startRow = 1;
      
      // Check if we need to skip the second row (sometimes contains labels)
      if (lines.length > 2) {
        const secondRowValues = parseCSVLine(lines[1]);
        // If second row has suspicious values like "Total" or isn't properly formatted, skip it
        if (secondRowValues.some(val => 
          val.toLowerCase().includes('total') || 
          val.toLowerCase().includes('sum') ||
          val.includes('------'))) {
          startRow = 2;
        }
      }

      // Process each data row
      for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().includes('total')) continue; // Skip empty or total/summary rows

        const values = parseCSVLine(line);
        
        // Ensure we have enough values for at least core expense data
        if (values.length <= Math.max(dateIndex, descIndex, catIndex, costIndex, currencyIndex)) {
          continue;
        }

        // Extract base expense data using the correct indices
        const date = values[dateIndex].trim();
        const description = values[descIndex].trim();
        const category = values[catIndex].trim();
        
        // Handle amount - parse number from string, handling currency symbols
        const amountStr = values[costIndex].trim();
        const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        
        // Use currency from CSV or default to USD
        let currency = 'USD';
        if (currencyIndex >= 0 && currencyIndex < values.length) {
          currency = values[currencyIndex].trim() || currency;
        }

        // Skip invalid/empty entries
        if (isNaN(amount) || !description || !date) continue;

        // Extract participant data - this is the complex part as we need to match columns to participants
        const participantData = [];
        
        for (let j = 0; j < participants.length; j++) {
          const colIndex = participantStartIndex + j;
          
          // Skip if we don't have this column
          if (colIndex >= values.length) continue;
          
          // Parse the value, handling various formats
          const valueStr = values[colIndex].trim();
          
          // Skip empty values
          if (!valueStr) continue;
          
          // Parse amount from various formats (might include currency symbols)
          const parsedValue = parseFloat(valueStr.replace(/[^0-9.-]/g, ''));
          
          // Check if this is a payment (+) or debt (-)
          const isPayer = !valueStr.includes('-') && parsedValue > 0;
          const isOwed = valueStr.includes('-') || (valueStr.toLowerCase().includes('owes') && parsedValue > 0);

          // Use participant data already parsed with contact info
          const participantInfo = participants[j];
          const name = participantInfo.name;
          const email = participantInfo.email;
          const phone = participantInfo.phone;
          
          if (!isNaN(parsedValue) && parsedValue !== 0) {
            participantData.push({
              name: name.trim(),
              email: email,
              phone: phone,
              paid: isPayer ? Math.abs(parsedValue) : 0,
              owed: isOwed ? Math.abs(parsedValue) : 0
            });
          }
        }

        // Only add expense if it has at least one participant with payment and one participant who owes
        if (participantData.some(p => p.paid > 0) && participantData.some(p => p.owed > 0)) {
          parsed.push({
            date,
            description,
            category,
            amount,
            currency,
            participants: participantData
          });
        }
      }

      // Sort expenses by date (newest first)
      parsed.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setParsedData(parsed);
      
      // Initialize participant selection - default all to true (selected for invitation)
      const uniqueParticipants = new Set<string>();
      parsed.forEach(expense => {
        expense.participants.forEach(p => uniqueParticipants.add(p.name));
      });
      
      console.log(`Successfully parsed ${parsed.length} expenses with ${uniqueParticipants.size} unique participants`);
      console.log('Unique participants found:', Array.from(uniqueParticipants));
      
      const newParticipantSelection = new Map<string, boolean>();
      uniqueParticipants.forEach(name => {
        // Don't auto-select the current user for invitation
        const isCurrentUser = user && 
          (name.toLowerCase().includes(user.fullName.toLowerCase()) || 
          user.fullName.toLowerCase().includes(name.toLowerCase()));
        newParticipantSelection.set(name, !isCurrentUser);
      });
      setParticipantSelection(newParticipantSelection);
      
      // Create a default group name from the file name, or from description of first expense
      if (!groupName) {
        if (fileName) {
          setGroupName(fileName.replace('.csv', '').replace(/[^a-zA-Z0-9\s]/g, ' ') + ' Group');
        } else if (parsed.length > 0) {
          // Try to extract a group name from the data
          // Look for repeated categories or a trip name pattern
          const categories = parsed.map(p => p.category);
          const mostCommonCategory = categories.sort(
            (a, b) => 
              categories.filter(v => v === a).length - 
              categories.filter(v => v === b).length
          ).pop();
          
          setGroupName(`${mostCommonCategory || 'Splitwise'} Group`);
        }
      }

      setProcessingStep('idle');
      setLoading(false);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to parse CSV file');
      setProcessingStep('idle');
      setLoading(false);
    }
  };

  // Helper to parse CSV line considering quoted values - robust implementation
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        // Handle escaped quotes (two double quotes in a row) inside quoted strings
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current);
    
    // Clean up each field - trim and remove surrounding quotes
    return result.map(val => {
      const trimmed = val.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.substring(1, trimmed.length - 1).trim();
      }
      return trimmed;
    });
  };

  // Helper function to find user by email or phone
  const findUserByContact = async (email?: string, phone?: string): Promise<{ id: string; fullName: string; email: string; mobile?: string } | null> => {
    try {
      if (email && email.includes('@')) {
        // Try to find user by email using Firestore query
        const usersQuery = query(
          collection(db, 'users'),
          where('email', '==', email.toLowerCase())
        );
        const userSnapshot = await getDocs(usersQuery);
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userData = userDoc.data();
          return {
            id: userDoc.id,
            fullName: userData.fullName || 'Unknown',
            email: userData.email || '',
            mobile: userData.mobile || ''
          };
        }
      }
      
      if (phone && phone.length >= 10) {
        // Try to find user by mobile using Firestore query
        const cleanPhone = phone.replace(/\D/g, '');
        const usersQuery = query(
          collection(db, 'users'),
          where('mobile', '==', cleanPhone)
        );
        const userSnapshot = await getDocs(usersQuery);
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userData = userDoc.data();
          return {
            id: userDoc.id,
            fullName: userData.fullName || 'Unknown',
            email: userData.email || '',
            mobile: userData.mobile || ''
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding user by contact:', error);
      return null;
    }
  };

  // Helper function to prompt user for missing contact information
  const promptForContactInfo = async (participantName: string): Promise<{ email?: string; phone?: string } | null> => {
    return new Promise((resolve) => {
      Alert.prompt(
        'Add Contact Information',
        `"${participantName}" doesn't have contact info. Please provide an email or phone number to invite them:`,
        [
          {
            text: 'Cancel',
            onPress: () => resolve(null),
            style: 'cancel'
          },
          {
            text: 'Email',
            onPress: () => {
              Alert.prompt(
                'Enter Email',
                `Enter email address for ${participantName}:`,
                [
                  {
                    text: 'Cancel',
                    onPress: () => resolve(null),
                    style: 'cancel'
                  },
                  {
                    text: 'OK',
                    onPress: (email) => {
                      if (email && email.includes('@') && email.includes('.')) {
                        resolve({ email: email.trim().toLowerCase() });
                      } else {
                        Alert.alert('Invalid Email', 'Please enter a valid email address.');
                        resolve(null);
                      }
                    }
                  }
                ],
                'plain-text',
                '',
                'email-address'
              );
            }
          },
          {
            text: 'Phone',
            onPress: () => {
              Alert.prompt(
                'Enter Phone Number',
                `Enter phone number for ${participantName}:`,
                [
                  {
                    text: 'Cancel',
                    onPress: () => resolve(null),
                    style: 'cancel'
                  },
                  {
                    text: 'OK',
                    onPress: (phone) => {
                      if (phone) {
                        const cleanPhone = phone.replace(/\D/g, '');
                        if (cleanPhone.length >= 7) {
                          resolve({ phone: phone.trim() });
                        } else {
                          Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
                          resolve(null);
                        }
                      } else {
                        resolve(null);
                      }
                    }
                  }
                ],
                'plain-text',
                '',
                'phone-pad'
              );
            }
          }
        ],
        'default'
      );
    });
  };

  // Helper function to collect missing contact info for multiple participants
  const collectMissingContactInfo = async (participantsWithoutContact: string[]): Promise<Map<string, { email?: string; phone?: string }>> => {
    const contactInfoMap = new Map<string, { email?: string; phone?: string }>();
    
    if (participantsWithoutContact.length === 0) {
      return contactInfoMap;
    }

    // Show overview first
    const shouldContinue = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Missing Contact Information',
        `${participantsWithoutContact.length} participant(s) don't have email or phone numbers:\n\n${participantsWithoutContact.join(', ')}\n\nWould you like to add contact information for them? (You can skip this and they won't be invited to the group)`,
        [
          {
            text: 'Skip All',
            onPress: () => resolve(false),
            style: 'cancel'
          },
          {
            text: 'Add Contact Info',
            onPress: () => resolve(true)
          }
        ],
        { cancelable: false }
      );
    });

    if (!shouldContinue) {
      return contactInfoMap;
    }

    // Collect contact info for each participant
    for (const participantName of participantsWithoutContact) {
      try {
        console.log(`Prompting for contact info for: ${participantName}`);
        const contactInfo = await promptForContactInfo(participantName);
        
        if (contactInfo) {
          contactInfoMap.set(participantName, contactInfo);
          console.log(`✅ Collected contact info for ${participantName}:`, contactInfo);
        } else {
          console.log(`⏭️ User skipped contact info for ${participantName}`);
        }
      } catch (error) {
        console.error(`Error collecting contact info for ${participantName}:`, error);
      }
    }

    return contactInfoMap;
  };

  const handleImport = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to import data');
      return;
    }

    if (createNewGroup && !groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (!createNewGroup && !selectedGroupId) {
      Alert.alert('Error', 'Please select a group');
      return;
    }

    if (parsedData.length === 0) {
      Alert.alert('Error', 'No valid data to import');
      return;
    }

    try {
      setLoading(true);
      setProcessingStep('importing');

      let targetGroupId = selectedGroupId;
      let targetGroup = null;

      // Step 1: Create new group if needed
      if (createNewGroup) {
        // Create new group with all required fields
        const newGroup = {
          name: groupName.trim(),
          description: `Imported from Splitwise on ${new Date().toLocaleDateString()}`,
          avatar: '💰', // Default icon
          currency: parsedData[0]?.currency || 'USD',
          createdBy: user.id,
          members: [{
            userId: user.id,
            userData: {
              fullName: user.fullName,
              email: user.email,
              avatar: user.profilePicture || '',
            },
            role: 'admin' as const,
            balance: 0,
            joinedAt: new Date(),
            isActive: true,
          }],
          totalExpenses: 0,
          isActive: true,
          inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          settings: {
            allowMemberInvites: true,
            requireApproval: false,
            currency: parsedData[0]?.currency || 'USD',
          }
        };
        
        targetGroupId = await SplittingService.createGroup(newGroup);
        console.log('New group created with ID:', targetGroupId);
      } else {
        // Get existing group data
        targetGroup = existingGroups.find(g => g.id === selectedGroupId);
      }

      // Step 2: Track all unique participants
      const uniqueParticipants = new Set<string>();
      parsedData.forEach(item => {
        item.participants.forEach(p => uniqueParticipants.add(p.name));
      });

      // Step 3: Create or invite friends for each participant
      const mappings = new Map<string, string>(); // Maps name to userId
      const statusMap = new Map<string, 'existing' | 'invited' | 'error'>(); // Status for UI
      const status: ImportStatus = {
        groupsCreated: createNewGroup ? 1 : 0,
        expensesImported: 0,
        friendsInvited: 0,
        errors: 0
      };

      // Collect existing friends first to avoid unnecessary API calls
      const existingFriends = await SplittingService.getFriends(user.id);
      
      // Always add current user - look for matching name patterns in participants
      mappings.set(user.fullName, user.id);
      
      // Find all unique participants with their contact info
      interface ParticipantInfo {
        name: string;
        email?: string;
        phone?: string;
      }
      
      const uniqueParticipantInfo: ParticipantInfo[] = [];
      
      // Collect all unique participants with their contact info from all expenses
      parsedData.forEach(expense => {
        expense.participants.forEach(participant => {
          // Check if this participant name is already in the list
          const existingParticipant = uniqueParticipantInfo.find(p => p.name === participant.name);
          if (!existingParticipant) {
            uniqueParticipantInfo.push({
              name: participant.name,
              email: participant.email,
              phone: participant.phone
            });
          } else {
            // Update existing entry if we have more contact info
            if (participant.email && !existingParticipant.email) {
              existingParticipant.email = participant.email;
            }
            if (participant.phone && !existingParticipant.phone) {
              existingParticipant.phone = participant.phone;
            }
          }
        });
      });
      
      console.log(`Found ${uniqueParticipantInfo.length} unique participants:`, 
        uniqueParticipantInfo.map(p => `"${p.name}" (email: ${p.email || 'none'}, phone: ${p.phone || 'none'})`));
      console.log(`Looking for current user: "${user.fullName}" (email: ${user.email || 'none'}, mobile: ${user.mobile || 'none'})`);
      
      // Try to identify which participant is the current user
      // First check for exact name match
      let currentUserParticipant = uniqueParticipantInfo.find(
        p => p.name.toLowerCase() === user.fullName.toLowerCase()
      );
      
      // If no exact match, check for partial matches with name components
      if (!currentUserParticipant) {
        const userNames = user.fullName.toLowerCase().split(/\s+/);
        currentUserParticipant = uniqueParticipantInfo.find(p => {
          const participantNames = p.name.toLowerCase().split(/\s+/);
          
          // Check if any part of the user's name matches any part of the participant's name
          return userNames.some(userName => 
            participantNames.some(participantName => 
              userName.includes(participantName) || 
              participantName.includes(userName) ||
              userName === participantName
            )
          );
        });
      }
      
      // Enhanced fuzzy matching - check for common name patterns
      if (!currentUserParticipant) {
        const userFirstName = user.fullName.split(' ')[0].toLowerCase();
        const userLastName = user.fullName.split(' ').pop()?.toLowerCase();
        
        console.log(`Enhanced user matching: Looking for "${userFirstName}" / "${userLastName}" in participants`);
        
        currentUserParticipant = uniqueParticipantInfo.find(p => {
          const pName = p.name.toLowerCase();
          const pFirstName = p.name.split(' ')[0].toLowerCase();
          const pLastName = p.name.split(' ').pop()?.toLowerCase();
          
          // Check various name patterns
          const firstNameMatch = pName.includes(userFirstName) || userFirstName.includes(pFirstName) || pFirstName.includes(userFirstName);
          const lastNameMatch = userLastName && pLastName && (pName.includes(userLastName) || userLastName.includes(pLastName) || pLastName.includes(userLastName));
          const reverseMatch = pName.includes(userLastName || '') && pName.includes(userFirstName);
          
          console.log(`Checking "${p.name}": firstNameMatch=${firstNameMatch}, lastNameMatch=${lastNameMatch}, reverseMatch=${reverseMatch}`);
          
          return firstNameMatch || lastNameMatch || reverseMatch;
        });
        
        if (currentUserParticipant) {
          console.log(`Found fuzzy match: "${currentUserParticipant.name}" for user "${user.fullName}"`);
        }
      }
      
      // If still no match, try nickname patterns (first name only, shortened names)
      if (!currentUserParticipant) {
        const userFirstName = user.fullName.split(' ')[0].toLowerCase();
        
        // Try to match just first name or common nicknames
        currentUserParticipant = uniqueParticipantInfo.find(p => {
          const pFirstName = p.name.split(' ')[0].toLowerCase();
          
          // Direct first name match
          if (pFirstName === userFirstName) return true;
          
          // Check if participant name is a substring of user's first name (nicknames)
          if (userFirstName.includes(pFirstName) && pFirstName.length >= 3) return true;
          
          // Check if user's first name is a substring of participant name
          if (pFirstName.includes(userFirstName) && userFirstName.length >= 3) return true;
          
          return false;
        });
        
        if (currentUserParticipant) {
          console.log(`Found nickname match: "${currentUserParticipant.name}" for user "${user.fullName}"`);
        }
      }
      
      // Also try to match by email or phone if available in the current user's profile
      if (!currentUserParticipant && user.email) {
        currentUserParticipant = uniqueParticipantInfo.find(
          p => p.email && p.email.toLowerCase() === user.email?.toLowerCase()
        );
      }
      
      if (!currentUserParticipant && user.mobile) {
        const cleanUserPhone = user.mobile.replace(/\D/g, '');
        currentUserParticipant = uniqueParticipantInfo.find(
          p => p.phone && p.phone.replace(/\D/g, '') === cleanUserPhone
        );
      }
      
      // If still no match, try to identify by who appears as the payer most often
      // This is common in Splitwise exports where the account owner pays most expenses
      if (!currentUserParticipant) {
        const payerCounts = new Map<string, number>();
        const owedCounts = new Map<string, number>();
        
        parsedData.forEach(expense => {
          expense.participants.forEach(participant => {
            if (participant.paid > 0) {
              payerCounts.set(participant.name, (payerCounts.get(participant.name) || 0) + 1);
            }
            if (participant.owed > 0) {
              owedCounts.set(participant.name, (owedCounts.get(participant.name) || 0) + 1);
            }
          });
        });
        
        console.log('Payment analysis - Payer counts:', Object.fromEntries(payerCounts));
        console.log('Payment analysis - Owed counts:', Object.fromEntries(owedCounts));
        
        // Find the most frequent payer
        let mostFrequentPayer = '';
        let maxCount = 0;
        payerCounts.forEach((count, payer) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentPayer = payer;
          }
        });
        
        // Use more generous thresholds for identifying the current user
        if (mostFrequentPayer && (maxCount > parsedData.length * 0.3 || payerCounts.size === 1)) {
          currentUserParticipant = uniqueParticipantInfo.find(p => p.name === mostFrequentPayer);
          if (currentUserParticipant) {
            const reason = payerCounts.size === 1 ? 'only payer' : 'most frequent payer';
            console.log(`Identified current user as ${reason}: ${mostFrequentPayer} (${maxCount}/${parsedData.length} expenses)`);
          }
        }
        
        // Additional check: if someone is primarily a payer and rarely owes money, they're likely the account owner
        if (!currentUserParticipant) {
          const potentialCurrentUser = Array.from(payerCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .find(([name, payCount]) => {
              const owedCount = owedCounts.get(name) || 0;
              return payCount >= owedCount && payCount > 0; // Pays at least as much as they owe
            });
          
          if (potentialCurrentUser) {
            currentUserParticipant = uniqueParticipantInfo.find(p => p.name === potentialCurrentUser[0]);
            if (currentUserParticipant) {
              console.log(`🎯 Identified current user by payment pattern: ${potentialCurrentUser[0]} (pays ${potentialCurrentUser[1]} times vs owes ${owedCounts.get(potentialCurrentUser[0]) || 0} times)`);
            }
          }
        }
      }
      
      // If we still couldn't identify the current user, prompt them to manually select
      if (!currentUserParticipant && uniqueParticipantInfo.length > 0) {
        console.log('🤔 Could not automatically identify current user, prompting for manual selection');
        
        // Create a list of participant options for the user to choose from
        const participantOptions = uniqueParticipantInfo.map(p => p.name);
        participantOptions.push('None of these (skip current user mapping)');
        
        const selectedIndex = await new Promise<number>((resolve) => {
          Alert.alert(
            'Select Your Account',
            `We couldn't automatically identify which participant is you (${user.fullName}). Please select your name from the list:`,
            [
              ...participantOptions.map((name, index) => ({
                text: name,
                onPress: () => resolve(index)
              }))
            ],
            { cancelable: false }
          );
        });
        
        if (selectedIndex < uniqueParticipantInfo.length) {
          currentUserParticipant = uniqueParticipantInfo[selectedIndex];
          console.log(`✅ User manually selected: "${currentUserParticipant.name}" as their account`);
        } else {
          console.log('ℹ️ User chose to skip current user mapping');
        }
      }
      
      // If we found a match for the current user, add it to the mapping
      if (currentUserParticipant) {
        mappings.set(currentUserParticipant.name, user.id);
        statusMap.set(currentUserParticipant.name, 'existing');
        console.log(`✅ Successfully mapped current user "${user.fullName}" to participant "${currentUserParticipant.name}"`);
      } else {
        console.log(`❌ Could not map current user "${user.fullName}" to any participant`);
        console.log(`📋 Available participants: ${uniqueParticipantInfo.map(p => `"${p.name}" (${p.email || 'no email'}, ${p.phone || 'no phone'})`).join(', ')}`);
      }

      // Process each participant to find actual user IDs
      console.log(`Processing ${uniqueParticipantInfo.length} unique participants`);
      
      // First, identify participants with missing contact info who are selected for invitation
      const participantsWithoutContact: string[] = [];
      for (const participant of uniqueParticipantInfo) {
        if (mappings.has(participant.name)) {
          continue; // Skip current user
        }
        
        const isSelected = participantSelection.get(participant.name) || false;
        if (!isSelected) {
          continue; // Skip unselected participants
        }
        
        // Check if participant has valid contact info
        const hasEmail = participant.email && participant.email.includes('@') && participant.email.includes('.');
        const hasPhone = participant.phone && participant.phone.replace(/\D/g, '').length >= 7;
        
        if (!hasEmail && !hasPhone) {
          participantsWithoutContact.push(participant.name);
        }
      }
      
      // Collect missing contact information if needed
      const additionalContactInfo = await collectMissingContactInfo(participantsWithoutContact);
      
      // Update participant info with collected contact details
      for (const [name, contactInfo] of additionalContactInfo) {
        const participant = uniqueParticipantInfo.find(p => p.name === name);
        if (participant) {
          if (contactInfo.email) {
            participant.email = contactInfo.email;
            console.log(`📧 Updated ${name} with email: ${contactInfo.email}`);
          }
          if (contactInfo.phone) {
            participant.phone = contactInfo.phone;
            console.log(`📱 Updated ${name} with phone: ${contactInfo.phone}`);
          }
        }
      }
      
      for (const participant of uniqueParticipantInfo) {
        console.log(`Processing participant: ${participant.name} (email: ${participant.email}, phone: ${participant.phone})`);
        
        // Skip if we've already identified this as the current user
        if (mappings.has(participant.name)) {
          console.log(`Skipping ${participant.name}: Already mapped as current user`);
          continue;
        }

        // Check if this participant is selected for invitation/processing
        const isSelected = participantSelection.get(participant.name) || false;
        console.log(`Participant ${participant.name} selection status: ${isSelected}`);

        try {
          // First, try to find existing friend by contact info
          let existingFriend = null;
          
          if (participant.email) {
            existingFriend = existingFriends.find(
              f => f.friendData.email?.toLowerCase() === participant.email?.toLowerCase()
            );
            if (existingFriend) console.log(`Found existing friend by email: ${participant.name} -> ${existingFriend.friendId}`);
          }
          
          if (!existingFriend) {
            existingFriend = existingFriends.find(
              f => f.friendData.fullName.toLowerCase() === participant.name.toLowerCase() ||
                   f.friendData.fullName.toLowerCase().includes(participant.name.toLowerCase()) ||
                   participant.name.toLowerCase().includes(f.friendData.fullName.toLowerCase())
            );
            if (existingFriend) console.log(`Found existing friend by name: ${participant.name} -> ${existingFriend.friendId}`);
          }
          
          if (!existingFriend && participant.phone) {
            existingFriend = existingFriends.find(
              f => f.friendData.mobile?.replace(/\D/g, '') === participant.phone?.replace(/\D/g, '')
            );
            if (existingFriend) console.log(`Found existing friend by phone: ${participant.name} -> ${existingFriend.friendId}`);
          }

          if (existingFriend) {
            // Use existing friend's ID
            mappings.set(participant.name, existingFriend.friendId);
            statusMap.set(participant.name, 'existing');
            
            // Add to group if creating new group
            if (createNewGroup) {
              await SplittingService.addGroupMember(targetGroupId, existingFriend.friendId);
              console.log(`✅ Added existing friend ${participant.name} to group`);
            }
          } else {
            // Try to find user in database by contact info
            console.log(`No existing friend found, searching database for ${participant.name}`);
            const foundUser = await findUserByContact(participant.email, participant.phone);
            
            if (foundUser) {
              console.log(`Found user in database: ${participant.name} -> ${foundUser.id}`);
              // User exists but is not a friend yet
              if (isSelected) {
                // Send friend request to existing user (always use their email)
                const result = await SplittingService.sendFriendRequest(
                  user.id, 
                  foundUser.email,  // Always use email for found users
                  `I've added you to a group imported from Splitwise.`
                );
                
                if (result.success) {
                  // Use the found user's ID directly
                  mappings.set(participant.name, foundUser.id);
                  statusMap.set(participant.name, 'invited');
                  status.friendsInvited++;
                  
                  // Add to group
                  if (createNewGroup) {
                    await SplittingService.addGroupMember(targetGroupId, foundUser.id);
                    console.log(`✅ Added invited user ${participant.name} to group`);
                  }
                } else {
                  console.warn(`Failed to invite ${participant.name}: ${result.message}`);
                  statusMap.set(participant.name, 'error');
                  status.errors++;
                }
              } else {
                // User exists but not selected - we can still map them for expense creation
                mappings.set(participant.name, foundUser.id);
                statusMap.set(participant.name, 'existing');
                
                // Add to group anyway (they exist in the system)
                if (createNewGroup) {
                  await SplittingService.addGroupMember(targetGroupId, foundUser.id);
                  console.log(`✅ Added unselected user ${participant.name} to group`);
                }
              }
            } else if (isSelected) {
              console.log(`User ${participant.name} not found in database, checking invitation eligibility`);
              // User doesn't exist in the system and is selected for invitation
              let hasValidContact = false;
              let contactValue: string = '';
              
              // Validate email
              if (participant.email && participant.email.includes('@') && participant.email.includes('.')) {
                contactValue = participant.email;
                hasValidContact = true;
                console.log(`Using email for ${participant.name}: ${contactValue}`);
              } 
              // Validate phone - accept any phone with 7+ digits
              else if (participant.phone) {
                const cleanPhone = participant.phone.replace(/\D/g, '');
                if (cleanPhone.length >= 7) {
                  contactValue = participant.phone; // Keep original format with + and spaces
                  hasValidContact = true;
                  console.log(`Using phone for ${participant.name}: ${contactValue} (cleaned: ${cleanPhone})`);
                }
              }
              
              if (hasValidContact) {
                // Handle invitation based on contact type
                if (participant.email && participant.email.includes('@') && participant.email.includes('.')) {
                  // Email-based invitation (standard flow)
                  const result = await SplittingService.sendFriendRequest(
                    user.id, 
                    contactValue, 
                    `I've added you to a group imported from Splitwise.`
                  );
                  
                  if (result.success) {
                    statusMap.set(participant.name, 'invited');
                    status.friendsInvited++;
                    console.log(`📧 Sent email invitation to ${participant.name} at ${contactValue}`);
                  } else {
                    console.warn(`Failed to invite ${participant.name}: ${result.message}`);
                    statusMap.set(participant.name, 'error');
                    status.errors++;
                  }
                } else if (participant.phone) {
                  // Phone-based invitation - check if user exists first
                  const existingUser = await findUserByContact(undefined, participant.phone);
                  
                  if (existingUser) {
                    console.log(`Found existing user by phone: ${existingUser.fullName}, sending friend request to email: ${existingUser.email}`);
                    // User exists, send friend request to their email
                    const result = await SplittingService.sendFriendRequest(
                      user.id, 
                      existingUser.email,
                      `I've added you to a group imported from Splitwise.`
                    );
                    
                    if (result.success) {
                      mappings.set(participant.name, existingUser.id);
                      statusMap.set(participant.name, 'invited');
                      status.friendsInvited++;
                      
                      // Add to group
                      if (createNewGroup) {
                        await SplittingService.addGroupMember(targetGroupId, existingUser.id);
                        console.log(`✅ Added phone-found user ${participant.name} to group`);
                      }
                      console.log(`�➡️�📧 Sent friend request to existing user ${participant.name} via email`);
                    } else {
                      console.warn(`Failed to invite existing user ${participant.name}: ${result.message}`);
                      statusMap.set(participant.name, 'error');
                      status.errors++;
                    }
                  } else {
                    // User doesn't exist, create phone invitation placeholder 
                    // Since sendFriendRequest only accepts emails, we'll use a placeholder email
                    const placeholderEmail = `${participant.phone.replace(/\D/g, '')}@phone.splitwise.import`;
                    console.log(`Creating phone invitation placeholder for ${participant.name}: ${placeholderEmail}`);
                    
                    try {
                      const result = await SplittingService.sendFriendRequest(
                        user.id, 
                        placeholderEmail,
                        `I've added you to a group imported from Splitwise. Your phone: ${participant.phone}`
                      );
                      
                      statusMap.set(participant.name, 'invited');
                      status.friendsInvited++;
                      console.log(`📱 Created phone invitation placeholder for ${participant.name}`);
                    } catch (error) {
                      console.error(`Failed to create phone invitation for ${participant.name}:`, error);
                      statusMap.set(participant.name, 'error');
                      status.errors++;
                    }
                  }
                }
              } else {
                console.warn(`⏭️ Skipping ${participant.name}: No valid contact information provided`);
                statusMap.set(participant.name, 'error');
                status.errors++;
              }
            } else {
              // User doesn't exist and not selected - skip
              console.log(`⏭️ Skipping ${participant.name}: Not selected and no account found`);
              statusMap.set(participant.name, 'error');
            }
          }
        } catch (error) {
          console.error(`❌ Error processing participant ${participant.name}:`, error);
          statusMap.set(participant.name, 'error');
          status.errors++;
        }
      }

      // Store the mappings and status in state for the UI to use
      setParticipantMapping(new Map(mappings));
      setInviteStatusMap(new Map(statusMap));

      console.log('Final participant mappings:', Object.fromEntries(mappings));
      console.log('Participant status map:', Object.fromEntries(statusMap));

      // Check if this is a duplicate import
      if (csvData && fileName) {
        const isDuplicate = checkDuplicateImport(fileName, csvData);
        
        // Check for existing group with similar data as another check
        const existingImport = existingGroups.find(g => 
          g.description?.includes('Imported from Splitwise') && 
          g.description?.includes(fileName.replace('.csv', ''))
        );

        if (isDuplicate || existingImport) {
          const groupName = existingImport ? existingImport.name : 'another group';
          const continueImport = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Duplicate Import Detected',
              `It appears you have already imported this file${existingImport ? ` as group "${groupName}"` : ''}. Importing the same file multiple times can cause duplicate expenses.`,
              [
                { text: 'Cancel Import', onPress: () => resolve(false) },
                { text: 'Continue Anyway', onPress: () => resolve(true) }
              ],
              { cancelable: false }
            );
          });
          
          if (!continueImport) {
            setLoading(false);
            setProcessingStep('idle');
            return;
          }
        }
        
        // Add import info to group description
        if (createNewGroup) {
          // Add the file info to the group description for visibility
          const enhancedDescription = `Imported from Splitwise on ${new Date().toLocaleDateString()} - File: ${fileName}`;
          // If we had an updateGroup API:
          // await SplittingService.updateGroupDescription(targetGroupId, enhancedDescription);
        }
      }

      // Step 4: Create expenses
      console.log(`Starting expense creation for ${parsedData.length} expenses`);
      console.log(`Available participant mappings: ${mappings.size} participants mapped`);
      
      for (const expense of parsedData) {
        try {
          console.log(`Processing expense: ${expense.description}`);
          console.log(`Participants:`, expense.participants.map(p => `${p.name} (paid: ${p.paid}, owed: ${p.owed})`));
          
          // Find who paid (positive value)
          const payer = expense.participants.find(p => p.paid > 0);
          if (!payer) {
            console.warn(`Skipping expense ${expense.description}: No payer found`);
            status.errors++;
            continue;
          }

          const payerId = mappings.get(payer.name);
          if (!payerId) {
            console.warn(`Skipping expense ${expense.description}: Payer ID not found for ${payer.name}`);
            console.warn(`Available mappings:`, Array.from(mappings.entries()));
            status.errors++;
            continue;
          }

          console.log(`Found payer ID for ${payer.name}: ${payerId}`);

          // Create properly formatted splits based on the ExpenseSplit interface
          const splits: ExpenseSplit[] = [];
          
          for (const participant of expense.participants.filter(p => p.owed > 0)) {
            const userId = mappings.get(participant.name);
            if (!userId) {
              console.warn(`Skipping participant ${participant.name} in expense ${expense.description}: No user ID found`);
              continue;
            }
            
            splits.push({
              userId,
              amount: participant.owed,
              isPaid: false,
            });
            console.log(`Added split for ${participant.name} (${userId}): $${participant.owed}`);
          }

          if (splits.length === 0) {
            console.warn(`Skipping expense ${expense.description}: No valid splits found`);
            status.errors++;
            continue;
          }

          console.log(`Creating expense with ${splits.length} splits for group ${targetGroupId}`);
          
          // Create the expense with the correct interface structure
          const expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
            groupId: targetGroupId,
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            category: expense.category,
            categoryIcon: getCategoryIcon(expense.category),
            paidBy: payerId,
            paidByData: {
              fullName: payer.name,
              email: ''
            },
            splitType: 'custom' as const,
            splitData: splits,
            date: new Date(expense.date),
            isSettled: false,
            tags: ['imported', 'splitwise'],
            notes: '',
            isSettlementTransaction: false
          };

          await SplittingService.addExpense(expenseData);
          console.log(`✅ Successfully created expense: ${expense.description}`);
          status.expensesImported++;
        } catch (error) {
          console.error(`❌ Error creating expense ${expense.description}:`, error);
          status.errors++;
        }
      }

      console.log('Import completed with status:', {
        groupsCreated: status.groupsCreated,
        expensesImported: status.expensesImported,
        friendsInvited: status.friendsInvited,
        errors: status.errors,
        participantsMapped: mappings.size
      });

      setImportStatus(status);
      
      // Update UI
      setLoading(false);
      setProcessingStep('idle');

      // Notify parent component if needed
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert(
        'Import Error', 
        error instanceof Error ? error.message : 'An error occurred during import'
      );
      setLoading(false);
      setProcessingStep('idle');
    }
  };

  // Get a category icon for a given category
  const getCategoryIcon = (category: string): string => {
    const categoryIcons: Record<string, string> = {
      groceries: '🛒',
      dining: '🍽️',
      restaurant: '🍽️',
      food: '🍕',
      transport: '🚗',
      travel: '✈️',
      trip: '✈️',
      entertainment: '🎬',
      utilities: '💡',
      rent: '🏠',
      shopping: '🛍️',
      general: '📝',
      other: '📦'
    };
    
    const lowerCategory = category.toLowerCase();
    
    for (const [key, icon] of Object.entries(categoryIcons)) {
      if (lowerCategory.includes(key)) {
        return icon;
      }
    }
    
    return '📝'; // Default icon
  };
  
  const renderFileSelection = () => (
    <View style={[styles.section, { borderColor: theme.colors.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Select Splitwise Export File
      </Text>
      
      {!fileSelected ? (
        <TouchableOpacity
          style={[styles.uploadButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          onPress={handleSelectFile}
          disabled={loading}
        >
          <Ionicons name="document-outline" size={32} color={theme.colors.primary} />
          <Text style={[styles.uploadText, { color: theme.colors.text }]}>
            Tap to select your Splitwise CSV export
          </Text>
          <Text style={[styles.uploadSubtext, { color: theme.colors.textSecondary }]}>
            Export your data from Splitwise website and upload it here
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.selectedFile, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.fileInfo}>
            <Ionicons name="document-text-outline" size={24} color={theme.colors.primary} />
            <View style={styles.fileDetails}>
              <Text style={[styles.fileName, { color: theme.colors.text }]} numberOfLines={1}>
                {fileName}
              </Text>
              {parsedData.length > 0 ? (
                <Text style={[styles.fileStatus, { color: theme.colors.success }]}>
                  {parsedData.length} expenses ready to import
                </Text>
              ) : (
                <Text style={[styles.fileStatus, { color: theme.colors.warning }]}>
                  {loading ? 'Parsing file...' : 'No valid expenses found'}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleSelectFile} disabled={loading}>
            <Text style={[styles.changeButton, { color: theme.colors.primary }]}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          To get your Splitwise export, log in to Splitwise website, go to Your Account &gt; Export your data, and select CSV format.
        </Text>
      </View>
    </View>
  );

  const renderGroupSelection = () => {
    if (!fileSelected || parsedData.length === 0) return null;
    
    return (
      <View style={[styles.section, { borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Import Destination
        </Text>
        
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              createNewGroup && { backgroundColor: theme.colors.primary + '20' }
            ]}
            onPress={() => setCreateNewGroup(true)}
          >
            <View style={styles.radioContainer}>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: createNewGroup ? theme.colors.primary : theme.colors.border }
                ]}
              >
                {createNewGroup && (
                  <View 
                    style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} 
                  />
                )}
              </View>
              <Text style={[styles.optionText, { color: theme.colors.text }]}>
                Create a new group
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.optionButton,
              !createNewGroup && { backgroundColor: theme.colors.primary + '20' }
            ]}
            onPress={() => setCreateNewGroup(false)}
          >
            <View style={styles.radioContainer}>
              <View 
                style={[
                  styles.radioOuter,
                  { borderColor: !createNewGroup ? theme.colors.primary : theme.colors.border }
                ]}
              >
                {!createNewGroup && (
                  <View
                    style={[styles.radioInner, { backgroundColor: theme.colors.primary }]}
                  />
                )}
              </View>
              <Text style={[styles.optionText, { color: theme.colors.text }]}>
                Add to existing group
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        
        {createNewGroup ? (
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Group Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                }
              ]}
              placeholder="Enter group name"
              placeholderTextColor={theme.colors.textSecondary}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Select Group</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupList}
            >
              {existingGroups.length === 0 ? (
                <Text style={[styles.noGroupsText, { color: theme.colors.textSecondary }]}>
                  No groups found. Create a new one instead.
                </Text>
              ) : (
                existingGroups.map(group => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupItem,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: selectedGroupId === group.id 
                          ? theme.colors.primary 
                          : theme.colors.border
                      }
                    ]}
                    onPress={() => setSelectedGroupId(group.id)}
                  >
                    <Text style={styles.groupIcon}>{group.avatar}</Text>
                    <Text 
                      style={[styles.groupName, { color: theme.colors.text }]}
                      numberOfLines={1}
                    >
                      {group.name}
                    </Text>
                    <Text style={[styles.memberCount, { color: theme.colors.textSecondary }]}>
                      {group.members.length} members
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderImportPreview = () => {
    if (!fileSelected || parsedData.length === 0) return null;

    return (
      <View style={[styles.section, { borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Import Preview
        </Text>

        <View style={[styles.previewCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: theme.colors.text }]}>
              {parsedData.length} Expenses
            </Text>
            <Text style={[styles.previewSubtitle, { color: theme.colors.textSecondary }]}>
              {(() => {
                const uniqueParticipants = new Set<string>();
                parsedData.forEach(expense => {
                  expense.participants.forEach(p => uniqueParticipants.add(p.name));
                });
                return uniqueParticipants.size;
              })()} Unique Participants
            </Text>
          </View>

          <ScrollView
            style={styles.expensesPreview}
            nestedScrollEnabled
          >
            {parsedData.slice(0, 5).map((expense, i) => (
              <View 
                key={i} 
                style={[
                  styles.expenseItem,
                  i < parsedData.slice(0, 5).length - 1 && 
                  { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                ]}
              >
                <View style={styles.expenseHeader}>
                  <View style={styles.expenseIconContainer}>
                    <Text style={styles.expenseIcon}>
                      {getCategoryIcon(expense.category)}
                    </Text>
                  </View>
                  <View style={styles.expenseDetails}>
                    <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
                      {expense.description}
                    </Text>
                    <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
                      {expense.date}
                    </Text>
                  </View>
                  <View style={styles.expenseAmount}>
                    <Text style={[styles.expenseAmountText, { color: theme.colors.text }]}>
                      {expense.currency} {expense.amount.toFixed(2)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.expenseParticipants}>
                  {expense.participants.map((p, j) => {
                    // Check if this is current user
                    const isCurrentUser = user && p.name.toLowerCase().includes(user.fullName.toLowerCase()) || 
                                         user?.fullName.toLowerCase().includes(p.name.toLowerCase());
                    
                    // Build participant display info
                    let contactInfo = '';
                    if (p.email) contactInfo += ` (${p.email})`;
                    if (p.phone) contactInfo += ` (${p.phone})`;

                    const amountDisplay = p.paid > 0 ? 
                      `+${p.paid.toFixed(2)}` : 
                      p.owed > 0 ? `-${p.owed.toFixed(2)}` : '0';

                    return (
                      <View 
                        key={j} 
                        style={[
                          styles.participantBadge,
                          { 
                            backgroundColor: isCurrentUser ? 
                              theme.colors.primary + '20' : 
                              theme.colors.surface,
                            borderColor: p.paid > 0 ? 
                              theme.colors.success : 
                              p.owed > 0 ? theme.colors.error : theme.colors.border
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.participantName,
                            { color: theme.colors.text }
                          ]}
                          numberOfLines={1}
                        >
                          {p.name} {isCurrentUser && '(You)'}
                        </Text>
                        <Text
                          style={[
                            styles.participantAmount,
                            { 
                              color: p.paid > 0 ? 
                                theme.colors.success : 
                                p.owed > 0 ? theme.colors.error : theme.colors.textSecondary 
                            }
                          ]}
                        >
                          {amountDisplay}
                        </Text>
                        {(p.email || p.phone) && (
                          <Text 
                            style={[styles.participantContact, { color: theme.colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {p.email || p.phone}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
            
            {parsedData.length > 5 && (
              <Text style={[styles.moreItemsText, { color: theme.colors.textSecondary }]}>
                +{parsedData.length - 5} more expenses
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderParticipantMapping = () => {
    if (!fileSelected || parsedData.length === 0) return null;
    
    // Get unique participants from all expenses
    const uniqueParticipants = new Set<string>();
    parsedData.forEach(item => {
      item.participants.forEach(p => uniqueParticipants.add(p.name));
    });
    
    // Convert to array for rendering
    const participants = Array.from(uniqueParticipants);
    
    const toggleParticipantSelection = (name: string) => {
      const newSelection = new Map(participantSelection);
      newSelection.set(name, !newSelection.get(name));
      setParticipantSelection(newSelection);
    };
    
    const selectAllParticipants = () => {
      const newSelection = new Map<string, boolean>();
      participants.forEach(name => {
        const isCurrentUser = user && 
          (name.toLowerCase().includes(user.fullName.toLowerCase()) || 
          user.fullName.toLowerCase().includes(name.toLowerCase()));
        newSelection.set(name, !isCurrentUser); // Don't select current user
      });
      setParticipantSelection(newSelection);
    };
    
    const deselectAllParticipants = () => {
      const newSelection = new Map<string, boolean>();
      participants.forEach(name => {
        newSelection.set(name, false);
      });
      setParticipantSelection(newSelection);
    };
    
    return (
      <View style={[styles.section, { borderColor: theme.colors.border }]}>
        <View style={styles.participantHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Participant Mapping
          </Text>
          <View style={styles.selectAllButtons}>
            <TouchableOpacity 
              style={[styles.selectButton, { backgroundColor: theme.colors.primary }]}
              onPress={selectAllParticipants}
            >
              <Text style={styles.selectButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.selectButton, { backgroundColor: theme.colors.secondary, marginLeft: 8 }]}
              onPress={deselectAllParticipants}
            >
              <Text style={styles.selectButtonText}>Deselect All</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={[styles.helpText, { color: theme.colors.textSecondary, marginBottom: 16 }]}>
          Select participants to invite. Existing friends will be added automatically.
        </Text>
        
        <View style={[styles.selectionSummary, { backgroundColor: theme.colors.primary + '10' }]}>
          <Text style={[styles.selectionSummaryText, { color: theme.colors.text }]}>
            {Array.from(participantSelection.values()).filter(Boolean).length} of {participants.length - (participants.some(name => 
              user && (name.toLowerCase().includes(user.fullName.toLowerCase()) || 
              user.fullName.toLowerCase().includes(name.toLowerCase()))
            ) ? 1 : 0)} participants selected for invitation
          </Text>
        </View>
        
        <View style={[styles.previewCard, { backgroundColor: theme.colors.surface }]}>
          <ScrollView
            style={styles.participantsList}
            nestedScrollEnabled
          >
            {participants.map((name, i) => {
              // Determine if this might be the current user
              const isCurrentUser = user && 
                (name.toLowerCase().includes(user.fullName.toLowerCase()) || 
                user.fullName.toLowerCase().includes(name.toLowerCase()));
                
              // Try to find participant with this name in the parsed data for contact info
              const participant = parsedData.flatMap(e => e.participants)
                .find(p => p.name === name);
              
              const contactInfo = participant?.email || participant?.phone || '';
              const isSelected = participantSelection.get(name) || false;
              
              // Determine status
              let status = 'Will Invite';
              let statusColor = theme.colors.primary;
              
              if (isCurrentUser) {
                status = 'Current User';
                statusColor = theme.colors.success;
              } else if (inviteStatusMap.get(name) === 'existing') {
                status = 'Existing Friend';
                statusColor = theme.colors.success;
              } else if (inviteStatusMap.get(name) === 'invited') {
                status = 'Invited';
                statusColor = theme.colors.warning;
              } else if (inviteStatusMap.get(name) === 'error') {
                status = 'Error';
                statusColor = theme.colors.error;
              } else if (!isSelected) {
                status = 'Not Selected';
                statusColor = theme.colors.textSecondary;
              }
              
              return (
                <View 
                  key={i}
                  style={[
                    styles.participantMappingItem,
                    { 
                      borderBottomWidth: i < participants.length - 1 ? 1 : 0, 
                      borderBottomColor: theme.colors.border,
                      backgroundColor: isCurrentUser ? theme.colors.primary + '10' : undefined
                    }
                  ]}
                >
                  <View style={styles.participantInfo}>
                    <View style={styles.participantNameRow}>
                      {!isCurrentUser && (
                        <TouchableOpacity
                          style={[
                            styles.checkbox,
                            { 
                              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                              backgroundColor: isSelected ? theme.colors.primary : 'transparent'
                            }
                          ]}
                          onPress={() => toggleParticipantSelection(name)}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="white" />
                          )}
                        </TouchableOpacity>
                      )}
                      <Text style={[styles.participantMappingName, { color: theme.colors.text }]}>
                        {name} {isCurrentUser && '(You)'}
                      </Text>
                    </View>
                    {contactInfo ? (
                      <Text style={[styles.participantMappingContact, { color: theme.colors.textSecondary }]}>
                        {contactInfo}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.participantStatus, { borderColor: statusColor }]}>
                    <Text 
                      style={[
                        styles.participantStatusText,
                        { color: statusColor }
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderImportStatus = () => {
    if (!importStatus) return null;
    
    return (
      <View style={[styles.statusContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
          Import Complete
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>
              {importStatus.groupsCreated}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Groups Created
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.success }]}>
              {importStatus.expensesImported}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Expenses Imported
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.warning }]}>
              {importStatus.friendsInvited}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Friends Invited
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.error }]}>
              {importStatus.errors}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Errors
            </Text>
          </View>
        </View>

        <View style={styles.successImageContainer}>
          <Image
            source={{ uri: 'https://i.imgur.com/JXJ8Jbs.gif' }}
            style={styles.successImage}
            resizeMode="contain"
          />
        </View>
        
        <Button
          title="Done"
          onPress={onClose}
          style={styles.doneButton}
        />
      </View>
    );
  };

  const renderLoadingState = () => {
    if (!loading) return null;
    
    let message = 'Processing...';
    
    switch (processingStep) {
      case 'picking':
        message = 'Selecting file...';
        break;
      case 'parsing':
        message = 'Parsing CSV data...';
        break;
      case 'importing':
        message = 'Importing data...';
        break;
    }
    
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background + 'E6' }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.colors.surface }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            {message}
          </Text>
        </View>
      </View>
    );
  };

  const renderFooterButtons = () => {
    if (importStatus) {
      return null;
    }
    
    const canImport = 
      fileSelected && 
      parsedData.length > 0 && 
      (createNewGroup ? groupName.trim() !== '' : selectedGroupId !== '');
    
    return (
      <View style={styles.footerButtons}>
        <Button
          title="Cancel"
          onPress={onClose}
          variant="outline"
          style={styles.footerButton}
          disabled={loading}
        />
        <Button
          title="Import"
          onPress={handleImport}
          style={styles.footerButton}
          disabled={!canImport || loading}
          loading={loading && processingStep === 'importing'}
        />
      </View>
    );
  };

  // Check for duplicate imports
  const checkDuplicateImport = useCallback((fileName: string, content: string): boolean => {
    if (!fileName || !content) return false;
    
    // Generate a simple hash based on file content
    const generateSimpleHash = (str: string): string => {
      let hash = 0;
      for (let i = 0; i < Math.min(str.length, 1000); i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(36);
    };
    
    const contentHash = generateSimpleHash(content);
    
    // Check if we've seen this file before
    const duplicate = importFingerprints.some(
      fp => fp.fileName === fileName || fp.contentHash === contentHash
    );
    
    // If not a duplicate, add to our history
    if (!duplicate) {
      setImportFingerprints([
        ...importFingerprints,
        { fileName, contentHash, importDate: new Date() }
      ]);
    }
    
    return duplicate;
  }, [importFingerprints]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={loading ? undefined : onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Import from Splitwise
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.content} 
          keyboardShouldPersistTaps="handled"
        >
          {importStatus ? renderImportStatus() : (
            <>
              {renderFileSelection()}
              {renderGroupSelection()}
              {renderImportPreview()}
              {renderParticipantMapping()}
              
              {/* Help section */}
              <View style={[styles.section, { borderBottomWidth: 0 }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  How to Export from Splitwise
                </Text>
                <View style={[styles.helpCard, { backgroundColor: theme.colors.surface }]}>
                  <View style={styles.helpStep}>
                    <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={[styles.helpText, { color: theme.colors.text }]}>
                      Log in to your Splitwise account on the web
                    </Text>
                  </View>
                  
                  <View style={styles.helpStep}>
                    <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={[styles.helpText, { color: theme.colors.text }]}>
                      Go to Your Account &gt; Export your data
                    </Text>
                  </View>
                  
                  <View style={styles.helpStep}>
                    <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={[styles.helpText, { color: theme.colors.text }]}>
                      Select CSV format and download your data
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          {renderFooterButtons()}
        </View>

        {renderLoadingState()}
      </SafeAreaView>
    </Modal>
  );
}

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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
    borderBottomWidth: 1,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  uploadButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  selectedFile: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '500',
  },
  fileStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  parseButton: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  changeButton: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  optionsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  optionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  groupList: {
    paddingVertical: 8,
    paddingRight: 16,
    gap: 12,
  },
  groupItem: {
    width: 120,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  groupIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  memberCount: {
    fontSize: 12,
    marginTop: 4,
  },
  noGroupsText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  previewCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  expensesPreview: {
    maxHeight: 300,
  },
  expenseItem: {
    padding: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseIconContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseIcon: {
    fontSize: 20,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  expenseDate: {
    fontSize: 12,
    marginTop: 2,
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  expenseAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  expenseParticipants: {
    marginTop: 8,
    paddingLeft: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantText: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  participantBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 3,
    marginRight: 6,
    borderWidth: 1,
    minWidth: '45%',
  },
  participantName: {
    fontSize: 13,
    fontWeight: '500',
  },
  participantAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  participantContact: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.8,
  },
  moreItemsText: {
    textAlign: 'center',
    padding: 16,
    fontSize: 14,
    fontStyle: 'italic',
  },
  helpCard: {
    borderRadius: 12,
    padding: 16,
  },
  helpStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: 'white',
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    padding: 20,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: '60%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  statusContainer: {
    borderRadius: 16,
    padding: 24,
    marginVertical: 20,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    marginBottom: 16,
    minWidth: '40%',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  successImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginVertical: 16,
  },
  successImage: {
    width: '100%',
    height: '100%',
  },
  doneButton: {
    marginTop: 16,
  },
  participantsList: {
    maxHeight: 200,
  },
  participantMappingItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantInfo: {
    flex: 1,
  },
  participantMappingName: {
    fontSize: 14,
    fontWeight: '500',
  },
  participantMappingContact: {
    fontSize: 12,
    marginTop: 4,
  },
  participantStatus: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  participantStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectAllButtons: {
    flexDirection: 'row',
  },
  selectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selectButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionSummary: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectionSummaryText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
