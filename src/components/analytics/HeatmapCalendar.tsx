// src/components/analytics/HeatmapCalendar.tsx
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HeatmapData {
  date: string;
  amount: number;
}

interface HeatmapCalendarProps {
  data: HeatmapData[];
  maxAmount: number;
}

export default function HeatmapCalendar({ data, maxAmount }: HeatmapCalendarProps) {
  const getIntensity = (amount: number) => {
    if (amount === 0) return 0;
    const intensity = (amount / maxAmount) * 100;
    if (intensity < 25) return 0.3;
    if (intensity < 50) return 0.5;
    if (intensity < 75) return 0.7;
    return 1;
  };

  const getColor = (intensity: number) => {
    const baseColor = '#B0004F';
    if (intensity === 0) return '#F0F0F0';
    return baseColor;
  };

  // Group data by weeks (7 days)
  const weeks: HeatmapData[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((day, dayIndex) => {
              const intensity = getIntensity(day.amount);
              return (
                <View
                  key={dayIndex}
                  style={[
                    styles.day,
                    {
                      backgroundColor: getColor(intensity),
                      opacity: intensity || 1,
                    },
                  ]}
                >
                  <Text style={styles.dayText}>
                    {new Date(day.date).getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        {[0.3, 0.5, 0.7, 1].map((intensity, index) => (
          <View
            key={index}
            style={[
              styles.legendBox,
              {
                backgroundColor: '#B0004F',
                opacity: intensity,
              },
            ]}
          />
        ))}
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  grid: {
    flexDirection: 'row',
  },
  week: {
    flex: 1,
    marginHorizontal: 2,
  },
  day: {
    aspectRatio: 1,
    borderRadius: 4,
    marginVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});
