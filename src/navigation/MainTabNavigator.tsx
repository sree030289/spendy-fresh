// src/navigation/MainTabNavigator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Icon } from '../components/common/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { GRADIENTS } from '@/constants/theme';
import { Group, Friend } from '@/services/firebase/splitting-disabled';
import { ApiService } from '@/services/api/ApiService';

// Import modals
import UnifiedActionModal from '@/components/modals/UnifiedActionModal';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddReminderModal from '@/components/reminders/AddReminderModal';
import GmailSyncModal from '@/components/modals/GmailSyncModal';
import MoneyManagementScreen from '@/screens/main/MoneyManagementScreen';
import Reminders from '@/screens/main/RemindersScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';

const Tab = createBottomTabNavigator();
const { width: screenWidth } = Dimensions.get('window');

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
const TAB_ROUTES = [
  { name: 'Split', component: RealSplittingScreen, index: 0 },
  { name: 'MoneyManagement', component: MoneyManagementScreen, index: 1 },
  { name: 'Reminders', component: Reminders, index: 3 }, // Skip index 2 (AddAction)
  { name: 'Profile', component: ProfileScreen, index: 4 }
];

// Custom Tab Navigator with Working Swipe Support
function SwipeableTabNavigator() {
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
  
  // Pan gesture handler for swipe navigation
  const translateX = useRef(new Animated.Value(0)).current;
  
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
  
  const handleAddExpense = async (expenseData: any) => {
    try {
      if (!user?.id) return;
      
      const response = await apiService.addExpense({
        ...expenseData,
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
  
  const handleActionSelect = (actionId: string) => {
    console.log('🎯 Handling action in MainTabNavigator:', actionId);
    
    switch (actionId) {
      case 'split-expense':
        // Refresh data before opening modal
        if (user?.id) {
          apiService.getUserGroups().then(setGroups).catch(console.error);
          apiService.getFriends().then(setFriends).catch(console.error);
        }
        setShowAddExpense(true);
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
  
  const handleSwipeGesture = (event: any) => {
    const { translationX, velocityX, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      // Update translation during gesture with damping
      translateX.setValue(translationX * 0.3);
    } else if (state === State.END) {
      const swipeThreshold = screenWidth * 0.2; // 20% of screen width
      const velocityThreshold = 800;
      
      // Get current navigation state
      const currentState = navigation.getState();
      if (!currentState) return;
      
      const currentIndex = currentState.index;
      
      // Find current tab in our routes
      const currentTabRouteIndex = TAB_ROUTES.findIndex(route => {
        const tabIndex = currentState.routes.findIndex(r => r.name === route.name);
        return tabIndex === currentIndex;
      });
      
      let targetTabIndex = currentTabRouteIndex;
      
      // Determine swipe direction and target tab
      if ((translationX > swipeThreshold || velocityX > velocityThreshold) && currentTabRouteIndex > 0) {
        // Swipe right - go to previous tab
        targetTabIndex = currentTabRouteIndex - 1;
      } else if ((translationX < -swipeThreshold || velocityX < -velocityThreshold) && currentTabRouteIndex < TAB_ROUTES.length - 1) {
        // Swipe left - go to next tab
        targetTabIndex = currentTabRouteIndex + 1;
      }
      
      // Navigate to target tab if it's different from current
      if (targetTabIndex !== currentTabRouteIndex && targetTabIndex >= 0 && targetTabIndex < TAB_ROUTES.length) {
        const targetRoute = TAB_ROUTES[targetTabIndex];
        console.log(`🔄 Swiping to: ${targetRoute.name}`);
        
        navigation.dispatch(
          CommonActions.navigate({
            name: targetRoute.name
          })
        );
      }
      
      // Reset translation with animation
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
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
      <PanGestureHandler
        onGestureEvent={handleSwipeGesture}
        onHandlerStateChange={handleSwipeGesture}
        activeOffsetX={[-20, 20]}
        failOffsetY={[-50, 50]}
        shouldCancelWhenOutside={true}
      >
        <Animated.View 
          style={[
            styles.swipeContainer,
            {
              transform: [{ translateX }]
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
      </PanGestureHandler>

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
  return <SwipeableTabNavigator />;
}

const styles = StyleSheet.create({
  swipeContainer: {
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