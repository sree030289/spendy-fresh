// src/components/balance/BalanceComponents.tsx - FIXED Reusable Balance Display Components

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { BalanceDetail } from '@/services/BalanceManager';
import { getCurrencySymbol } from '@/utils/currency';

// =====================================================
// BALANCE CARD - Main balance overview card
// =====================================================
interface BalanceCardProps {
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  currency?: string;
  isLoading?: boolean;
  onPress?: () => void;
  showNet?: boolean;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalOwed,
  totalOwing,
  netBalance,
  currency = 'USD',
  isLoading = false,
  onPress,
  showNet = true
}) => {
  const { theme } = useTheme();
  const currencySymbol = getCurrencySymbol(currency);

  if (isLoading) {
    return (
      <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.balanceTitle}>Loading balances...</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      <Text style={styles.balanceTitle}>Your Balance</Text>
      <View style={styles.balanceGrid}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
            {currencySymbol}{totalOwed.toFixed(2)}
          </Text>
          <Text style={styles.balanceLabel}>You're owed</Text>
        </View>
        
        <View style={styles.balanceItem}>
          <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
            {currencySymbol}{totalOwing.toFixed(2)}
          </Text>
          <Text style={styles.balanceLabel}>You owe</Text>
        </View>
        
        {showNet && (
          <View style={styles.balanceItem}>
            <Text 
              style={[
                styles.balanceAmount, 
                { color: netBalance >= 0 ? '#FFD700' : '#FFA500' }
              ]} 
              numberOfLines={1} 
              adjustsFontSizeToFit
            >
              {netBalance >= 0 ? '+' : ''}{currencySymbol}{Math.abs(netBalance).toFixed(2)}
            </Text>
            <Text style={styles.balanceLabel}>Net balance</Text>
          </View>
        )}
      </View>
      
      {onPress && (
        <Text style={styles.balanceSubtext}>Tap to view details</Text>
      )}
    </TouchableOpacity>
  );
};

// =====================================================
// BALANCE ITEM - Individual person balance display
// =====================================================
interface BalanceItemProps {
  detail: BalanceDetail;
  currency?: string;
  onPress?: (detail: BalanceDetail) => void;
  showSource?: boolean;
  compact?: boolean;
}

