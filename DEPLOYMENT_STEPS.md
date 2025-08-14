# 🚀 Dev Environment Deployment & Testing Guide

## ✅ **All Files Updated and Ready**

The following files have been configured for your dev environment:

### **Configuration Files:**
- ✅ `src/config/firebase.dev.ts` - Dev Firebase config with your credentials
- ✅ `src/config/firebase.prod.ts` - Prod Firebase config (unchanged)
- ✅ `src/services/firebase/config.ts` - Auto-switching Firebase config
- ✅ `src/services/api/ApiService.ts` - Auto-switching API endpoints
- ✅ `.firebaserc` - Multi-project support (dev/prod)

### **Scripts & Testing:**
- ✅ `package.json` - Added dev/prod build scripts
- ✅ `scripts/deploy-and-test-dev.sh` - Automated deployment script
- ✅ `tests/e2e/global-setup.js` - Environment-aware testing
- ✅ `tests/e2e/helpers/api-helpers.js` - Environment-aware API testing

## 🚀 **Step-by-Step Deployment**

### **Step 1: Verify Firebase CLI Setup**
```bash
# Check Firebase CLI version
firebase --version

# Login if needed
firebase login

# List projects (should show both spendy-develop and spendy-97913)
firebase projects:list
```

### **Step 2: Deploy Functions to Dev Project**
```bash
# Deploy functions to development project
npm run deploy:functions:dev

# OR manually
firebase deploy --only functions --project dev
```

### **Step 3: Verify Deployment**
```bash
# Check function logs
firebase functions:log --project dev

# Test API health endpoint
curl https://us-central1-spendy-develop.cloudfunctions.net/spendyApi/health
```

### **Step 4: Run Automated Deployment & Test Script**
```bash
# Run the comprehensive deployment and test script
./scripts/deploy-and-test-dev.sh
```

### **Step 5: Start Development Server**
```bash
# Start with dev environment (will use spendy-develop project)
npm run start:dev

# OR start with prod environment (will use spendy-97913 project)
npm run start:prod
```

### **Step 6: Run API Tests**
```bash
# Test against dev environment
npm run test:api:dev

# Test against prod environment (default)
npm run test:api
```

## 🔍 **Verification Checklist**

### **Firebase Configuration:**
- [ ] Functions deployed to `spendy-develop` project
- [ ] API endpoint responds: `https://us-central1-spendy-develop.cloudfunctions.net/spendyApi/health`
- [ ] Firebase console shows activity in dev project
- [ ] Firestore database created in dev project

### **App Configuration:**
- [ ] Dev server logs show "Using DEVELOPMENT Firebase project"
- [ ] Dev server logs show "Using DEVELOPMENT API endpoint"
- [ ] App connects to `spendy-develop` project
- [ ] Can register/login in dev environment

### **API Testing:**
- [ ] Health check passes
- [ ] User registration works
- [ ] Authentication works
- [ ] Basic CRUD operations work
- [ ] All API tests pass

## 📊 **Expected Console Output**

### **When running `npm run start:dev`:**
```
🔧 Firebase Environment: development Build: dev
🔧 Using DEVELOPMENT Firebase project
🔧 API Environment: development Build: dev
🔧 Using DEVELOPMENT API endpoint
🔧 Firebase initialized in development mode
```

### **When running API tests:**
```
🔧 Testing against DEVELOPMENT environment
📡 API Endpoint: https://us-central1-spendy-develop.cloudfunctions.net/spendyApi/health
✅ API Health Check: HEALTHY
📡 API Response: Spendy API is running
```

## 🐛 **Troubleshooting**

### **Functions Won't Deploy:**
```bash
# Check Firebase project access
firebase projects:list

# Check current project
firebase use

# Manually set project
firebase use dev
```

### **API Tests Fail:**
```bash
# Check function logs
firebase functions:log --project dev --limit 20

# Test health endpoint manually
curl -v https://us-central1-spendy-develop.cloudfunctions.net/spendyApi/health
```

### **Environment Not Switching:**
```bash
# Verify environment variable is set
echo $EXPO_PUBLIC_BUILD_TYPE

# Clear Metro cache
npx expo start --clear
```

### **CORS Issues:**
- Ensure functions are properly deployed
- Check Firebase Functions logs for errors
- Verify CORS is configured in functions/index.js

## 💰 **Cost Monitoring**

### **Monitor Both Projects:**

**Development Project (spendy-develop):**
- Go to: https://console.firebase.google.com/project/spendy-develop
- Check: Billing → Usage
- Expected: 2-5M reads/month = $1-3/month

**Production Project (spendy-97913):**
- Go to: https://console.firebase.google.com/project/spendy-97913
- Check: Billing → Usage  
- Expected: 10-15M reads/month = $5-8/month

### **Set Up Billing Alerts:**
1. Go to each project's Firebase Console
2. Navigate to Billing
3. Set up budget alerts at $2 (dev) and $10 (prod)

## 🎉 **Success Indicators**

✅ **Functions deployed to dev project**
✅ **App switches environments based on build type**
✅ **API tests pass against dev environment**
✅ **Can register/login in dev environment**
✅ **Separate billing tracking for dev/prod**
✅ **Total expected cost: $6-11/month (vs $24 before)**

## 🔄 **Daily Development Workflow**

### **For Development:**
```bash
# Start dev environment
npm run start:dev

# Deploy changes to dev
npm run deploy:functions:dev

# Test changes
npm run test:api:dev
```

### **For Production Deployment:**
```bash
# Test in dev first
npm run test:api:dev

# If all good, deploy to prod
npm run deploy:functions:prod

# Start prod environment for final verification
npm run start:prod
```

This setup ensures safe development while dramatically reducing your Firestore costs!