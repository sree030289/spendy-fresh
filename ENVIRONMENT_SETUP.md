# Multi-Environment Firebase Setup Guide

## 🎯 **Why This is Critical for Cost Management**

Your current setup uses the same Firebase project for development and production, which means:
- **Development testing counts toward your $24/month bill**
- **All 46M+ reads include dev/testing queries**  
- **Risk of accidentally corrupting production data**
- **Cannot measure actual optimization impact**

## 🚀 **Step-by-Step Setup**

### **1. Create Development Firebase Project**

1. Go to [Firebase Console](https://console.firebaconst firebaseConfig = {
  apiKey: "AIzaSyCPBvQG4Pzvk2yl5qZArlTuZYet-HKuRqs",
  authDomain: "spendy-develop.firebaseapp.com",
  projectId: "spendy-develop",
  storageBucket: "spendy-develop.firebasestorage.app",
  messagingSenderId: "827143652568",
  appId: "1:827143652568:web:15c7da06432f027db843ad",
  measurementId: "G-H9TVYG4C4N"
};se.google.com)
2. Click "Add Project" 
3. Name: `spendy-dev` (or similar)
4. **Disable Google Analytics for dev** (saves costs)
5. **Enable same services as production**:
   - Authentication
   - Firestore Database  
   - Cloud Functions
   - Storage

### **2. Configure Development Project**

#### **Firestore Database**
- Create with same **production mode** settings
- **Copy security rules** from production
- **Start with empty database** (or import sample data)

#### **Authentication**
- Enable same **sign-in methods** as production
- Create **test user accounts** for development

#### **Cloud Functions** 
- Deploy **same functions** as production
- **Separate function names** if needed (e.g., `spendyApi-dev`)

### **3. Update Configuration Files**

The configuration is already set up! Just update the dev config:

**Update `src/config/firebase.dev.ts`:**
```typescript
export const firebaseDevConfig = {
  apiKey: "YOUR_DEV_PROJECT_API_KEY",
  authDomain: "spendy-dev.firebaseapp.com",
  projectId: "spendy-dev",
  storageBucket: "spendy-dev.firebasestorage.app",
  messagingSenderId: "YOUR_DEV_SENDER_ID", 
  appId: "YOUR_DEV_APP_ID",
  measurementId: "YOUR_DEV_MEASUREMENT_ID"
};
```

### **4. Environment Variable Setup**

**Option A: Using Expo Environment Variables**
```bash
# For development builds
export EXPO_PUBLIC_BUILD_TYPE=dev

# For production builds  
export EXPO_PUBLIC_BUILD_TYPE=prod
```

**Option B: Using .env Files**
Create `.env.development` and `.env.production`:

**.env.development:**
```
EXPO_PUBLIC_BUILD_TYPE=dev
EXPO_PUBLIC_FIREBASE_PROJECT=spendy-dev
```

**.env.production:**
```
EXPO_PUBLIC_BUILD_TYPE=prod
EXPO_PUBLIC_FIREBASE_PROJECT=spendy-97913
```

### **5. Build Scripts Update**

Update your `package.json` scripts:

```json
{
  "scripts": {
    "start:dev": "EXPO_PUBLIC_BUILD_TYPE=dev expo start",
    "start:prod": "EXPO_PUBLIC_BUILD_TYPE=prod expo start", 
    "build:dev": "EXPO_PUBLIC_BUILD_TYPE=dev expo build",
    "build:prod": "EXPO_PUBLIC_BUILD_TYPE=prod expo build"
  }
}
```

### **6. API Configuration**

Update your API service configuration:

**In `src/services/api/ApiService.ts`:**
```typescript
private getBaseUrl(): string {
  const buildType = process.env.EXPO_PUBLIC_BUILD_TYPE || 'dev';
  
  if (buildType === 'dev') {
    return 'https://us-central1-spendy-dev.cloudfunctions.net/spendyApi';
  }
  
  return 'https://us-central1-spendy-97913.cloudfunctions.net/spendyApi';
}
```

## 💰 **Cost Impact Analysis**

### **Before Multi-Environment:**
- **Single project**: All reads = 46M+ = $24/month
- **No separation**: Dev + prod queries combined
- **Expensive testing**: Every test query costs money

### **After Multi-Environment:**
- **Dev project**: Testing reads = ~5-10M = $2-5/month  
- **Prod project**: Actual users = ~10-15M = $5-8/month
- **Total cost**: $7-13/month (vs $24 before)
- **Additional savings**: 40-45% cost reduction

## 🔧 **Development Workflow**

### **Daily Development:**
```bash
# Start development server (uses dev Firebase)
npm run start:dev

# Deploy to dev Firebase
firebase deploy --project spendy-dev
```

### **Production Deployment:**  
```bash
# Build for production (uses prod Firebase)
npm run build:prod

# Deploy to production Firebase
firebase deploy --project spendy-97913
```

### **Testing Optimizations:**
```bash
# Test optimizations in dev environment
npm run start:dev
# Measure Firestore reads in dev project console
# Deploy to production once validated
```

## 🛡️ **Security & Best Practices**

### **Access Control:**
- **Different IAM permissions** for dev vs prod
- **Limit dev project access** to developers only
- **Prod project access** restricted to deployment accounts

### **Data Management:**
- **Never copy production data to dev**
- **Use synthetic test data** in development
- **Regular dev database cleanup** to minimize costs

### **Monitoring:**
- **Set up billing alerts** for both projects
- **Monitor read counts** separately
- **Track optimization impact** in dev first

## ✅ **Verification Steps**

After setup, verify everything works:

1. **Check console logs** show correct environment
2. **Verify different project IDs** in Firebase console  
3. **Test auth** works in both environments
4. **Confirm API endpoints** point to correct functions
5. **Monitor billing** shows separate project costs

## 🚨 **Migration Strategy**

### **Option 1: Gradual Migration (Recommended)**
1. Set up dev environment first
2. Test all functionality in dev
3. Switch dev builds to use dev project
4. Monitor cost reduction
5. Keep production unchanged

### **Option 2: Immediate Switch**
1. Set up both environments
2. Switch all development immediately  
3. Higher risk but immediate cost savings

## 📊 **Expected Results**

With proper environment separation:
- **Development costs**: $2-5/month (dev project)
- **Production costs**: $5-8/month (prod project)  
- **Total savings**: 50-60% cost reduction
- **Added benefits**: Safer development, better testing
- **Risk reduction**: No accidental prod data corruption

This setup, combined with your Firestore optimizations, should reduce your total costs from **$24/month to $7-13/month** - a **45-70% reduction**!