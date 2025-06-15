import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { TouchableOpacity, View, StyleSheet } from 'react-native';

// Import screens
import SplittingScreen from '@/screens/main/SplittingScreen';
import SmartMoneyScreen from '@/screens/main/SmartMoneyScreen';
import DealsHubScreen from '@/screens/main/DealsHubScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';

// Import QuickAddModal
//import QuickAddModal from '@/components/modals/QuickAddModal';

const Tab = createBottomTabNavigator();

function QuickAddButton() {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  
  return (
    <>
      <TouchableOpacity 
        style={styles.quickAddButton}
        onPress={() => setShowModal(true)}
      >
        <View style={[styles.quickAddButtonInner, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="add" size={26} color="#fff" />
        </View>
      </TouchableOpacity>
      {/* <QuickAddModal visible={showModal} onClose={() => setShowModal(false)} /> */}
    </>
  );
}

export default function MainTabNavigator() {
  const { theme } = useTheme();

  return (
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
            case 'QuickAdd':
              return null; // Custom button will handle this
            case 'Deals Hub':
              iconName = focused ? 'storefront' : 'storefront-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return iconName ? <Ionicons name={iconName} size={size} color={color} /> : null;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          paddingTop: 8,
          height: 88, // Increased height for safe area
          paddingBottom: 34, // Add bottom padding for home indicator
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Split" component={RealSplittingScreen} />
      <Tab.Screen name="SmartMoney" component={SmartMoneyScreen} options={{ title: 'Smart Money' }} />
      <Tab.Screen 
        name="QuickAdd" 
        component={SmartMoneyScreen} // This will be overridden by the button press
        options={{
          tabBarButton: (props) => <QuickAddButton {...props} />,
        }}
      />
      <Tab.Screen name="Deals Hub" component={DealsHubScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  quickAddButton: {
    height: 60,
    width: 60,
    borderRadius: 30,
    marginTop: -30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddButtonInner: {
    height: 56,
    width: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
});