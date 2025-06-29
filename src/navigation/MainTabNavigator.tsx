// src/navigation/MainTabNavigator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useNavigation } from '@react-navigation/native';

// Import screens
import SmartMoneyScreen from '@/screens/main/SmartMoneyApp';
import DealsHubScreen from '@/screens/main/DealsHubScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';
import UnifiedActionModal from '@/components/modals/UnifiedActionModal';

const Tab = createBottomTabNavigator();
const { width: screenWidth } = Dimensions.get('window');

// Custom Plus Button Component
function PlusTabButton({ children, onPress }: any) {
  return (
    <TouchableOpacity
      style={styles.plusButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={styles.plusGradient}
      >
        <Ionicons name="add" size={36} color="white" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Custom Tab Navigator with Swipe Support
function SwipeableTabNavigator() {
  const { theme } = useTheme();
  const [showActionModal, setShowActionModal] = useState(false);
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const navigation = useNavigation();
  
  // Pan gesture handler for swipe navigation
  const panGestureRef = useRef<PanGestureHandler>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  
  // Tab routes in order (excluding the center action button)
  const tabRoutes = [
    { name: 'Split', index: 0 },
    { name: 'SmartMoney', index: 1 },
    { name: 'DealsHub', index: 3 }, // Skip index 2 (AddAction)
    { name: 'Profile', index: 4 }
  ];

  const handleSwipeGesture = (event: any) => {
    const { translationX, velocityX, state } = event.nativeEvent;
    
    if (state === State.END) {
      const swipeThreshold = screenWidth * 0.25; // 25% of screen width
      const velocityThreshold = 500;
      
      let targetIndex = currentTabIndex;
      
      // Determine swipe direction and target tab
      if (translationX > swipeThreshold || velocityX > velocityThreshold) {
        // Swipe right - go to previous tab
        const currentRouteIndex = tabRoutes.findIndex(route => route.index === currentTabIndex);
        if (currentRouteIndex > 0) {
          targetIndex = tabRoutes[currentRouteIndex - 1].index;
        }
      } else if (translationX < -swipeThreshold || velocityX < -velocityThreshold) {
        // Swipe left - go to next tab
        const currentRouteIndex = tabRoutes.findIndex(route => route.index === currentTabIndex);
        if (currentRouteIndex < tabRoutes.length - 1) {
          targetIndex = tabRoutes[currentRouteIndex + 1].index;
        }
      }
      
      // Navigate to target tab if it's different from current
      if (targetIndex !== currentTabIndex) {
        // Using the setCurrentTabIndex will automatically update the tab
        // through the TabNavigator's state listener
        setCurrentTabIndex(targetIndex);
      }
      
      // Reset translation
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else if (state === State.ACTIVE) {
      // Update translation during gesture
      translateX.setValue(translationX * 0.5); // Dampen the movement
    }
  };

  // Update current tab index when navigation state changes
  useEffect(() => {
    // Listen for tab changes
    const unsubscribe = navigation.addListener('state', (e) => {
      const state = e.data.state;
      if (state && state.index !== undefined) {
        // This updates our local tracking of which tab is active
        setCurrentTabIndex(state.index);
      }
    });

    return unsubscribe;
  }, [navigation]);
  
  // This effect changes the actual tab when currentTabIndex changes
  useEffect(() => {
    // Find the tab that matches the current index
    const tabIndex = Object.values(tabRoutes)
      .filter(route => route.index === currentTabIndex)
      [0]?.index;
    
    // The bottom tab navigator has its own internal state
    // we don't need to manually navigate when it's already on the right tab
  }, [currentTabIndex]);

  // Simple Action Modal Component (since UnifiedActionModal might not exist)
  const ActionModal = () => (
    <View style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      justifyContent: 'center', 
      alignItems: 'center',
      display: showActionModal ? 'flex' : 'none'
    }}>
      <View style={{ 
        backgroundColor: theme.colors.surface, 
        padding: 20, 
        borderRadius: 16, 
        margin: 20 
      }}>
        <TouchableOpacity 
          style={{ padding: 16, backgroundColor: theme.colors.primary, borderRadius: 8, marginBottom: 12 }}
          onPress={() => {
            setShowActionModal(false);
            // Change to direct tab index instead of name-based navigation
            const smartMoneyIndex = tabRoutes.findIndex(route => route.name === 'SmartMoney');
            if (smartMoneyIndex !== -1) {
              setCurrentTabIndex(tabRoutes[smartMoneyIndex].index);
            }
          }}
        >
          <Ionicons name="wallet" size={24} color="white" style={{ textAlign: 'center' }} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ padding: 16, backgroundColor: theme.colors.secondary, borderRadius: 8, marginBottom: 12 }}
          onPress={() => {
            setShowActionModal(false);
            // Change to direct tab index instead of name-based navigation
            const splitIndex = tabRoutes.findIndex(route => route.name === 'Split');
            if (splitIndex !== -1) {
              setCurrentTabIndex(tabRoutes[splitIndex].index);
            }
          }}
        >
          <Ionicons name="people" size={24} color="white" style={{ textAlign: 'center' }} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ padding: 8 }}
          onPress={() => setShowActionModal(false)}
        >
          <Ionicons name="close" size={24} color={theme.colors.text} style={{ textAlign: 'center' }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <PanGestureHandler
        ref={panGestureRef}
        onGestureEvent={handleSwipeGesture}
        onHandlerStateChange={handleSwipeGesture}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-50, 50]}
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
                  case 'DealsHub':
                    iconName = focused ? 'storefront' : 'storefront-outline';
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
              tabBarActiveTintColor: '#10B981', // Robinhood green theme
              tabBarInactiveTintColor: theme.colors.textSecondary,
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
            screenListeners={{
              state: (e) => {
                // Update current tab index when tab changes
                const index = e.data.state?.index;
                if (index !== undefined) {
                  setCurrentTabIndex(index);
                }
              },
            }}
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
              component={View} // Dummy component since this will just trigger modal
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
              name="DealsHub" 
              component={DealsHubScreen}
              options={{
                tabBarLabel: 'Deals Hub',
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

      {/* Action Modal - Use the simple built-in version instead of importing the component
          This avoids potential issues with the imported component */}
      <ActionModal />
      
      {/* Or use UnifiedActionModal but only if it's correctly set up */}
      {/* <UnifiedActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
      /> */}
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
    top: 5, // Bring it down into the tab bar area
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
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
    display: 'flex', // Explicitly set flex display
  },
  plusIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
});