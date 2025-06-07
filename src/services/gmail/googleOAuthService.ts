import { makeRedirectUri } from 'expo-auth-session';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GMAIL_CONFIG = {
  clientId: '886487256037-ckipi085tqncafi7vql1tbao21h7aj3t.apps.googleusercontent.com', // Replace with your actual client ID
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
};

export class GoogleOAuthService {
  private static discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  static async authenticateWithGoogle(userId: string): Promise<boolean> {
    try {
      const redirectUri = makeRedirectUri({
        scheme: 'spendy',
        path: 'oauth',
      });

      const codeChallenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(),
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );

      const request = new AuthSession.AuthRequest({
        clientId: GMAIL_CONFIG.clientId,
        scopes: GMAIL_CONFIG.scopes,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        codeChallenge,
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        extraParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      });

      const result = await request.promptAsync(this.discovery);

      if (result.type === 'success') {
        const tokens = await this.exchangeCodeForTokens(
          result.params.code,
          redirectUri,
          codeChallenge
        );

        await this.storeTokens(userId, tokens);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Google OAuth error:', error);
      throw error;
    }
  }

  private static async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GMAIL_CONFIG.clientId,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    return response.json();
  }

  private static async storeTokens(userId: string, tokens: any) {
    const tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + (tokens.expires_in * 1000),
    };

    await AsyncStorage.setItem(
      `@spendy_gmail_tokens_${userId}`,
      JSON.stringify(tokenData)
    );
    await AsyncStorage.setItem(
      `@spendy_gmail_connected_${userId}`,
      'true'
    );
  }
}