// setup-subscription-config.js
// Script to initialize subscription configuration in Firebase
// Run this once to set up the initial configuration

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (make sure you have the service account key)
const serviceAccount = require('./functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'spendy-97913'
});

const db = admin.firestore();

const subscriptionConfig = {
  pricing: {
    monthly: {
      price: 0.99,
      currency: 'USD',
      originalPrice: 1.99
    },
    yearly: {
      price: 10.99,
      currency: 'USD', 
      originalPrice: 11.88,
      monthlyEquivalent: 0.92
    },
    savings: {
      percentage: 8,
      amount: 0.89
    }
  },
  features: {
    keyFeatures: [
      'Unlimited Groups & Members',
      'Unlimited Transactions',
      'AI Receipt Scanning',
      'Advanced Analytics',
      'Export & Integration',
      'Priority Support'
    ],
    detailedFeatures: {
      'Core Features': [
        'Unlimited groups and members',
        'Unlimited daily transactions',
        'Advanced expense tracking',
        'Smart categorization'
      ],
      'AI & Automation': [
        'Smart receipt scanning',
        'Auto expense categorization',
        'Intelligent split suggestions',
        'OCR text extraction'
      ],
      'Analytics & Insights': [
        'Detailed spending analytics',
        'Category-wise breakdowns', 
        'Monthly/yearly reports',
        'Export to CSV/PDF',
        'Trend analysis'
      ],
      'Collaboration': [
        'Group chat integration',
        'Email notifications',
        'Payment reminders',
        'Shared expense notifications',
        'Real-time sync'
      ],
      'Support': [
        'Priority customer support',
        '24/7 email assistance',
        'Feature request priority',
        'Beta access to new features'
      ]
    }
  },
  displayConfig: {
    defaultPlan: 'yearly',
    showSavings: true,
    highlightYearly: true,
    promoCodeEnabled: true
  },
  metadata: {
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    version: '1.0.0',
    isActive: true,
    notes: 'Initial subscription configuration'
  }
};

async function setupSubscriptionConfig() {
  try {
    console.log('🚀 Setting up subscription configuration in Firebase...');
    
    // Set the subscription configuration
    await db.collection('appConfig').doc('subscriptionConfig').set(subscriptionConfig);
    
    console.log('✅ Subscription configuration successfully added to Firebase!');
    console.log('📊 Configuration details:');
    console.log(`   Monthly Price: $${subscriptionConfig.pricing.monthly.price}`);
    console.log(`   Yearly Price: $${subscriptionConfig.pricing.yearly.price}`);
    console.log(`   Savings: ${subscriptionConfig.pricing.savings.percentage}%`);
    console.log(`   Key Features: ${subscriptionConfig.features.keyFeatures.length} items`);
    console.log(`   Default Plan: ${subscriptionConfig.displayConfig.defaultPlan}`);
    console.log(`   Promo Code Enabled: ${subscriptionConfig.displayConfig.promoCodeEnabled}`);
    
    console.log('\n📱 The app will now automatically use these settings!');
    console.log('🔄 You can update them anytime in Firebase Console or with this script.');
    
  } catch (error) {
    console.error('❌ Error setting up subscription configuration:', error);
  } finally {
    process.exit(0);
  }
}

// Alternative configuration examples you can uncomment and modify:

// Example: Holiday pricing
const holidayPricing = {
  ...subscriptionConfig,
  pricing: {
    monthly: {
      price: 1.99,  // 33% off
      currency: 'USD',
      originalPrice: 2.99
    },
    yearly: {
      price: 19.99, // 23% off  
      currency: 'USD',
      originalPrice: 25.99,
      monthlyEquivalent: 1.67
    },
    savings: {
      percentage: 50,
      amount: 4.89
    }
  },
  metadata: {
    ...subscriptionConfig.metadata,
    notes: 'Holiday special pricing - 2025'
  }
};

// Example: Premium tier
const premiumConfig = {
  ...subscriptionConfig,
  pricing: {
    monthly: {
      price: 4.99,
      currency: 'USD'
    },
    yearly: {
      price: 39.99,
      currency: 'USD',
      monthlyEquivalent: 3.33
    },
    savings: {
      percentage: 33,
      amount: 20.89
    }
  },
  features: {
    ...subscriptionConfig.features,
    keyFeatures: [
      'Everything in Basic',
      'AI-Powered Insights',
      'Multi-Currency Support',
      'Advanced Reporting',
      'API Access',
      'White-label Options'
    ]
  }
};

// To use alternative configs, uncomment one of these:
// setupSubscriptionConfig(holidayPricing);
// setupSubscriptionConfig(premiumConfig);

setupSubscriptionConfig();
