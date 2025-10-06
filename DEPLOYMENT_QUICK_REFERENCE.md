# 🚀 Quick Deployment Reference

## One-Command Deployments

### Deploy Everything (iOS + Backend)
```bash
git add .
git commit -m "Your changes"
git push origin master
```
✅ Automatically triggers both workflows based on changed files

---

## Manual Workflows

### 1. iOS Build & Submit

**Via GitHub UI:**
1. Go to: https://github.com/sree030289/spendy-fresh/actions
2. Click: **iOS Build and Deploy to App Store**
3. Click: **Run workflow** → Select `master` branch
4. Click: **Run workflow** button

**Result:** iOS app built and submitted to TestFlight

---

### 2. Firebase Deploy

**Via GitHub UI:**
1. Go to: https://github.com/sree030289/spendy-fresh/actions
2. Click: **Deploy to Firebase Production**
3. Click: **Run workflow** → Select `master` branch
4. Click: **Run workflow** button

**Result:** Backend functions deployed to production

---

## Required GitHub Secrets

Add these at: `Settings` → `Secrets and variables` → `Actions`

| Secret Name | How to Get | Required For |
|-------------|------------|--------------|
| `EXPO_TOKEN` | Run: `firebase login:ci` in terminal | iOS Builds |
| `FIREBASE_TOKEN` | Run: `firebase login:ci` in terminal | Firebase Deploy |

---

## Setup Steps (One-Time)

1. **Get Expo Token:**
   ```bash
   npx expo whoami
   # Visit: https://expo.dev/settings/access-tokens
   # Create token, copy it
   ```

2. **Get Firebase Token:**
   ```bash
   firebase login:ci
   # Copy the token that appears
   ```

3. **Add to GitHub:**
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Click: New repository secret
   - Add: `EXPO_TOKEN` with your Expo token
   - Add: `FIREBASE_TOKEN` with your Firebase token

4. **Push to Master:**
   ```bash
   git push origin master
   ```

✅ Done! Workflows are now active.

---

## Workflow Status

Check deployment status:
- **Actions Tab**: https://github.com/sree030289/spendy-fresh/actions
- **Expo Dashboard**: https://expo.dev
- **Firebase Console**: https://console.firebase.google.com/project/spendy-c01cc
- **App Store Connect**: https://appstoreconnect.apple.com

---

## Common Commands

```bash
# Push changes (auto-deploys based on files changed)
git push origin master

# Force iOS build (no code changes needed)
# Use GitHub Actions UI → "Run workflow"

# Force Firebase deploy (no code changes needed)  
# Use GitHub Actions UI → "Run workflow"
```

---

## Troubleshooting

### Workflow not triggering?
- Check `.github/workflows/*.yml` files exist
- Verify GitHub Actions is enabled in Settings
- Check branch name matches workflow trigger (`master` or `main`)

### Build fails?
- Check secrets are set correctly in GitHub
- View workflow logs in Actions tab
- Verify tokens haven't expired

### Need help?
- Check: `.github/WORKFLOWS_SETUP.md` (full documentation)
- View logs: GitHub → Actions → Click on failed workflow
- Contact: Development team

---

**Quick Link to Workflows:**
https://github.com/sree030289/spendy-fresh/actions
