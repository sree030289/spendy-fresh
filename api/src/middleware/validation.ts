// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './error';

// Simple validation helper functions
export class Validator {
  static isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isLength(str: string, min: number, max?: number): boolean {
    if (typeof str !== 'string') return false;
    if (str.length < min) return false;
    if (max && str.length > max) return false;
    return true;
  }

  static isNumeric(value: any): boolean {
    return !isNaN(Number(value)) && isFinite(Number(value));
  }

  static isPositive(value: any): boolean {
    return this.isNumeric(value) && Number(value) > 0;
  }

  static isIn(value: any, array: any[]): boolean {
    return array.includes(value);
  }

  static isRequired(value: any): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  static isArray(value: any): boolean {
    return Array.isArray(value);
  }

  static isDateString(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }
}

// Validation middleware factory
export const validateRequest = (validationRules: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{field: string, message: string}> = [];

    // Apply validation rules
    for (const field in validationRules) {
      const rules = validationRules[field];
      const value = req.body[field] || req.params[field] || req.query[field];

      for (const rule of rules) {
        if (!rule.validator(value)) {
          errors.push({
            field: field,
            message: rule.message
          });
          break; // Stop at first error for this field
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    next();
  };
};

// Common validation rules
export const ValidationRules = {
  // User validation
  registerUser: {
    email: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Email is required' },
      { validator: (v: any) => Validator.isEmail(v), message: 'Valid email is required' }
    ],
    password: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Password is required' },
      { validator: (v: any) => Validator.isLength(v, 8), message: 'Password must be at least 8 characters' }
    ],
    fullName: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Full name is required' },
      { validator: (v: any) => Validator.isLength(v.trim(), 2), message: 'Full name must be at least 2 characters' }
    ],
    country: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Country is required' },
      { validator: (v: any) => Validator.isLength(v, 2, 2), message: 'Country code must be 2 characters' }
    ],
    currency: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Currency is required' },
      { validator: (v: any) => Validator.isLength(v, 3, 3), message: 'Currency code must be 3 characters' }
    ]
  },

  loginUser: {
    email: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Email is required' },
      { validator: (v: any) => Validator.isEmail(v), message: 'Valid email is required' }
    ],
    password: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Password is required' }
    ]
  },

  // Group validation
  createGroup: {
    name: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Group name is required' },
      { validator: (v: any) => Validator.isLength(v.trim(), 1, 100), message: 'Group name must be 1-100 characters' }
    ],
    avatar: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Avatar is required' }
    ]
  },

  // Expense validation
  createExpense: {
    description: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Description is required' },
      { validator: (v: any) => Validator.isLength(v.trim(), 1, 200), message: 'Description must be 1-200 characters' }
    ],
    amount: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Amount is required' },
      { validator: (v: any) => Validator.isPositive(v), message: 'Amount must be positive' }
    ],
    currency: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Currency is required' },
      { validator: (v: any) => Validator.isLength(v, 3, 3), message: 'Currency code must be 3 characters' }
    ],
    category: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Category is required' }
    ],
    groupId: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Group ID is required' }
    ],
    splitType: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Split type is required' },
      { validator: (v: any) => Validator.isIn(v, ['equal', 'custom', 'percentage']), message: 'Invalid split type' }
    ],
    splits: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Splits are required' },
      { validator: (v: any) => Validator.isArray(v), message: 'Splits must be an array' }
    ]
  },

  // Payment validation
  createPayment: {
    toUserId: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Recipient user ID is required' }
    ],
    amount: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Amount is required' },
      { validator: (v: any) => Validator.isPositive(v), message: 'Amount must be positive' }
    ],
    currency: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Currency is required' },
      { validator: (v: any) => Validator.isLength(v, 3, 3), message: 'Currency code must be 3 characters' }
    ],
    method: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Payment method is required' },
      { validator: (v: any) => Validator.isIn(v, ['cash', 'bank_transfer', 'paypal', 'stripe', 'venmo', 'other']), message: 'Invalid payment method' }
    ]
  },

  // Simple parameter validation
  validateUserId: {
    userId: [
      { validator: (v: any) => Validator.isRequired(v), message: 'User ID is required' }
    ]
  },

  validateGroupId: {
    groupId: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Group ID is required' }
    ]
  },

  validateExpenseId: {
    expenseId: [
      { validator: (v: any) => Validator.isRequired(v), message: 'Expense ID is required' }
    ]
  }
};
