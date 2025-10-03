// RevenueCat Debug Helper
// Add this temporarily to any screen to debug RevenueCat configuration

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const RevenueCatDebugHelper = () => {
  const handleDebug = () => {
    console.log('=== RevenueCat Debug Info ===');
    console.log('__DEV__ flag:', __DEV__);
    console.log('Platform:', Platform.OS);
    
    // Import and check product IDs
    import('../services/RealPaymentService').then((module) => {
      const service = module.RealPaymentService.getInstance();
      console.log('Product IDs:', service.PRODUCT_IDS);
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleDebug}>
        <Text style={styles.buttonText}>Debug RevenueCat Config</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default RevenueCatDebugHelper;
