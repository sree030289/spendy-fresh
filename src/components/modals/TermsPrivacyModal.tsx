import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import FullscreenModal from '../common/FullscreenModal';
import { useTheme } from '@/hooks/useTheme';

interface TermsPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TermsPrivacyModal: React.FC<TermsPrivacyModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  const termsContent = `
TERMS OF SERVICE

Last updated: ${new Date().toLocaleDateString()}

Welcome to Meet-n-Split! These terms of service ("Terms") apply to your access and use of the Meet-n-Split application and services (the "Service") provided by Meet-n-Split Inc.

1. ACCEPTANCE OF TERMS
By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these terms, then you may not access the Service.

2. DESCRIPTION OF SERVICE
Meet-n-Split is a personal finance and expense sharing application that allows users to:
- Track personal expenses and income
- Split bills and expenses with friends and groups
- Manage shared budgets and financial goals
- Send payment reminders and notifications
- Integrate with email services for bill detection

3. USER ACCOUNTS
- You must provide accurate and complete information when creating an account
- You are responsible for maintaining the security of your account
- You must notify us immediately of any unauthorized use
- One person may not maintain more than one account

4. USER CONDUCT
You agree not to:
- Use the Service for any unlawful purpose
- Attempt to gain unauthorized access to other user accounts
- Transmit any harmful, threatening, or offensive content
- Interfere with or disrupt the Service or servers
- Use automated scripts or bots

5. FINANCIAL DATA
- We use bank-level security to protect your financial information
- We do not store your banking credentials
- Transaction data is encrypted and securely stored
- You grant us permission to access transaction data for service functionality

6. PAYMENT PROCESSING
- Meet-n-Split facilitates payment tracking but does not process actual payments
- Users are responsible for their own payment arrangements
- We are not liable for payment disputes between users

7. PRIVACY AND DATA
Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information.

8. SUBSCRIPTION AND FEES
- Basic features are free to use
- Premium features require a paid subscription
- Subscription fees are non-refundable except as required by law
- We may change subscription prices with notice

9. INTELLECTUAL PROPERTY
- The Service and its content are owned by Meet-n-Split Inc.
- You retain ownership of content you create
- You grant us a license to use your content for service operation

10. DISCLAIMERS
- The Service is provided "as is" without warranties
- We do not guarantee uninterrupted or error-free service
- We are not responsible for financial decisions based on our Service

11. LIMITATION OF LIABILITY
In no event shall Meet-n-Split Inc. be liable for any indirect, incidental, special, consequential, or punitive damages.

12. TERMINATION
We may terminate or suspend your account at any time for violations of these Terms.

13. CHANGES TO TERMS
We may update these Terms from time to time. Continued use of the Service constitutes acceptance of updated Terms.

14. GOVERNING LAW
These Terms are governed by the laws of the State of California, United States.

15. CONTACT INFORMATION
If you have questions about these Terms, please contact us at:
Email: admin@meetnsplit.com
Address: Meet-n-Split Inc., Trugnaina, Victoria

By using Meet-n-Split, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
  `;

  const privacyContent = `
PRIVACY POLICY

Last updated: ${new Date().toLocaleDateString()}

Meet-n-Split Inc. ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.

1. INFORMATION WE COLLECT

Personal Information:
- Name, email address, phone number
- Profile picture and user preferences
- Device identifiers and app usage data

Financial Information:
- Transaction data you manually enter
- Bank account names (not credentials)
- Expense categories and amounts
- Bill and receipt information

Communication Data:
- Messages within group chats
- Payment reminders and notifications
- Email integration data (with permission)

Technical Information:
- Device type, operating system, app version
- IP address, location data (if permitted)
- Crash reports and performance data

2. HOW WE USE YOUR INFORMATION

We use your information to:
- Provide and maintain our services
- Process transactions and send notifications
- Improve app functionality and user experience
- Provide customer support
- Detect and prevent fraud
- Comply with legal obligations

3. INFORMATION SHARING

We may share your information with:
- Other users in your groups (limited to relevant data)
- Service providers who assist our operations
- Law enforcement when legally required
- In connection with business transfers

We do NOT sell your personal information to third parties.

4. DATA SECURITY

We implement industry-standard security measures:
- End-to-end encryption for sensitive data
- Secure data centers with 24/7 monitoring
- Regular security audits and updates
- Bank-level security protocols

5. YOUR RIGHTS AND CHOICES

You have the right to:
- Access your personal information
- Correct inaccurate data
- Delete your account and data
- Opt out of marketing communications
- Export your data

6. DATA RETENTION

We retain your information:
- Account data: Until you delete your account
- Transaction data: 7 years for financial records
- Communication data: 3 years
- Technical data: 2 years

7. INTERNATIONAL TRANSFERS

Your information may be transferred and stored in countries other than your country of residence, including the United States, where our servers are located.

8. CHILDREN'S PRIVACY

Our Service is not intended for children under 13. We do not knowingly collect personal information from children under 13.

9. THIRD-PARTY SERVICES

Our app may integrate with third-party services:
- Email providers (with your permission)
- Payment processors (for subscriptions)
- Analytics services (anonymized data only)

Each service has its own privacy policy.

10. COOKIES AND TRACKING

We use cookies and similar technologies to:
- Remember your preferences
- Analyze app usage patterns
- Improve service performance

11. CALIFORNIA PRIVACY RIGHTS

California residents have additional rights under CCPA:
- Right to know what personal information is collected
- Right to delete personal information
- Right to opt-out of sale (we don't sell data)
- Right to non-discrimination

12. EUROPEAN PRIVACY RIGHTS

EU residents have rights under GDPR:
- Right to access, rectify, and erase data
- Right to data portability
- Right to restrict processing
- Right to object to processing

13. CHANGES TO PRIVACY POLICY

We may update this Privacy Policy periodically. We will notify you of material changes through the app or email.

14. CONTACT US

For privacy-related questions or requests:
Email: admin@meetnsplit.com
Address: Meet-n-Split Inc., 123 Finance Street, San Francisco, CA 94105

Data Protection Officer: admin@meetnsplit.com

If you're in the EU, you may also contact your local data protection authority.

Last updated: ${new Date().toLocaleDateString()}
  `;

  return (
    <FullscreenModal
      visible={visible}
      onClose={onClose}
      title="Legal Information"
    >
      <View style={styles.container}>
        {/* Tab Selector */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'terms' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => setActiveTab('terms')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'terms' ? 'white' : theme.colors.text }
            ]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'privacy' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => setActiveTab('privacy')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'privacy' ? 'white' : theme.colors.text }
            ]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          <Text style={[styles.contentText, { color: theme.colors.text }]}>
            {activeTab === 'terms' ? termsContent : privacyContent}
          </Text>
        </ScrollView>
      </View>
    </FullscreenModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    // backgroundColor will be set dynamically
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left',
  },
});
