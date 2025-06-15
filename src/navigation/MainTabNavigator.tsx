// src/navigation/MainTabNavigator.tsx
import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';

// Import screens
import SplittingScreen from '@/screens/main/SplittingScreen';
import SmartMoneyScreen from '@/screens/main/SmartMoneyScreen';
import DealsHubScreen from '@/screens/main/DealsHubScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';

// Import the new action modal
import UnifiedActionModal from '@/components/modals/UnifiedActionModal';

const Tab = createBottomTabNavigator();

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

export default function MainTabNavigator() {
  const { theme } = useTheme();
  const [showActionModal, setShowActionModal] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            switch (route.name) {
              case 'Split':
                iconName = focused ? 'people' : 'people-outline';
                break;
              case 'SmartMoney':
                iconName = focused ? 'wallet' : 'wallet-outline';
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

      {/* Unified Action Modal */}
      <UnifiedActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
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