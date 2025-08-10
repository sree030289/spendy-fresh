# Playwright Test Configuration for Expense Splitting Scenario

## Test Scenario Overview
This test creates a comprehensive expense splitting scenario with:
- **3 Users**: Alice, Bob, Charlie  
- **1 Group**: "Playwright Test Group"
- **5 Expenses**: Various amounts with different split types

## Test User Credentials for UI Verification

### 🔐 User Accounts
| User | Email | Password | Full Name | Role |
|------|-------|----------|-----------|------|
| User1 | `testuser1@spendytest.com` | `TestPassword123!` | Alice Johnson | Group Creator |
| User2 | `testuser2@spendytest.com` | `TestPassword123!` | Bob Smith | Member |
| User3 | `testuser3@spendytest.com` | `TestPassword123!` | Charlie Wilson | Member |

### 💰 Test Expenses Created
| # | Description | Amount | Paid By | Split Type | Notes |
|---|-------------|--------|---------|------------|-------|
| 1 | myki | $100 | Alice (User1) | Equal | Public transport |
| 2 | power bill | $300 | Charlie (User3) | Custom | 40%/30%/30% split |
| 3 | dinein | $150 | Bob (User2) | Equal | Restaurant dinner |
| 4 | Myer | $300 | Bob (User2) | Equal | Department store |
| 5 | Coles | $100 | Alice (User1) | Equal | Grocery shopping |

### 📊 Expected Balance Calculations
- **Alice paid**: $200 (myki + Coles)
- **Bob paid**: $450 (dinein + Myer)  
- **Charlie paid**: $300 (power bill)
- **Alice vs Bob**: Alice owes Bob ~$83.33
- **Alice vs Charlie**: Alice owes Charlie ~$66.67
- **Bob vs Charlie**: Bob owes Charlie ~$16.67

## 🧪 Running the Tests

```bash
# Install Playwright if not already installed
npm install @playwright/test

# Run the expense splitting scenario test
npx playwright test tests/api/expense-splitting-scenario.test.js --headed

# Run with verbose output
npx playwright test tests/api/expense-splitting-scenario.test.js --headed --reporter=line
```

## 🔍 Manual UI Verification Steps

1. **Login as User1 (Alice)**:
   - Email: `testuser1@spendytest.com`
   - Password: `TestPassword123!`
   - Verify you see "Playwright Test Group"
   - Check that 5 expenses are visible
   - Verify balance calculations show you owe Bob ~$83.33

2. **Login as User2 (Bob)**:
   - Email: `testuser2@spendytest.com`  
   - Password: `TestPassword123!`
   - Verify the same group and expenses
   - Check balance shows Alice owes you ~$83.33

3. **Login as User3 (Charlie)**:
   - Email: `testuser3@spendytest.com`
   - Password: `TestPassword123!`
   - Verify you see the power bill expense you paid
   - Check balances with other users

## 🎯 What to Test in UI

### Split Data Verification
- [ ] Each expense shows proper split details (not empty)
- [ ] Custom split (power bill) shows correct amounts: $120/$90/$90
- [ ] Equal splits show $33.33/$33.33/$33.34 distribution
- [ ] Balance calculations use actual split data (not fallback)

### Balance Accuracy  
- [ ] Settlement overview shows actual balances (not "all settled")
- [ ] Individual balances match expected calculations
- [ ] Ability to create settlements between users
- [ ] Settlement history tracks properly

### Data Integrity
- [ ] Refresh doesn't lose split data
- [ ] Expenses display correct payer and amounts
- [ ] Group membership shows all 3 users
- [ ] Each user can see all expenses in shared group

## 🐛 Issues to Watch For
- Empty `splitDetails` arrays (should now have data)
- Fallback to equal splits when custom splits should apply
- "All settled" message when balances exist
- Missing split participant data
- Incorrect balance calculations due to missing split data
