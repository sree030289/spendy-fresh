import libphonenumber from 'libphonenumber-js';

export class PhoneNumberService {
    static normalize(phoneNumber: string): string {
        const number = libphonenumber.parsePhoneNumber(phoneNumber);
        return number.format('E.164');
    }

    static validate(phoneNumber: string): boolean {
        const number = libphonenumber.parsePhoneNumber(phoneNumber);
        return number.isValid();
    }

    static format(phoneNumber: string): string {
        const number = libphonenumber.parsePhoneNumber(phoneNumber);
        return number.formatInternational();
    }
}