import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';

const { width: screenWidth } = Dimensions.get('window');

interface DatePickerCalendarModalProps {
  visible: boolean;
  selectedDate: Date;
  maximumDate?: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DatePickerCalendarModal({
  visible,
  selectedDate,
  maximumDate = new Date(),
  onDateSelect,
  onClose,
}: DatePickerCalendarModalProps) {
  const { theme } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');

  // Reset view mode when modal opens
  React.useEffect(() => {
    if (visible) {
      setViewMode('days');
      setCurrentMonth(selectedDate.getMonth());
      setCurrentYear(selectedDate.getFullYear());
    }
  }, [visible, selectedDate]);

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Add empty spaces for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const isDisabled = date > maximumDate;

      days.push({
        day,
        date,
        isToday,
        isSelected,
        isDisabled,
      });
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    console.log('📅 Navigating month:', direction, 'from', currentMonth, currentYear);
    
    let newMonth = currentMonth;
    let newYear = currentYear;
    
    if (direction === 'prev') {
      if (currentMonth === 0) {
        newMonth = 11;
        newYear = currentYear - 1;
      } else {
        newMonth = currentMonth - 1;
      }
    } else {
      if (currentMonth === 11) {
        newMonth = 0;
        newYear = currentYear + 1;
      } else {
        newMonth = currentMonth + 1;
      }
    }
    
    // Prevent navigation too far into the past (2 years ago) or future (1 year ahead)
    const currentDate = new Date();
    const minYear = currentDate.getFullYear() - 2;
    const maxYear = currentDate.getFullYear() + 1;
    
    if (newYear < minYear || newYear > maxYear) {
      console.log('📅 Navigation blocked - year out of bounds:', newYear);
      return;
    }
    
    console.log('📅 Setting new date:', newMonth, newYear);
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const handleDateSelect = (date: Date) => {
    onDateSelect(date);
    onClose();
  };

  const calendarDays = generateCalendarDays();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.headerCenter}>
              {viewMode === 'days' && (
                <View style={styles.dateSelector}>
                  <TouchableOpacity
                    onPress={() => setViewMode('months')}
                    style={styles.dateSelectorButton}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.monthText, { color: theme.colors.text }]}>
                      {MONTHS[currentMonth]}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setViewMode('years')}
                    style={styles.dateSelectorButton}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.yearText, { color: theme.colors.text }]}>
                      {currentYear}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {viewMode === 'months' && (
                <Text style={[styles.viewTitle, { color: theme.colors.text }]}>
                  Select Month
                </Text>
              )}
              {viewMode === 'years' && (
                <Text style={[styles.viewTitle, { color: theme.colors.text }]}>
                  Select Year
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content based on view mode */}
          {viewMode === 'days' && (
            <>
              {/* Weekday Headers */}
              <View style={styles.weekdayHeader}>
                {WEEKDAYS.map((weekday) => (
                  <View key={weekday} style={styles.weekdayCell}>
                    <Text style={[styles.weekdayText, { color: theme.colors.textSecondary }]}>
                      {weekday}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <ScrollView contentContainerStyle={styles.calendarContainer}>
                <View style={styles.calendarGrid}>
                  {calendarDays.map((dayData, index) => (
                    <View key={index} style={styles.dayCell}>
                      {dayData ? (
                        <TouchableOpacity
                          style={[
                            styles.dayButton,
                            dayData.isSelected && [
                              styles.selectedDay,
                              { backgroundColor: theme.colors.primary }
                            ],
                            dayData.isToday && !dayData.isSelected && [
                              styles.todayDay,
                              { borderColor: theme.colors.primary }
                            ],
                            dayData.isDisabled && styles.disabledDay
                          ]}
                          onPress={() => !dayData.isDisabled && handleDateSelect(dayData.date)}
                          disabled={dayData.isDisabled}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              { color: theme.colors.text },
                              dayData.isSelected && styles.selectedDayText,
                              dayData.isToday && !dayData.isSelected && [
                                styles.todayDayText,
                                { color: theme.colors.primary }
                              ],
                              dayData.isDisabled && [
                                styles.disabledDayText,
                                { color: theme.colors.textSecondary }
                              ]
                            ]}
                          >
                            {dayData.day}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.emptyDay} />
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {/* Months Grid */}
          {viewMode === 'months' && (
            <ScrollView contentContainerStyle={styles.monthsContainer}>
              <View style={styles.monthsGrid}>
                {MONTHS.map((month, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.monthButton,
                      { backgroundColor: theme.colors.surface },
                      index === currentMonth && [
                        styles.selectedMonth,
                        { backgroundColor: theme.colors.primary }
                      ]
                    ]}
                    onPress={() => {
                      setCurrentMonth(index);
                      setViewMode('days');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.monthButtonText,
                        { color: theme.colors.text },
                        index === currentMonth && styles.selectedMonthText
                      ]}
                    >
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Years Grid */}
          {viewMode === 'years' && (
            <ScrollView contentContainerStyle={styles.yearsContainer}>
              <View style={styles.yearsGrid}>
                {(() => {
                  const currentYearValue = new Date().getFullYear();
                  const years = [];
                  // Show last 9 years (including current year)
                  for (let i = 8; i >= 0; i--) {
                    years.push(currentYearValue - i);
                  }
                  return years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.yearButton,
                        { backgroundColor: theme.colors.surface },
                        year === currentYear && [
                          styles.selectedYear,
                          { backgroundColor: theme.colors.primary }
                        ]
                      ]}
                      onPress={() => {
                        setCurrentYear(year);
                        setViewMode('days');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.yearButtonText,
                          { color: theme.colors.text },
                          year === currentYear && styles.selectedYearText
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ));
                })()}
              </View>
            </ScrollView>
          )}

          {/* Footer with Today button */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.todayButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => handleDateSelect(new Date())}
            >
              <Text style={[styles.todayButtonText, { color: theme.colors.primary }]}>
                Today
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateSelectorButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
  },
  yearText: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '600',
  },
  navButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 4,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 4,
  },
  weekdayHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  calendarContainer: {
    padding: 16,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    padding: 2,
  },
  dayButton: {
    flex: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDay: {
    flex: 1,
  },
  selectedDay: {
    // backgroundColor set dynamically
  },
  todayDay: {
    borderWidth: 2,
    // borderColor set dynamically
  },
  disabledDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedDayText: {
    color: 'white',
    fontWeight: '600',
  },
  todayDayText: {
    fontWeight: '600',
  },
  disabledDayText: {
    // color set dynamically
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  todayButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  todayButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Months view styles
  monthsContainer: {
    padding: 16,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  monthButton: {
    width: '30%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectedMonth: {
    // backgroundColor set dynamically
  },
  monthButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedMonthText: {
    color: 'white',
    fontWeight: '600',
  },
  // Years view styles
  yearsContainer: {
    padding: 16,
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  yearButton: {
    width: '30%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectedYear: {
    // backgroundColor set dynamically
  },
  yearButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedYearText: {
    color: 'white',
    fontWeight: '600',
  },
});