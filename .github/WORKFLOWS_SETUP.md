# GitHub Workflows Setup Guide

This document explains how to set up and use the GitHub Actions workflows for automated iOS builds and Firebase deployments.

---

## 📋 Prerequisites

Before using these workflows, you need to set up the following secrets in your GitHub repository.

### Setting Up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

---

## 🔐 Required Secrets

### 1. For iOS Build & Deploy Workflow

#### `EXPO_TOKEN`
- **Description**: Expo authentication token for EAS CLI
- **How to get**:
  ```bash
  # Login to your Expo account
  npx expo login
  
  # Generate a token
  npx expo whoami
  # Then go to https://expo.dev/accounts/[your-account]/settings/access-tokens
  # Create a new token and copy it
  ```
- **Value**: Your Expo access token (starts with `expo_...`)

---

### 2. For Firebase Deploy Workflow

#### `FIREBASE_TOKEN`
- **Description**: Firebase CI token for deployments
- **How to get**:
  ```bash
  # Install Firebase CLI globally
  npm install -g firebase-tools
  
  # Login to Firebase
  firebase login
  
  # Generate CI token
  firebase login:ci
  
  # Copy the token that appears
  ```
- **Value**: Your Firebase CI token

#### `FIREBASE_SERVICE_ACCOUNT_SPENDY` (Optional)
- **Description**: Firebase service account JSON for hosting deployments
- **How to get**:
  1. Go to [Firebase Console](https://console.firebase.google.com)
  2. Select your project `spendy-c01cc`
  3. Go to **Project Settings** → **Service Accounts**
  4. Click **Generate New Private Key**
  5. Download the JSON file
  6. Copy the entire JSON content
- **Value**: The entire JSON content of the service account file

---

## 🚀 Workflow 1: iOS Build and Deploy

### File Location
`.github/workflows/ios-build-deploy.yml`

### What It Does
1. ✅ Checks out your code
2. ✅ Installs dependencies
3. ✅ Builds iOS app using EAS
4. ✅ Automatically submits to TestFlight/App Store
5. ✅ Creates GitHub release with build info

### Trigger Options

#### **Automatic Trigger** (Push to master/main)
```bash
git add .
git commit -m "Your changes"
git push origin master
```

The workflow will automatically:
- Build the iOS app
- Submit to App Store
- Create a GitHub release

#### **Manual Trigger** (Workflow Dispatch)
1. Go to GitHub → **Actions** tab
2. Select **iOS Build and Deploy to App Store**
3. Click **Run workflow**
4. Choose options:
   - **Branch**: Select branch to build from
   - **Submit to App Store**: Check to auto-submit (default: true)
5. Click **Run workflow**

### Build Configuration
- **Profile**: `production` (from `eas.json`)
- **Platform**: iOS only
- **Auto-increment**: Build number increments automatically
- **Distribution**: App Store (via EAS Submit)

### Monitoring the Build
1. Go to GitHub → **Actions** tab
2. Click on the running workflow
3. View live logs for each step
4. Check [Expo Dashboard](https://expo.dev) for build progress
5. Check [App Store Connect](https://appstoreconnect.apple.com) for submission status

---

## 🔥 Workflow 2: Firebase Production Deploy

### File Location
`.github/workflows/firebase-deploy.yml`

### What It Does
1. ✅ Checks out your code
2. ✅ Installs dependencies
3. ✅ Lints Firebase Functions
4. ✅ Runs tests (if available)
5. ✅ Deploys to Firebase Production (`spendy-c01cc`)
6. ✅ Creates deployment record

### Deployed Services
- **Cloud Functions** (backend APIs)
- **Firestore Rules** (database security)
- **Firestore Indexes** (query optimization)
- **Storage Rules** (file upload security)

### Trigger Options

#### **Automatic Trigger** (Push to master/main)
```bash
# Any changes to these paths will trigger deployment:
# - functions/**
# - firestore.rules
# - firestore.indexes.json
# - storage.rules
# - firebase.json

git add functions/
git commit -m "Updated friend request validations"
git push origin master
```

#### **Manual Trigger** (Workflow Dispatch)
1. Go to GitHub → **Actions** tab
2. Select **Deploy to Firebase Production**
3. Click **Run workflow**
4. Choose what to deploy:
   - ✅ **Deploy Cloud Functions** (default: true)
   - ✅ **Deploy Firestore Rules & Indexes** (default: true)
   - ✅ **Deploy Storage Rules** (default: true)
5. Click **Run workflow**

### Deployment Modes

#### Full Deployment (All Services)
```yaml
# When triggered automatically or manually without inputs
# Deploys: Functions + Firestore + Storage
```

#### Selective Deployment
```yaml
# Manual workflow dispatch with custom options
Deploy Functions: true
Deploy Firestore: false  # Skip Firestore
Deploy Storage: false     # Skip Storage
```

### Monitoring Deployment
1. Go to GitHub → **Actions** tab
2. Click on the running workflow
3. View live logs for each deployment step
4. Check [Firebase Console](https://console.firebase.google.com/project/spendy-c01cc)

---

## 📝 Usage Examples

### Example 1: Quick iOS Build and Submit
```bash
# Make your changes
git add .
git commit -m "Fixed profile image display bug"
git push origin master

# Workflow automatically:
# 1. Builds iOS app (production profile)
# 2. Submits to TestFlight
# 3. Creates GitHub release
```

### Example 2: Deploy Backend Changes
```bash
# Update backend functions
git add functions/index.js
git commit -m "Added friend request validations"
git push origin master

# Workflow automatically:
# 1. Deploys Cloud Functions
# 2. Updates Firestore rules (if changed)
# 3. Creates deployment record
```

### Example 3: Manual iOS Build Without Submit
1. Go to GitHub Actions
2. Select "iOS Build and Deploy"
3. Run workflow with:
   - Branch: `master`
   - Submit to App Store: ❌ **Unchecked**
4. Build will complete but won't submit to App Store

### Example 4: Deploy Only Firestore Rules
1. Go to GitHub Actions
2. Select "Deploy to Firebase Production"
3. Run workflow with:
   - Deploy Cloud Functions: ❌ **Unchecked**
   - Deploy Firestore Rules & Indexes: ✅ **Checked**
   - Deploy Storage Rules: ❌ **Unchecked**
4. Only Firestore rules will be updated

---

## 🛡️ Security Best Practices

### Secrets Management
- ✅ Never commit secrets to Git
- ✅ Rotate tokens every 90 days
- ✅ Use separate tokens for different environments
- ✅ Review secret access logs regularly

### Branch Protection
Add branch protection rules:
1. Go to **Settings** → **Branches**
2. Add rule for `master` branch
3. Enable:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass
   - ✅ Require workflow approval for first-time contributors

---

## 🐛 Troubleshooting

### iOS Build Fails

**Problem**: `EXPO_TOKEN` invalid
```bash
# Solution: Regenerate token
npx expo whoami
# Go to https://expo.dev/settings/access-tokens
# Create new token and update GitHub secret
```

**Problem**: Build fails with credentials error
```bash
# Solution: Re-authenticate EAS
eas login
eas credentials:configure
# Then re-run workflow
```

### Firebase Deploy Fails

**Problem**: `FIREBASE_TOKEN` expired
```bash
# Solution: Generate new token
firebase login:ci
# Update FIREBASE_TOKEN secret in GitHub
```

**Problem**: Permission denied error
```bash
# Solution: Check Firebase project permissions
# Ensure service account has required roles:
# - Firebase Admin
# - Cloud Functions Developer
# - Service Account User
```

### Workflow Not Triggering

**Problem**: Push to master doesn't trigger workflow
```bash
# Solution: Check workflow file syntax
# Ensure .github/workflows/*.yml files are valid YAML
# Check GitHub Actions tab for parsing errors
```

---

## 📊 Monitoring & Notifications

### GitHub Actions Dashboard
- View all workflow runs: `https://github.com/[owner]/spendy-fresh/actions`
- Filter by workflow name
- Check build duration and success rate
- Download logs for debugging

### Email Notifications
GitHub sends emails for:
- ✅ Workflow success
- ❌ Workflow failure
- ⏸️ Workflow requiring approval

Configure in: **Settings** → **Notifications** → **Actions**

### Slack Integration (Optional)
Add Slack notifications to workflows:
```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🔄 Workflow Updates

### Modifying Workflows
1. Edit `.github/workflows/*.yml` files
2. Commit and push changes
3. Workflows update automatically

### Testing Workflow Changes
1. Create a test branch
2. Update workflow file
3. Manually trigger workflow on test branch
4. Verify behavior
5. Merge to master when confirmed

---

## 📚 Additional Resources

### Documentation
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [GitHub Actions](https://docs.github.com/en/actions)

### Support
- Expo Discord: https://chat.expo.dev
- Firebase Support: https://firebase.google.com/support
- GitHub Actions Community: https://github.community/c/github-actions

---

## ✅ Quick Setup Checklist

- [ ] Create `EXPO_TOKEN` secret in GitHub
- [ ] Create `FIREBASE_TOKEN` secret in GitHub
- [ ] Create `FIREBASE_SERVICE_ACCOUNT_SPENDY` secret (optional)
- [ ] Commit workflow files to repository
- [ ] Enable GitHub Actions in repository settings
- [ ] Test iOS workflow with manual trigger
- [ ] Test Firebase workflow with manual trigger
- [ ] Configure branch protection rules
- [ ] Set up email notifications
- [ ] Document any custom modifications

---

## 🎯 One-Command Deployment

Once set up, deployment is simple:

```bash
# iOS + Backend Deployment
git add .
git commit -m "Your feature description"
git push origin master

# That's it! Workflows handle the rest automatically.
```

---

**Last Updated**: October 6, 2025  
**Workflows Version**: 1.0  
**Maintained By**: Development Team
