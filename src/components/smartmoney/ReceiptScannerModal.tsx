// src/components/smartMoney/ReceiptScannerModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Camera, CameraView, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

interface ReceiptScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onReceiptProcessed: (imageUri: string) => void;
}

const { width, height } = Dimensions.get('window');

export default function ReceiptScannerModal({ 
  visible, 
  onClose, 
  onReceiptProcessed 
}: ReceiptScannerModalProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  
  const cameraRef = useRef<CameraView>(null);
  const scanAnimation = useRef(new Animated.Value(0)).current;
  const processingAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      getCameraPermissions();
      startScanAnimation();
    } else {
      setCapturedImage(null);
      setIsProcessing(false);
    }
  }, [visible]);

  useEffect(() => {
    if (isProcessing) {
      startProcessingAnimation();
    }
  }, [isProcessing]);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startProcessingAnimation = () => {
    Animated.loop(
      Animated.timing(processingAnimation, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });

      setCapturedImage(photo.uri);
      
      // Process the receipt
      await processReceipt(photo.uri);
    } catch (error) {
      console.error('Take picture error:', error);
      Alert.alert('Error', 'Failed to capture image');
      setIsProcessing(false);
    }
  };

  const processReceipt = async (imageUri: string) => {
    try {
      // Simulate processing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onReceiptProcessed(imageUri);
      onClose();
    } catch (error) {
      console.error('Process receipt error:', error);
      Alert.alert('Error', 'Failed to process receipt');
    } finally {
      setIsProcessing(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsProcessing(true);
        setCapturedImage(result.assets[0].uri);
        await processReceipt(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsProcessing(false);
  };

  const toggleFlash = () => {
    setFlashMode(current => {
      switch (current) {
        case 'off': return 'auto';
        case 'auto': return 'on';
        case 'on': return 'off';
        default: return 'off';
      }
    });
  };

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on': return 'flash';
      case 'auto': return 'flash-outline';
      case 'off': return 'flash-off';
      default: return 'flash-off';
    }
  };

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={64} color="#EF4444" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Please grant camera permission to scan receipts
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={getCameraPermissions}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonAlt} onPress={onClose}>
            <Text style={styles.closeButtonAltText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {!capturedImage ? (
          // Camera View
          <>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={cameraType}
              flash={flashMode}
            >
              {/* Header */}
              <BlurView intensity={80} style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan Receipt</Text>
                <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
                  <Ionicons name={getFlashIcon()} size={24} color="white" />
                </TouchableOpacity>
              </BlurView>

              {/* Scanning Overlay */}
              <View style={styles.scanningOverlay}>
                <View style={styles.scanFrame}>
                  <View style={styles.scanCorners}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                  </View>
                  
                  {/* Scanning Line */}
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [{
                          translateY: scanAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 300],
                          }),
                        }],
                      },
                    ]}
                  />
                </View>
                
                <Text style={styles.scanInstructions}>
                  Position the receipt within the frame
                </Text>
              </View>

              {/* Bottom Controls */}
              <BlurView intensity={80} style={styles.bottomControls}>
                <TouchableOpacity 
                  onPress={pickImageFromGallery} 
                  style={styles.controlButton}
                >
                  <Ionicons name="images" size={24} color="white" />
                  <Text style={styles.controlButtonText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.captureButtonGradient}
                  >
                    <Ionicons name="camera" size={32} color="white" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setCameraType(
                    cameraType === 'back' ? 'front' : 'back'
                  )} 
                  style={styles.controlButton}
                >
                  <Ionicons name="camera-reverse" size={24} color="white" />
                  <Text style={styles.controlButtonText}>Flip</Text>
                </TouchableOpacity>
              </BlurView>
            </CameraView>
          </>
        ) : (
          // Preview/Processing View
          <View style={styles.previewContainer}>
            <BlurView intensity={80} style={styles.header}>
              <TouchableOpacity onPress={retakePhoto} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {isProcessing ? 'Processing...' : 'Preview'}
              </Text>
              <View style={styles.headerButton} />
            </BlurView>

            <View style={styles.imagePreview}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
              
              {isProcessing && (
                <BlurView intensity={50} style={styles.processingOverlay}>
                  <Animated.View
                    style={[
                      styles.processingIndicator,
                      {
                        transform: [{
                          rotate: processingAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669', '#047857']}
                      style={styles.processingGradient}
                    >
                      <Ionicons name="sparkles" size={32} color="white" />
                    </LinearGradient>
                  </Animated.View>
                  
                  <Text style={styles.processingText}>
                    AI is analyzing your receipt...
                  </Text>
                  
                  <View style={styles.processingSteps}>
                    <Text style={styles.processingStep}>• Extracting text</Text>
                    <Text style={styles.processingStep}>• Identifying merchant</Text>
                    <Text style={styles.processingStep}>• Calculating total</Text>
                    <Text style={styles.processingStep}>• Categorizing expense</Text>
                  </View>
                </BlurView>
              )}
            </View>

            {!isProcessing && (
              <View style={styles.previewControls}>
                <TouchableOpacity onPress={retakePhoto} style={styles.retakeButton}>
                  <Ionicons name="camera" size={20} color="#6B7280" />
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => processReceipt(capturedImage)}
                  style={styles.usePhotoButton}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.usePhotoGradient}
                  >
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.usePhotoText}>Use Photo</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  scanningOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 300,
    height: 400,
    position: 'relative',
  },
  scanCorners: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#10B981',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  scanInstructions: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 40,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 40,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
  },
  controlButtonText: {
    fontSize: 12,
    color: 'white',
    marginTop: 4,
  },
  captureButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imagePreview: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  processingIndicator: {
    marginBottom: 24,
  },
  processingGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 24,
  },
  processingSteps: {
    alignItems: 'flex-start',
  },
  processingStep: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  previewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 20,
    paddingBottom: 40,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  usePhotoButton: {
    borderRadius: 24,
  },
  usePhotoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  usePhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#F9FAFB',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  closeButtonAlt: {
    padding: 12,
  },
  closeButtonAltText: {
    fontSize: 16,
    color: '#6B7280',
  },
});