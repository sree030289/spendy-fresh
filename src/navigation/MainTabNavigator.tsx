// src/navigation/MainTabNavigator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { Icon } from '../components/common/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { GRADIENTS } from '@/constants/theme';
import { ApiService } from '@/services/api/ApiService';
import { SubscriptionHelper } from '@/utils/SubscriptionHelper';

// Import modals
import UnifiedActionModal from '@/components/modals/UnifiedActionModal';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';
import { Group, Friend } from '@/services/firebase/splitting-disabled';

const Tab = createBottomTabNavigator();

// Custom Plus Button Component
function PlusTabButton({ children, onPress }: any) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity
      style={[styles.plusButton, { 
        shadowColor: theme.colors.primary,
      }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
        style={styles.plusGradient}
      >
        <Icon name="add" size={36} color="white"  />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Tab routes configuration (excluding the center action button)


// Custom Tab Navigator with Enhanced Button Animations
function MainTabNavigatorComponent() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const apiService = ApiService.getInstance();
  const [showActionModal, setShowActionModal] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showGmailSync, setShowGmailSync] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const navigation = useNavigation();
  
  // Tab animation for smooth transitions
  const tabSlideAnimation = useRef(new Animated.Value(0)).current;
  
  // Fetch groups and friends data
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        const [userGroups, userFriends] = await Promise.all([
          apiService.getUserGroups(),
          apiService.getFriends()
        ]);
        
        // Ensure we always set arrays
        setGroups(Array.isArray(userGroups) ? userGroups : []);
        setFriends(Array.isArray(userFriends) ? userFriends : []);
      } catch (error) {
        console.error('Error loading groups and friends in MainTabNavigator:', error);
        // Set empty arrays to ensure components don't get undefined props
        setGroups([]);
        setFriends([]);
      }
    };
    
    loadData();
  }, [user?.id]);

  // Listen for tab press events to trigger animations
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      // Trigger slide animation when any tab is pressed
      Animated.sequence([
        Animated.timing(tabSlideAnimation, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(tabSlideAnimation, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return unsubscribe;
  }, [navigation, tabSlideAnimation]);
  
  const handleAddExpense = async (expenseData: any) => {
    console.log('📨 MainTabNavigator - Received expense data:', {
      hasReceipt: !!expenseData.receipt,
      receiptData: expenseData.receipt
    });
    
    try {
      if (!user?.id) return;
      
      // Process receipt upload if present
      let processedData = { ...expenseData };
      if (expenseData.receipt && expenseData.receipt.imageUri) {
        console.log('🔍 Processing receipt upload for expense via API...');
        try {
          const uploadResult = await apiService.uploadReceiptImage(expenseData.receipt.imageUri);
          processedData.receiptUrl = uploadResult.receiptUrl;
          console.log('✅ Receipt uploaded successfully:', uploadResult.receiptUrl);
        } catch (receiptError) {
          console.error('❌ Receipt upload failed:', receiptError);
          // Continue without receipt URL
          Alert.alert(
            'Receipt Upload Failed',
            'The expense was created but the receipt could not be uploaded.',
            [{ text: 'OK' }]
          );
        }
        // Remove the receipt object as it's processed
        delete processedData.receipt;
      }
      
      const response = await apiService.addExpense({
        ...processedData,
        isSettled: false,
        date: new Date()
      });
      
      console.log('✅ Expense added successfully from quick action:', response.id);
      
      // Refresh data
      const [userGroups, userFriends] = await Promise.all([
        apiService.getUserGroups(),
        apiService.getFriends()
      ]);
      
      // Ensure we always set arrays
      setGroups(Array.isArray(userGroups) ? userGroups : []);
      setFriends(Array.isArray(userFriends) ? userFriends : []);
      setShowAddExpense(false);
      
    } catch (error) {
      console.error('❌ Error adding expense from quick action:', error);
      // Ensure arrays are set even on error
      try {
        const [userGroups, userFriends] = await Promise.all([
          apiService.getUserGroups(),
          apiService.getFriends()
        ]);
        setGroups(Array.isArray(userGroups) ? userGroups : []);
        setFriends(Array.isArray(userFriends) ? userFriends : []);
      } catch (refreshError) {
        console.error('❌ Error refreshing data after expense error:', refreshError);
        setGroups([]);
        setFriends([]);
      }
      // Could show an alert here
    }
  };
  
  const handleActionSelect = async (actionId: string) => {
    console.log('🎯 Handling action in MainTabNavigator:', actionId);
    
    switch (actionId) {
      case 'split-expense':
        // 🚨 CRITICAL FIX: Check subscription limits BEFORE opening expense modal
        if (!user?.id) {
          console.log('❌ No user ID found for expense modal');
          return;
        }
        
        try {
          console.log('🔍 Checking subscription limits for tab navigator expense modal...');
          const subscriptionHelper = SubscriptionHelper.getInstance();
          const canCreate = await subscriptionHelper.canCreateTransaction(user.id);
          
          if (!canCreate) {
            console.log('🚫 Subscription limit reached - expense modal blocked in tab navigator');
            return;
          }
          
          console.log('✅ Subscription check passed - opening expense modal in tab navigator');
          // Refresh data before opening modal
          apiService.getUserGroups().then(setGroups).catch(console.error);
          apiService.getFriends().then(setFriends).catch(console.error);
          setShowAddExpense(true);
        } catch (error) {
          console.error('❌ Error checking subscription in tab navigator:', error);
          // Still allow opening the modal if subscription check fails
          apiService.getUserGroups().then(setGroups).catch(console.error);
          apiService.getFriends().then(setFriends).catch(console.error);
          setShowAddExpense(true);
        }
        break;
      case 'smart-expense':
        // Navigate to Money Management tab
        navigation.dispatch(
          CommonActions.navigate({
            name: 'MoneyManagement'
          })
        );
        break;
      case 'reminder':
        setShowReminder(true);
        break;
      case 'gmail-sync':
        setShowGmailSync(true);
        break;
      default:
        console.log('❓ Unknown action:', actionId);
    }
  };
  

  // Enhanced Action Modal Component
  const ActionModal = () => (
    <UnifiedActionModal
      visible={showActionModal}
      onClose={() => setShowActionModal(false)}
      onActionSelect={handleActionSelect}
    />
  );

  return (
    <>
      <Animated.View 
        style={[
          styles.tabContainer,
          {
            transform: [{
              scale: tabSlideAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.02],
              })
            }]
          }
        ]}
      >
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName: string;

                switch (route.name) {
                  case 'Split':
                    iconName = 'people';
                    break;
                  case 'MoneyManagement':
                    iconName = 'wallet';
                    break;
                  case 'AddAction':
                    iconName = 'add';
                    break;
                  case 'Reminders':
                    iconName = 'calendar';
                    break;
                  case 'Profile':
                    iconName = 'person';
                    break;
                  default:
                    iconName = 'help';
                }

                // Special styling for Add Action (Plus) tab
                if (route.name === 'AddAction') {
                  return null; // Don't return icon, handle it in PlusTabButton
                }

                return <Icon name={iconName as any} size={size} color={color} />;
              },
              tabBarActiveTintColor: theme.colors.tabActive,
              tabBarInactiveTintColor: theme.colors.tabInactive,
              tabBarStyle: {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
                paddingTop: 8,
                height: 88,
                paddingBottom: 34,
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                borderTopWidth: 1,
              },
              tabBarItemStyle: {
                paddingVertical: 4,
              },
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '500',
                marginTop: 4,
              },
              headerShown: false,
            })}
          >
            <Tab.Screen 
              name="Split" 
              component={RealSplittingScreen}
              options={{
                tabBarLabel: 'Split',
              }}
            />
            
            <Tab.Screen
              name="MoneyManagement"
              component={MoneyManagementScreen}
              options={{
                tabBarLabel: 'Money',
              }}
            />
            
            <Tab.Screen 
              name="AddAction" 
              component={View}
              options={{
                tabBarLabel: '',
                tabBarButton: (props) => (
                  <PlusTabButton 
                    {...props} 
                    onPress={() => setShowActionModal(true)}
                  />
                ),
              }}
            />
            
            <Tab.Screen 
              name="Reminders" 
              component={Reminders}
              options={{
                tabBarLabel: 'Reminders',
              }}
            />
            
            <Tab.Screen 
              name="Profile" 
              component={ProfileScreen}
              options={{
                tabBarLabel: 'Profile',
              }}
            />
          </Tab.Navigator>
      </Animated.View>

      {/* Action Modal */}
      <ActionModal />
      
      {/* Individual Action Modals */}
      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSubmit={handleAddExpense}
        groups={groups}
        friends={friends}
      />
      
      <AddReminderModal
        visible={showReminder}
        onClose={() => setShowReminder(false)}
        onReminderAdded={() => {
          console.log('Reminder added successfully');
          setShowReminder(false);
        }}
      />
      
      <GmailSyncModal
        visible={showGmailSync}
        onClose={() => setShowGmailSync(false)}
        onSync={() => {
          console.log('Gmail sync initiated');
          setShowGmailSync(false);
        }}
      />
    </>
  );
}

export default function MainTabNavigator() {
  return <MainTabNavigatorComponent />;
}

const styles = StyleSheet.create({
  tabContainer: {
    flex: 1,
  },
  plusButton: {
    top: 5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  plusGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});