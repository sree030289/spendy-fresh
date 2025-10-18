# Firebase Coupon Collection Setup

## Quick Setup Instructions

### 1. Go to Firebase Console

1. Open: https://console.firebase.google.com/
2. Select your project (Meet-n-Split/Spendy)
3. Click **Firestore Database** in left sidebar

### 2. Create the Coupon Collection

1. Click on **"Start collection"** or navigate to existing collections
2. Go to: `appConfig` document (or create it if it doesn't exist)
3. Add a field called `couponCodes` (type: Map)

### 3. Add LAUNCH50 Promo Code

In the `appConfig` document, add this structure:

**Path:** `appConfig/couponCodes`

**Data:**
```json
{
  "LAUNCH50": {
    "code": "LAUNCH50",
    "discountPercent": 0,
    "discountType": "percentage",
    "isActive": true,
    "description": "Store-configured promo code (App Store)",
    "validUntil": "2025-12-31T23:59:59Z",
    "usageLimit": null,
    "usageCount": 0,
    "applicableToPlans": ["yearly", "monthly"],
    "createdAt": "2025-10-18T00:00:00Z",
    "isStorePromo": true
  }
}
```

**Important Notes:**
- Set `discountPercent: 0` because the actual discount is handled by App Store
- Set `isStorePromo: true` to indicate this is a store promotional offer
- Set `usageLimit: null` for unlimited redemptions
- This allows validation to pass, then our code will use the App Store promotional offer

### 4. Alternative: Simpler Structure

If you just want validation to work, create this minimal structure:

**Path:** `appConfig` (document)

**Field:** `couponCodes` (Map)

**Value:**
```json
{
  "LAUNCH50": {
    "code": "LAUNCH50",
    "isActive": true,
    "discountPercent": 0,
    "discountType": "percentage",
    "applicableToPlans": ["monthly", "yearly"],
    "validUntil": "2025-12-31T23:59:59Z"
  }
}
```

## Testing After Setup

1. Save the Firebase changes
2. Wait 10-30 seconds for sync
3. In your app, clear and restart:
   ```bash
   # Stop expo
   # Clear cache
   npx expo start --clear
   ```
4. Open subscription modal
5. Enter "LAUNCH50"
6. Should now validate successfully! ✅

## Expected Logs After Fix

You should see:
```
🏷️ Validating coupon: LAUNCH50 for monthly plan
✅ Promo validation result: { valid: true, ... }
🔍 Checking for store promotional offer...
✅ Found matching promotional offer: LAUNCH50
📱 iOS: Using purchaseDiscountedPackage()
```
