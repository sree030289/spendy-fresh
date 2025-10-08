# Quick Reference - Deployment & Testing

## 🚀 Quick Commands

### Deploy Functions
```bash
# Development environment
yarn deploy:functions:dev

# Production environment
yarn deploy:functions:prod

# Full deployment (all services)
yarn deploy:dev      # Development
yarn deploy:prod     # Production
```

### Test the App
```bash
# Start development server
yarn start

# Run on specific platform
yarn android
yarn ios
yarn web
```

---

## ✅ Quick Testing After Deployment

### 1. Profile Picture (30 seconds)
```
1. Login → Profile → Upload Picture
2. ✅ Check: Image shows immediately
3. ✅ Check: No restart needed
```

### 2. Loading Speed (30 seconds)
```
1. Logout → Login
2. ✅ Check: UI shows in <1 second
3. ✅ Check: Data loads in <3 seconds
```

### 3. Deployment (1 minute)
```bash
yarn deploy:functions:dev
# ✅ Check: No "no changes" warnings
# ✅ Check: Deployment succeeds
```

---

## 🐛 Troubleshooting

### Profile Picture Not Showing
```bash
# Clear app cache
# On iOS: Settings → App → Reset
# On Android: Settings → Apps → Clear Cache
```

### Slow Loading Persists
```bash
# Check network connection
# Verify API endpoints are responding
# Check console logs for errors
```

### Deployment Fails
```bash
# Verify Firebase CLI is installed
firebase --version

# Login to Firebase
firebase login

# Check project configuration
firebase projects:list
```

---

## 📊 Expected Performance

| Action | Expected Time | What to Check |
|--------|---------------|---------------|
| Login → Overview | <3 seconds | UI interactive in <1s |
| Profile Upload | <5 seconds | Image shows immediately |
| Function Deploy | 1-2 minutes | No cache warnings |

---

## 🔍 Console Logs to Look For

### ✅ Good Signs
```
⚡ OPTIMIZED: Showing UI immediately, loading data in background...
🚀 Starting parallel data loading
✅ Parallel loading complete
✅ Profile picture uploaded successfully
🆕 Increment imageRefreshKey
```

### ❌ Warning Signs
```
❌ Friends loading failed
❌ Groups loading failed
⚠️ Failed to refresh profile from backend
```

---

## 📞 Need Help?

**Check Documentation:**
- `PROFILE_PICTURE_AND_LOADING_FIX.md` - Technical details
- `VISUAL_SUMMARY.md` - Visual diagrams

**Rollback if needed:**
```bash
git revert ea899e8  # Visual summary
git revert 2fc8f1a  # Documentation
git revert dfb2855  # Main fixes
```

---

## 🎯 Success Criteria

After deployment, you should see:
- ✅ Profile pictures update instantly
- ✅ App loads in <3 seconds
- ✅ Firebase functions deploy reliably
- ✅ No user complaints about slow loading
- ✅ No user complaints about profile picture bugs

---

## 📈 Monitoring

Keep an eye on:
- [ ] User feedback on loading speed
- [ ] Profile picture update success rate
- [ ] Firebase function deployment logs
- [ ] Error rates in console logs
- [ ] App crash reports

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
