# Enable SMTP AUTH for Microsoft 365 Tenant

## The Problem
Error: `SmtpClientAuthentication is disabled for the Tenant`

This means SMTP AUTH is disabled at the organization level, not just the mailbox level.

## Solution: Enable SMTP AUTH via PowerShell

### Step 1: Install Exchange Online PowerShell Module

```powershell
# Run PowerShell as Administrator
Install-Module -Name ExchangeOnlineManagement -Force
```

### Step 2: Connect to Exchange Online

```powershell
# Connect to your tenant
Connect-ExchangeOnline -UserPrincipalName admin@meetnsplit.com
```

### Step 3: Enable SMTP AUTH for the Mailbox

```powershell
# Enable SMTP AUTH for the specific mailbox
Set-CASMailbox -Identity admin@meetnsplit.com -SmtpClientAuthenticationDisabled $false
```

### Step 4: Verify SMTP AUTH is Enabled

```powershell
# Check the setting
Get-CASMailbox -Identity admin@meetnsplit.com | Format-List SmtpClientAuthenticationDisabled

# Should return: SmtpClientAuthenticationDisabled : False
```

### Step 5: Disconnect

```powershell
Disconnect-ExchangeOnline
```

---

## Alternative: Enable via Exchange Admin Center

1. Go to https://admin.exchange.microsoft.com
2. Navigate to: **Recipients** → **Mailboxes**
3. Click on **admin@meetnsplit.com**
4. Go to **Mail flow settings** tab
5. Click **Email apps**
6. Enable **Authenticated SMTP**
7. Click **Save**

---

## Alternative: Use Microsoft Graph API Instead

If you want to avoid SMTP AUTH issues entirely, consider using Microsoft Graph API for sending emails:

### Update Firebase Functions to use Graph API

```javascript
// functions/src/email/graphEmailService.js
const axios = require('axios');

const getAccessToken = async () => {
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const response = await axios.post(tokenEndpoint, params);
  return response.data.access_token;
};

const sendEmail = async (to, subject, html) => {
  const accessToken = await getAccessToken();
  
  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: html
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    },
    saveToSentItems: 'true'
  };

  await axios.post(
    'https://graph.microsoft.com/v1.0/users/admin@meetnsplit.com/sendMail',
    message,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
};

module.exports = { sendEmail };
```

### Required Environment Variables for Graph API

```bash
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-app-registration-client-id
MICROSOFT_CLIENT_SECRET=your-app-registration-client-secret
```

---

## Recommended Approach

**Use PowerShell Method** - It's the quickest way to enable SMTP AUTH for your mailbox.

After enabling, wait 5-10 minutes for the change to propagate, then test your Firebase Functions again.
