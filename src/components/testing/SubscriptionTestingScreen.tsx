// src/components/testing/SubscriptionTestingScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { SubscriptionTestUtils } from '@/utils/testing/SubscriptionTestUtils';

export default function SubscriptionTestingScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testUserId, setTestUserId] = useState(user?.id || '');
  const [results, setResults] = useState<any>(null);

  const testingOptions = SubscriptionTestUtils.getTestingMenu();

  const runTest = async (option: any) => {
    if (!testUserId.trim()) {
      Alert.alert('Error', 'Please enter a user ID to test with');
      return;
    }

    setLoading(true);
    try {
      await option.action(testUserId);
      
      // Get updated status
      const access = await SubscriptionTestUtils.testFeatureAccess(testUserId);
      const summary = await SubscriptionTestUtils.getTestingSummary(testUserId);
      
      setResults({
        access,
        summary,
        timestamp: new Date().toLocaleString()
      });
      
      Alert.alert('Success', `${option.name} completed successfully!`);
    } catch (error) {
      console.error('Test error:', error);
      Alert.alert('Error', `Failed to run ${option.name}: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!testUserId.trim()) return;

    setLoading(true);
    try {
      const access = await SubscriptionTestUtils.testFeatureAccess(testUserId);
      const summary = await SubscriptionTestUtils.getTestingSummary(testUserId);
      
      setResults({
        access,
        summary,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      console.error('Refresh error:', error);
      Alert.alert('Error', `Failed to refresh status: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateUpgrade = async () => {
    if (!testUserId.trim()) {
      Alert.alert('Error', 'Please enter a user ID to test with');
      return;
    }

    setLoading(true);
    try {
      const success = await SubscriptionTestUtils.simulateUpgrade(testUserId);
      if (success) {
        Alert.alert('Success', 'Subscription upgrade simulated successfully!');
        refreshStatus();
      } else {
        Alert.alert('Error', 'Failed to simulate subscription upgrade');
      }
    } catch (error) {
      console.error('Upgrade simulation error:', error);
      Alert.alert('Error', `Failed to simulate upgrade: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const cleanupUser = async () => {
    if (!testUserId.trim()) {
      Alert.alert('Error', 'Please enter a user ID to test with');
      return;
    }

    Alert.alert(
      'Confirm Cleanup',
      'This will reset the user to free subscription. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await SubscriptionTestUtils.cleanupTestUser(testUserId);
              setResults(null);
              Alert.alert('Success', 'User data cleaned up successfully!');
            } catch (error) {
              Alert.alert('Error', `Failed to cleanup: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (isPremium: boolean) => {
    return isPremium ? '#10B981' : '#6B7280';
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Subscription Testing
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Test different subscription states and features
        </Text>
      </View>

      {/* User ID Input */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          User ID for Testing
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            }
          ]}
          placeholder="Enter user ID to test with"
          placeholderTextColor={theme.colors.textSecondary}
          value={testUserId}
          onChangeText={setTestUserId}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Quick Actions
        </Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: theme.colors.primary }]}
            onPress={refreshStatus}
            disabled={loading}
          >
            <Ionicons name="refresh" size={16} color="white" />
            <Text style={styles.quickButtonText}>Refresh Status</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: '#10B981' }]}
            onPress={simulateUpgrade}
            disabled={loading}
          >
            <Ionicons name="arrow-up" size={16} color="white" />
            <Text style={styles.quickButtonText}>Simulate Upgrade</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: '#EF4444' }]}
            onPress={cleanupUser}
            disabled={loading}
          >
            <Ionicons name="trash" size={16} color="white" />
            <Text style={styles.quickButtonText}>Cleanup</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Test Options */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Subscription Test Scenarios
        </Text>
        {testingOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.testOption, { backgroundColor: theme.colors.surface }]}
            onPress={() => runTest(option)}
            disabled={loading}
          >
            <View style={styles.optionContent}>
              <Text style={[styles.optionName, { color: theme.colors.text }]}>
                {option.name}
              </Text>
              <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                {option.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {results && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Current Status
          </Text>
          <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
            Updated: {results.timestamp}
          </Text>
          
          <View style={[styles.statusCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.statusHeader}>
              <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
                Subscription Status
              </Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(results.access.isPremium) }
              ]}>
                <Text style={styles.statusBadgeText}>
                  {results.access.isPremium ? 'PREMIUM' : 'FREE'}
                </Text>
              </View>
            </View>

            <View style={styles.limitsContainer}>
              <View style={styles.limitItem}>
                <Text style={[styles.limitLabel, { color: theme.colors.textSecondary }]}>
                  Groups
                </Text>
                <Text style={[styles.limitValue, { color: theme.colors.text }]}>
                  {results.access.groupLimits.currentCount}/{results.access.groupLimits.limit === -1 ? '∞' : results.access.groupLimits.limit}
                </Text>
              </View>
              
              <View style={styles.limitItem}>
                <Text style={[styles.limitLabel, { color: theme.colors.textSecondary }]}>
                  Transactions Today
                </Text>
                <Text style={[styles.limitValue, { color: theme.colors.text }]}>
                  {results.access.transactionLimits.currentCount}/{results.access.transactionLimits.limit === -1 ? '∞' : results.access.transactionLimits.limit}
                </Text>
              </View>
            </View>

            <View style={styles.featuresContainer}>
              <Text style={[styles.featuresTitle, { color: theme.colors.text }]}>
                Premium Features
              </Text>
              {Object.entries(results.access.features).map(([feature, enabled]) => (
                <View key={feature} style={styles.featureItem}>
                  <Ionicons 
                    name={enabled ? "checkmark-circle" : "close-circle"} 
                    size={16} 
                    color={enabled ? '#10B981' : '#EF4444'} 
                  />
                  <Text style={[
                    styles.featureText,
                    { color: enabled ? theme.colors.text : theme.colors.textSecondary }
                  ]}>
                    {feature.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Running test...
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  quickButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  testOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
  },
  statusCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  limitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  limitItem: {
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  limitValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  featuresContainer: {
    marginTop: 8,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
