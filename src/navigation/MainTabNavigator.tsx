// src/navigation/MainTabNavigator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { GRADIENTS } from '@/constants/theme';

// Import modals
import UnifiedActionModal from '@/components/modals/UnifiedActionModal';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddReminderModal from '@/components/reminders/AddReminderModal';
import GmailSyncModal from '@/components/modals/GmailSyncModal';
import SmartMoneyScreen from '@/screens/main/SmartMoneyApp';
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
        <Ionicons name="add" size={36} color="white" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Tab routes configuration (excluding the center action button)
const TAB_ROUTES = [
  { name: 'Split', component: RealSplittingScreen, index: 0 },
  { name: 'SmartMoney', component: SmartMoneyScreen, index: 1 },
  { name: 'Reminders', component: Reminders, index: 3 }, // Skip index 2 (AddAction)
  { name: 'Profile', component: ProfileScreen, index: 4 }
];

// Custom Tab Navigator with Working Swipe Support
function SwipeableTabNavigator() {
  const { theme } = useTheme();
  const [showActionModal, setShowActionModal] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showGmailSync, setShowGmailSync] = useState(false);
  const navigation = useNavigation();
  
  // Pan gesture handler for swipe navigation
  const translateX = useRef(new Animated.Value(0)).current;
  
  const handleActionSelect = (actionId: string) => {
    console.log('🎯 Handling action in MainTabNavigator:', actionId);
    
    switch (actionId) {
      case 'split-expense':
        setShowAddExpense(true);
        break;
      case 'smart-expense':
        // Navigate to Smart Money tab
        navigation.dispatch(
          CommonActions.navigate({
            name: 'SmartMoney'
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
                let iconName: keyof typeof Ionicons.glyphMap;

                switch (route.name) {
                  case 'Split':
                    iconName = focused ? 'people' : 'people-outline';
                    break;
                  case 'SmartMoney':
                    iconName = focused ? 'sparkles' : 'sparkles-outline';
                    break;
                  case 'AddAction':
                    iconName = 'add';
                    break;
                  case 'Reminders':
                    iconName = focused ? 'calendar' : 'calendar-outline';
                    break;
                  case 'Profile':
                    iconName = focused ? 'person' : 'person-outline';
                    break;
                  default:
                    iconName = 'ellipse';
                }

                // Special styling for Add Action (Plus) tab
                if (route.name === 'AddAction') {
                  return null; // Don't return icon, handle it in PlusTabButton
                }

                return <Ionicons name={iconName} size={size} color={color} />;
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
              name="SmartMoney"
              component={SmartMoneyScreen}
              options={{
                tabBarLabel: 'Smart Money',
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
        onSubmit={(data) => {
          console.log('Split expense submitted:', data);
          setShowAddExpense(false);
        }}
        groups={[]}
        friends={[]}
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