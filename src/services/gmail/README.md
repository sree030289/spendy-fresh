# Gmail OAuth Configuration Guide

## Current Issue: "request URI mismatch 400"

This error occurs when the redirect URI used in your app doesn't match what's configured in Google Cloud Console.

## Required Google Cloud Console Configuration

### 1. Web OAuth Client Configuration
Add these **Authorized redirect URIs**:
- `spendy://oauth`
- `com.svaag.spendy://oauth`
- `https://auth.expo.io/@sree030289/spendy`

### 2. Android OAuth Client Configuration
- **Package name**: `com.svaag.spendy`
- **SHA-1 certificate fingerprint**: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

## Testing

1. Build and install your development app
2. Try connecting Gmail
3. The redirect URI generated should match one of the configured URIs above

## Debug Steps

If still having issues:

1. Check the exact redirect URI being generated in the logs
2. Ensure it matches exactly (case-sensitive) what's in Google Cloud Console
3. Verify the client ID is correct for your platform (web vs Android)
4. Make sure the Google APIs (Gmail API) are enabled in your project

## Current Client ID
`886487256037-brml4e3c7gcdndlvso0dunrp1v18jhq1.apps.googleusercontent.com`
