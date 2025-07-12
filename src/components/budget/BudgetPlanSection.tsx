// src/components/budget/BudgetPlanSection.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  allocated: number;
  spent: number;
  color: string;
}

interface BudgetPlanSectionProps {
  onManageBudget: () => void;
}

export default function BudgetPlanSection({ onManageBudget }: BudgetPlanSectionProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    loadBudgetData();
  }, []);

  const loadBudgetData = () => {
    // Sample budget data - in real app this would come from a service
    const sampleCategories: BudgetCategory[] = [
      {
        id: '1',
        name: 'Food & Dining',
        icon: '🍽️',
        allocated: 800,
        spent: 520,
        color: '#EF4444',
      },
      {
        id: '2',
        name: 'Transportation',
        icon: '🚗',
        allocated: 400,
        spent: 285,
        color: '#3B82F6',
      },
      {
        id: '3',
        name: 'Entertainment',
        icon: '🎬',
        allocated: 300,
        spent: 180,
        color: '#8B5CF6',
      },
      {
        id: '4',
        name: 'Shopping',
        icon: '🛒',
        allocated: 500,
        spent: 625,
        color: '#F59E0B',
      },
    ];

    setBudgetCategories(sampleCategories);
    setTotalBudget(sampleCategories.reduce((sum, cat) => sum + cat.allocated, 0));
    setTotalSpent(sampleCategories.reduce((sum, cat) => sum + cat.spent, 0));
  };

  const getProgressPercentage = (spent: number, allocated: number) => {
    return Math.min((spent / allocated) * 100, 100);
  };

  const getProgressColor = (spent: number, allocated: number) => {
    const percentage = (spent / allocated) * 100;
    if (percentage > 100) return '#EF4444'; // Red for over budget
    if (percentage > 80) return '#F59E0B'; // Amber for near limit
    return '#10B981'; // Green for on track
  };

  const renderBudgetOverview = () => {
    const overallProgress = (totalSpent / totalBudget) * 100;
    
    return (
      <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.overviewHeader}>
          <View>
            <Text style={[styles.overviewTitle, { color: theme.colors.text }]}>
              Family Budget Overview
            </Text>
            <Text style={[styles.overviewSubtitle, { color: theme.colors.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.manageButton, { backgroundColor: theme.colors.primary }]}
            onPress={onManageBudget}
          >
            <Ionicons name="settings" size={16} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressAmount, { color: theme.colors.text }]}>
              ${totalSpent.toFixed(0)} / ${totalBudget.toFixed(0)}
            </Text>
            <Text style={[styles.progressLabel, { color: theme.colors.textSecondary }]}>
              {overallProgress > 100 ? 'Over Budget' : 'Remaining: $' + (totalBudget - totalSpent).toFixed(0)}
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(overallProgress, 100)}%`,
                  backgroundColor: getProgressColor(totalSpent, totalBudget),
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderBudgetCategories = () => {
    return (
      <View style={styles.categoriesContainer}>
        {budgetCategories.slice(0, 3).map((category) => {
          const progress = getProgressPercentage(category.spent, category.allocated);
          const progressColor = getProgressColor(category.spent, category.allocated);
          
          return (
            <View
              key={category.id}
              style={[styles.categoryCard, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.categoryHeader}>
                <View style={styles.categoryIcon}>
                  <Text style={styles.categoryEmoji}>{category.icon}</Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                    {category.name}
                  </Text>
                  <Text style={[styles.categoryAmount, { color: theme.colors.textSecondary }]}>
                    ${category.spent} / ${category.allocated}
                  </Text>
                </View>
                <View style={styles.categoryStatus}>
                  {category.spent > category.allocated ? (
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  ) : (
                    <Text style={[styles.categoryPercentage, { color: progressColor }]}>
                      {progress.toFixed(0)}%
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.categoryProgressBar, { backgroundColor: theme.colors.border }]}>
                <View
                  style={[
                    styles.categoryProgressFill,
                    {
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: progressColor,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Ionicons name="pie-chart" color="#10B981" size={24} />
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Budget Plan for Family
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#10B981' }]}
          onPress={onManageBudget}
        >
          <Ionicons name="add" color="#FFFFFF" size={20} />
        </TouchableOpacity>
      </View>

      {budgetCategories.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="pie-chart-outline" color="#D1D5DB" size={40} />
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            No budget plan set up
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
            Create a family budget to track spending across categories
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: theme.colors.primary }]}
            onPress={onManageBudget}
          >
            <Text style={styles.setupButtonText}>Set Up Budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {renderBudgetOverview()}
          {renderBudgetCategories()}
          
          <TouchableOpacity
            style={[styles.viewAllButton, { borderColor: theme.colors.border }]}
            onPress={onManageBudget}
          >
            <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
              Manage Budget Plan
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  setupButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  setupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  overviewCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  overviewSubtitle: {
    fontSize: 14,
  },
  manageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    gap: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressLabel: {
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoriesContainer: {
    gap: 12,
  },
  categoryCard: {
    padding: 16,
    borderRadius: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoryAmount: {
    fontSize: 12,
  },
  categoryStatus: {
    alignItems: 'flex-end',
  },
  categoryPercentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryProgressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
});