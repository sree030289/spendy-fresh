// setup-coupon-codes.js
// Script to initialize coupon codes in Firebase
// Run this once to set up the initial coupon configuration

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (make sure you have the service account key)
const serviceAccount = require('./functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id // Use project ID from service account
});

const db = admin.firestore();

const couponCodes = {
  "MeetnSplit30": {
    code: "MeetnSplit30",
    discountPercent: 30,
    discountType: "percentage",
    isActive: true,
    description: "30% off subscription",
    validUntil: "2025-12-31T23:59:59.000Z",
    usageLimit: null,
    usageCount: 0,
    applicableToPlans: ["monthly", "yearly"],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  "MeetnSplit50": {
    code: "MeetnSplit50",
    discountPercent: 50,
    discountType: "percentage",
    isActive: true,
    description: "50% off subscription",
    validUntil: "2025-12-31T23:59:59.000Z",
    usageLimit: 100,
    usageCount: 0,
    applicableToPlans: ["monthly", "yearly"],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  "MeetnSplit100": {
    code: "MeetnSplit100",
    discountPercent: 100,
    discountType: "percentage",
    isActive: true,
    description: "100% off subscription - Free trial",
    validUntil: "2025-12-31T23:59:59.000Z",
    usageLimit: 50,
    usageCount: 0,
    applicableToPlans: ["monthly", "yearly"],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }
};

async function setupCouponCodes() {
  try {
    console.log('🏷️ Setting up coupon codes in Firebase...');
    
    const couponDoc = db.collection('appConfig').doc('couponCodes');
    await couponDoc.set(couponCodes);
    
    console.log('✅ Coupon codes setup completed successfully!');
    console.log('📝 Created coupon codes:');
    Object.keys(couponCodes).forEach(code => {
      const coupon = couponCodes[code];
      console.log(`   - ${code}: ${coupon.discountPercent}% off (${coupon.description})`);
    });

  } catch (error) {
    console.error('❌ Error setting up coupon codes:', error);
  } finally {
    process.exit(0);
  }
}

setupCouponCodes();
