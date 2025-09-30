# Meet-n-Split Environment Configuration Guide

## 🔧 Single-Command Environment Switching

Change your entire app environment with **one command**!

### Quick Switch Commands

```bash
# Switch to local emulator (development)
npm run env:local

# Switch to development cloud
npm run env:development  

# Switch to production
npm run env:production

# Check current environment status
npm run env:status
```

### Manual Environment Switch

Edit `.env` file and change this single line:

```bash
# Local emulator
SPENDY_ENV=local

# Development cloud  
SPENDY_ENV=development

# Production
SPENDY_ENV=production
```

## 🌐 Environment Details

### Local (`SPENDY_ENV=local`)
- **Firebase**: Emulator on localhost:5001
- **Project**: spendy-develop (emulated)
- **API**: `http://192.168.0.144:5001/spendy-develop/us-central1/meetnsplitApi`
- **Features**: Full debugging, HTTP allowed, fast development
- **Use When**: Local development, testing API changes

### Development (`SPENDY_ENV=development`)
- **Firebase**: Cloud Functions
- **Project**: spendy-develop  
- **API**: `https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi`
- **Features**: Debugging enabled, HTTPS only
- **Use When**: Testing with real Firebase, sharing with team

### Production (`SPENDY_ENV=production`)
- **Firebase**: Cloud Functions
- **Project**: spendy-97913
- **API**: `https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi`  
- **Features**: No debugging, production security, HTTPS only
- **Use When**: Live app, production testing, admin fixes

## 🚀 Workflow Examples

### Local Development
```bash
npm run env:local                          # Switch to local
firebase emulators:start --only functions  # Start emulator
npm start                                  # Start Expo
```

### Test with Development Cloud
```bash
npm run env:development  # Switch to dev cloud
npm start               # Start Expo
```

### Admin Production Fix
```bash
npm run env:production   # Switch to production
npm start               # Start Expo for testing
# Make your fixes...
npm run env:local       # Switch back to local
```

## 📱 After Environment Switch

1. **Restart Expo**: `npx expo start --clear`
2. **Check Status**: `npm run env:status` 
3. **Verify in App**: Look for environment logs in Metro console

## 🔍 Troubleshooting

### Environment Not Switching?
```bash
npm run env:status  # Check current environment
npx expo start --clear  # Clear cache and restart
```

### Firebase Emulator Not Working?
```bash
firebase emulators:start --only functions
# Check localhost:5001 in browser
```

### API Endpoints Not Working?
```bash
# Test API directly
curl https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi/health
curl https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi/health
```

## 🔧 Admin Dashboard URLs

### Development
- Functions: https://console.firebase.google.com/project/spendy-develop/functions
- Firestore: https://console.firebase.google.com/project/spendy-develop/firestore

### Production  
- Functions: https://console.firebase.google.com/project/spendy-97913/functions
- Firestore: https://console.firebase.google.com/project/spendy-97913/firestore

## 📂 File Structure

```
config/
├── environments.js     # ✅ Master environment config
scripts/
├── env-switch.sh      # ✅ Environment switcher
├── env-status.sh      # ✅ Status checker
.env                   # ✅ SPENDY_ENV=local (change this!)
app.config.js          # ✅ Auto-configures from environments.js
src/config/environment.ts  # ✅ Runtime environment access
```

## 🎯 Key Benefits

- ✅ **One variable controls everything** (`SPENDY_ENV`)
- ✅ **No more editing multiple files**
- ✅ **Consistent Firebase/API endpoints**  
- ✅ **Easy admin environment switching**
- ✅ **No hardcoded URLs anywhere**
- ✅ **Automatic environment validation**
