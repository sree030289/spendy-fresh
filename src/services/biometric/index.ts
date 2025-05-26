import * as LocalAuthentication from 'expo-local-authentication';

export class BiometricService {
  static async isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }

  static async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    return await LocalAuthentication.supportedAuthenticationTypesAsync();
  }

  static async authenticate(): Promise<LocalAuthentication.LocalAuthenticationResult> {
    return await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate with biometrics',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Password',
    });
  }
}