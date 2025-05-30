import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

// Import screens
import SplittingScreen from '@/screens/main/SplittingScreen';
import ExpensesScreen from '@/screens/main/ExpensesScreen';
import RemindersScreen from '@/screens/main/RemindersScreen';
import GoalsScreen from '@/screens/main/GoalsScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Splitting':
              iconName = focused ? 'git-network' : 'git-network-outline';
              break;
            case 'Expenses':
              iconName = focused ? 'card' : 'card-outline';
              break;
            case 'Reminders':
              iconName = focused ? 'alarm' : 'alarm-outline';
              break;
            case 'Goals':
              iconName = focused ? 'trending-up' : 'trending-up-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person-circle' : 'person-circle-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
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
      <Tab.Screen name="Splitting" component={RealSplittingScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}