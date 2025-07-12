// src/components/modals/__tests__/CreateGroupModal.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CreateGroupModal from '../CreateGroupModal';

// Mock dependencies
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        text: '#000000',
        border: '#e0e0e0',
        primary: '#007bff',
        surface: '#f8f9fa',
        textSecondary: '#666666',
        error: '#dc3545',
      }
    }
  })
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      fullName: 'Test User',
      email: 'test@example.com',
      currency: 'USD'
    }
  })
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons'
}));

jest.mock('@/components/common/Button', () => ({
  Button: 'Button'
}));

jest.mock('@/services/firebase/splitting', () => ({
  SplittingService: {}
}));

jest.mock('@/services/payments/PaymentService', () => ({
  InviteService: {}
}));

const mockProps = {
  visible: true,
  onClose: jest.fn(),
  onSubmit: jest.fn(),
  friends: []
};

describe('CreateGroupModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders as full-screen component without Modal wrapper', () => {
    const { getByText, queryByTestId } = render(
      <CreateGroupModal {...mockProps} />
    );

    // Should render the header title
    expect(getByText('Create Group')).toBeTruthy();
    
    // Should not have Modal wrapper (we removed it)
    expect(queryByTestId('modal-wrapper')).toBeNull();
  });

  it('displays cancel button in header', () => {
    const { getByRole } = render(
      <CreateGroupModal {...mockProps} />
    );

    // Should have a touchable cancel button
    const cancelButton = getByRole('button');
    expect(cancelButton).toBeTruthy();
  });

  it('calls onClose when cancel button is pressed', () => {
    const { getByRole } = render(
      <CreateGroupModal {...mockProps} />
    );

    const cancelButton = getByRole('button');
    fireEvent.press(cancelButton);

    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders group name input field', () => {
    const { getByText, getByPlaceholderText } = render(
      <CreateGroupModal {...mockProps} />
    );

    expect(getByText('Group Name *')).toBeTruthy();
    expect(getByPlaceholderText('Enter group name')).toBeTruthy();
  });

  it('renders description input field', () => {
    const { getByText, getByPlaceholderText } = render(
      <CreateGroupModal {...mockProps} />
    );

    expect(getByText('Description (Optional)')).toBeTruthy();
    expect(getByPlaceholderText("What's this group for?")).toBeTruthy();
  });

  it('renders group icon section', () => {
    const { getByText } = render(
      <CreateGroupModal {...mockProps} />
    );

    expect(getByText('Group Icon')).toBeTruthy();
  });

  it('renders friend selector section', () => {
    const { getByText } = render(
      <CreateGroupModal {...mockProps} />
    );

    expect(getByText('Add Friends (0 selected)')).toBeTruthy();
  });

  it('renders create group button', () => {
    const { getByText } = render(
      <CreateGroupModal {...mockProps} />
    );

    // Should render both Cancel and Create Group buttons
    expect(getByText('Cancel')).toBeTruthy();
    expect(getByText('Create Group')).toBeTruthy();
  });
});