export const BalanceItem: React.FC<BalanceItemProps> = ({
  detail,
  currency = 'USD',
  onPress,
  showSource = true,
  compact = false
}) => {
  const { theme } = useTheme();
  const currencySymbol = getCurrencySymbol(currency);
  
  // FIXED: Correct balance interpretation
  const getBalanceDisplay = () => {
    const absBalance = Math.abs(detail.balance);
    
    if (absBalance < 0.01) {
      return {
        text: 'Settled up',
        color: theme.colors.textSecondary,
        icon: 'checkmark-circle' as const
      };
    }
    
    // FIXED: Positive balance = they owe you, Negative balance = you owe them
    if (detail.balance > 0) {
      return {
        text: `Owes you ${currencySymbol}${absBalance.toFixed(2)}`,
        color: theme.colors.success,
        icon: 'arrow-up-circle' as const
      };
    }
    
    return {
      text: `You owe ${currencySymbol}${absBalance.toFixed(2)}`,
      color: theme.colors.error,
      icon: 'arrow-down-circle' as const
    };
  };

  const balanceDisplay = getBalanceDisplay();

  return (
    <TouchableOpacity
      style={[
        compact ? styles.balanceItemCompact : styles.balanceItemFull,
        { backgroundColor: theme.colors.surface }
      ]}
      onPress={() => onPress?.(detail)}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.balanceItemLeft}>
        <View style={[styles.personAvatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.personAvatarText}>
            {detail.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.personInfo}>
          <Text style={[styles.personName, { color: theme.colors.text }]} numberOfLines={1}>
            {detail.name}
          </Text>
          
          {!compact && (
            <Text style={[styles.personEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {detail.email}
            </Text>
          )}
          
          {showSource && detail.source === 'group' && detail.groupName && (
            <View style={styles.sourceIndicator}>
              <Ionicons name="people" size={12} color={theme.colors.primary} />
              <Text style={[styles.sourceText, { color: theme.colors.primary }]} numberOfLines={1}>
                {detail.groupName}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.balanceItemRight}>
        <View style={styles.balanceDisplay}>
          <Ionicons name={balanceDisplay.icon} size={16} color={balanceDisplay.color} />
          <Text style={[styles.balanceText, { color: balanceDisplay.color }]} numberOfLines={1}>
            {balanceDisplay.text}
          </Text>
        </View>
        
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

// =====================================================
// BALANCE SUMMARY - Compact summary for group cards
// =====================================================
interface BalanceSummaryProps {
  owedAmount: number;
  owingAmount: number;
  currency?: string;
  layout?: 'horizontal' | 'vertical';
}

export const BalanceSummary: React.FC<BalanceSummaryProps> = ({
  owedAmount,
  owingAmount,
  currency = 'USD',
  layout = 'horizontal'
}) => {
  const { theme } = useTheme();
  const currencySymbol = getCurrencySymbol(currency);
  
  const netBalance = owedAmount - owingAmount;
  const isHorizontal = layout === 'horizontal';

  if (Math.abs(netBalance) < 0.01) {
    return (
      <View style={[styles.balanceSummary, isHorizontal ? styles.horizontal : styles.vertical]}>
        <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
        <Text style={[styles.summaryText, { color: theme.colors.success }]}>
          Settled up
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.balanceSummary, isHorizontal ? styles.horizontal : styles.vertical]}>
      {netBalance > 0 ? (
        <>
          <Ionicons name="arrow-up-circle" size={16} color={theme.colors.success} />
          <Text style={[styles.summaryText, { color: theme.colors.success }]}>
            +{currencySymbol}{Math.abs(netBalance).toFixed(2)}
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="arrow-down-circle" size={16} color={theme.colors.error} />
          <Text style={[styles.summaryText, { color: theme.colors.error }]}>
            -{currencySymbol}{Math.abs(netBalance).toFixed(2)}
          </Text>
        </>
      )}
    </View>
  );
};

// =====================================================
// EMPTY BALANCE STATE - When no balances exist
// =====================================================
interface EmptyBalanceStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyBalanceState: React.FC<EmptyBalanceStateProps> = ({
  title = "No Balances",
  message = "Add friends or join groups to start splitting expenses",
  actionText = "Add Friends",
  onAction
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
      <Ionicons name="wallet-outline" size={64} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>{message}</Text>
      
      {onAction && (
        <TouchableOpacity
          style={[styles.emptyAction, { backgroundColor: theme.colors.primary }]}
          onPress={onAction}
        >
          <Text style={styles.emptyActionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// =====================================================
// BALANCE LIST - List of balance items with sections
// =====================================================
interface BalanceListProps {
  balances: BalanceDetail[];
  currency?: string;
  onItemPress?: (detail: BalanceDetail) => void;
  showSections?: boolean;
  emptyMessage?: string;
  isLoading?: boolean;
}

export const BalanceList: React.FC<BalanceListProps> = ({
  balances,
  currency = 'USD',
  onItemPress,
  showSections = false,
  emptyMessage = "No balances to show",
  isLoading = false
}) => {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading balances...
        </Text>
      </View>
    );
  }

  if (balances.length === 0) {
    return (
      <EmptyBalanceState 
        title="No Balances"
        message={emptyMessage}
      />
    );
  }

  if (showSections) {
    const friends = balances.filter(b => b.source === 'friend');
    const groupMembers = balances.filter(b => b.source === 'group');

    return (
      <View style={styles.balanceList}>
        {friends.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.colors.text }]}>
              Friends ({friends.length})
            </Text>
            {friends.map((detail, index) => (
              <BalanceItem
                key={`friend-${detail.userId}-${index}`}
                detail={detail}
                currency={currency}
                onPress={onItemPress}
                showSource={false}
              />
            ))}
          </View>
        )}

        {groupMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.colors.text }]}>
              Group Members ({groupMembers.length})
            </Text>
            {groupMembers.map((detail, index) => (
              <BalanceItem
                key={`group-${detail.userId}-${index}`}
                detail={detail}
                currency={currency}
                onPress={onItemPress}
                showSource={true}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.balanceList}>
      {balances.map((detail, index) => (
        <BalanceItem
          key={`balance-${detail.userId}-${index}`}
          detail={detail}
          currency={currency}
          onPress={onItemPress}
          showSource={true}
        />
      ))}
    </View>
  );
};

// =====================================================
// BALANCE REFRESH BUTTON - Manual refresh control
// =====================================================
interface BalanceRefreshButtonProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  size?: 'small' | 'large';
}

export const BalanceRefreshButton: React.FC<BalanceRefreshButtonProps> = ({
  onRefresh,
  isRefreshing = false,
  size = 'small'
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.refreshButton,
        size === 'large' && styles.refreshButtonLarge,
        { backgroundColor: theme.colors.surface }
      ]}
      onPress={onRefresh}
      disabled={isRefreshing}
    >
      <Ionicons 
        name="refresh" 
        size={size === 'large' ? 24 : 16} 
        color={isRefreshing ? theme.colors.textSecondary : theme.colors.primary} 
      />
      {size === 'large' && (
        <Text style={[styles.refreshButtonText, { color: theme.colors.primary }]}>
          {isRefreshing ? 'Refreshing...' : 'Refresh Balances'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// =====================================================
// STYLES
// =====================================================
const styles = StyleSheet.create({
  // Balance Card
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  balanceTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  balanceItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
    maxWidth: '33.33%',
  },
  balanceAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  balanceSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },

  // Balance Item
  balanceItemFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  balanceItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  balanceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  balanceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  personInfo: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  personEmail: {
    fontSize: 12,
    marginBottom: 2,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Balance Summary
  balanceSummary: {
    alignItems: 'center',
    gap: 4,
  },
  horizontal: {
    flexDirection: 'row',
  },
  vertical: {
    flexDirection: 'column',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAction: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Balance List
  balanceList: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },

  // Refresh Button
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  refreshButtonLarge: {
    padding: 12,
    gap: 12,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default {
  BalanceCard,
  BalanceItem,
  BalanceSummary,
  EmptyBalanceState,
  BalanceList,
  BalanceRefreshButton,
};