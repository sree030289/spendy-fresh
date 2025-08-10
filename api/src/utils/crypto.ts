// src/utils/crypto.ts
import * as crypto from 'crypto';

export class CryptoUtils {
  // Hash password using Node.js built-in crypto
  static async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, hash] = hashedPassword.split(':');
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(hash === derivedKey.toString('hex'));
      });
    });
  }

  // Generate random token
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate JWT-like token (simple version)
  static createJWTToken(payload: any, secret: string, expiresIn: string = '7d'): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const expiration = now + this.parseExpiration(expiresIn);

    const jwtPayload = {
      ...payload,
      iat: now,
      exp: expiration
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  // Verify JWT-like token
  static verifyJWTToken(token: string, secret: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());

    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error('Token expired');
    }

    return payload;
  }

  private static parseExpiration(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 7 * 24 * 60 * 60; // Default 7 days
    }
  }
}
