// src/components/modals/SuccessAnimationModal.tsx
import React from 'react';
import FullScreenSuccessAnimationSimple from '../animations/FullScreenSuccessAnimationSimple';

interface SuccessAnimationModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  onButtonPress?: () => void;
  type?: 'success' | 'error' | 'warning';
  autoClose?: boolean;
  duration?: number;
}

export default function SuccessAnimationModal({
  visible,
  onClose,
  title,
  message,
  buttonText = 'Continue',
  onButtonPress,
  autoClose = false,
  duration = 2000,
}: SuccessAnimationModalProps) {
  const handleContinue = () => {
    if (onButtonPress) {
      onButtonPress();
    } else {
      onClose();
    }
  };

  return (
    <FullScreenSuccessAnimationSimple
      visible={visible}
      title={title}
      message={message}
      buttonText={buttonText}
      onContinue={handleContinue}
      autoHide={autoClose}
      autoHideDelay={duration}
      showButton={!autoClose}
    />
  );
}