import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log the error details
    console.error('❌ ErrorBoundary caught an error:', error, errorInfo);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Try to log to a remote service if available
    try {
      // You could send this to Sentry, LogRocket, etc.
      console.log('📡 Attempting to log error to remote service...');
    } catch (loggingError) {
      console.error('Failed to log error remotely:', loggingError);
    }
    
    // Log specifically for view state errors
    if (error.message.includes('view state') || error.message.includes('surface')) {
      console.error('View state error detected:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }

    // Log environment configuration errors
    if (error.message.includes('FIREBASE') || error.message.includes('API') || error.message.includes('environment')) {
      console.error('❌ ENVIRONMENT ERROR:', {
        message: error.message,
        stack: error.stack,
      });
    }
  }

  handleRetry = () => {
    try {
      this.setState({ hasError: false, error: undefined });
    } catch (error) {
      console.error('Error boundary retry failed:', error);
      // Force reload if state reset fails
      if (global.window && window.location) {
        window.location.reload();
      }
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          {this.state.error?.stack && (
            <Text style={styles.stackTrace} numberOfLines={10}>
              {this.state.error.stack}
            </Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    lineHeight: 22,
  },
  stackTrace: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#999',
    marginBottom: 20,
    paddingHorizontal: 10,
    maxWidth: '100%',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
