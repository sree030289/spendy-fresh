import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MeetNSplitLogoProps {
  size?: 'tiny' | 'small' | 'medium' | 'large';
  color?: 'light' | 'dark';
}

export const MeetNSplitLogo: React.FC<MeetNSplitLogoProps> = ({ 
  size = 'medium', 
  color = 'light' 
}) => {
  const getSizeConfig = () => {
    switch (size) {
      case 'tiny':
        return {
          fontSize: 16,
          lineWidth: 12,
          lineHeight: 1.5,
          gap: 4,
          dotSize: 4,
          spacing: -2,
        };
      case 'small':
        return {
          fontSize: 22,
          lineWidth: 15,
          lineHeight: 2,
          gap: 6,
          dotSize: 6,
          spacing: -1,
        };
      case 'medium':
        return {
          fontSize: 28,
          lineWidth: 40,
          lineHeight: 4,
          gap: 10,
          dotSize: 5,
          spacing: 6,
        };
      case 'large':
        return {
          fontSize: 40,
          lineWidth: 60,
          lineHeight: 6,
          gap: 12,
          dotSize: 7,
          spacing: 8,
        };
      default:
        return {
          fontSize: 28,
          lineWidth: 40,
          lineHeight: 4,
          gap: 10,
          dotSize: 5,
          spacing: 6,
        };
    }
  };

  const getColors = () => {
    return {
      main: color === 'light' ? '#1E3A5F' : '#FFFFFF',
      accent: '#FFB347',
    };
  };

  const config = getSizeConfig();
  const colors = getColors();

  return (
    <View style={styles.logoContainer}>
      {/* Meet - Top Row */}
      <View style={styles.row}>
        <Text style={[
          styles.text, 
          { 
            fontSize: config.fontSize, 
            color: colors.main,
          }
        ]}>
          Meet
        </Text>
      </View>

      {/* n with lines - Middle Row */}
      <View style={[styles.row, { marginVertical: config.spacing }]}>
        <View style={styles.nSection}>
          <View style={[
            styles.line,
            {
              width: config.lineWidth,
              height: config.lineHeight,
              backgroundColor: colors.accent,
            }
          ]} />
          <Text style={[
            styles.text,
            {
              fontSize: config.fontSize,
              color: colors.accent,
              marginHorizontal: config.gap,
            }
          ]}>
            n
          </Text>
          <View style={[
            styles.line,
            {
              width: config.lineWidth,
              height: config.lineHeight,
              backgroundColor: colors.accent,
            }
          ]} />
        </View>
      </View>

      {/* Split - Bottom Row */}
      <View style={styles.row}>
        <View style={styles.splitSection}>
          <Text style={[
            styles.text,
            {
              fontSize: config.fontSize,
              color: colors.main,
            }
          ]}>
            Spl
          </Text>
          
          {/* Dotless i with custom dot */}
          <View style={styles.iWrapper}>
            <Text style={[
              styles.text,
              {
                fontSize: config.fontSize,
                color: colors.main,
              }
            ]}>
              ı
            </Text>
            <View style={[
              styles.customDot,
              {
                width: config.dotSize,
                height: config.dotSize,
                backgroundColor: colors.accent,
                borderRadius: config.dotSize / 2,
                top: -config.fontSize * 0.2,
              }
            ]} />
          </View>
          
          <Text style={[
            styles.text,
            {
              fontSize: config.fontSize,
              color: colors.main,
            }
          ]}>
            t
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // Add some padding to ensure visibility
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '900',
    fontFamily: 'System',
    textAlign: 'center',
    // Ensure text is visible
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  nSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    borderRadius: 1,
  },
  splitSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  iWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  customDot: {
    position: 'absolute',
    alignSelf: 'center',
  },
});

export default MeetNSplitLogo;

/* 
BETTER ALTERNATIVE with react-native-safe-area-context:

1. Install: npm install react-native-safe-area-context
2. Wrap your app with SafeAreaProvider
3. Use this version:

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const MeetNSplitLogo: React.FC<MeetNSplitLogoProps> = ({ size, color }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.logoContainer, { paddingTop: insets.top + 20 }]}>
      // ... rest of component
    </View>
  );
};

USAGE EXAMPLES:
// Default with safe area handling
<MeetNSplitLogo />

// Disable safe area if used inside SafeAreaView
<MeetNSplitLogo avoidStatusBar={false} />

// Small size for headers  
<MeetNSplitLogo size="small" />
*/