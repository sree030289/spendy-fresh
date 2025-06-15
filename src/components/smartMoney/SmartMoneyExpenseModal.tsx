// src/components/modals/SmartMoneyExpenseModal.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    StyleSheet,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { getCurrencySymbol } from '@/utils/currency';
import ReceiptScannerModal from './ReceiptScannerModal';

interface SmartMoneyExpenseModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (expenseData: any) => void;
}

const SMART_CATEGORIES = [
    { id: 'food', name: 'Food & Dining', icon: '🍽️', color: '#EF4444' },
    { id: 'transport', name: 'Transportation', icon: '🚗', color: '#3B82F6' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#8B5CF6' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#F59E0B' },
    { id: 'utilities', name: 'Bills & Utilities', icon: '⚡', color: '#10B981' },
    { id: 'healthcare', name: 'Health & Fitness', icon: '🏥', color: '#06B6D4' },
    { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#84CC16' },
    { id: 'housing', name: 'Housing', icon: '🏠', color: '#F97316' },
    { id: 'education', name: 'Education', icon: '📚', color: '#6366F1' },
    { id: 'travel', name: 'Travel', icon: '✈️', color: '#EC4899' },
    { id: 'other', name: 'Other', icon: '💰', color: '#6B7280' },
];

export default function SmartMoneyExpenseModal({ visible, onClose, onSubmit }: SmartMoneyExpenseModalProps) {
    const { theme } = useTheme();
    const { user } = useAuth();
    
    // Form state
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(SMART_CATEGORIES[0]);
    const [merchant, setMerchant] = useState('');
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [customTag, setCustomTag] = useState('');
    
    // Feature toggles
    const [isRecurring, setIsRecurring] = useState(false);
    const [canSplit, setCanSplit] = useState(false);
    const [enableAI, setEnableAI] = useState(true);
    
    // AI suggestions
    const [aiSuggestions, setAiSuggestions] = useState<any>(null);
    const [showReceiptScanner, setShowReceiptScanner] = useState(false);
    
    // Form validation
    const [errors, setErrors] = useState<any>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            resetForm();
        }
    }, [visible]);

    useEffect(() => {
        if (description.length > 2 && enableAI) {
            generateAISuggestions();
        }
    }, [description, enableAI]);

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setSelectedCategory(SMART_CATEGORIES[0]);
        setMerchant('');
        setLocation('');
        setNotes('');
        setExpenseDate(new Date());
        setTags([]);
        setCustomTag('');
        setIsRecurring(false);
        setCanSplit(false);
        setEnableAI(true);
        setAiSuggestions(null);
        setErrors({});
    };

    const generateAISuggestions = () => {
        // Simulate AI suggestions based on description
        const descLower = description.toLowerCase();
        let suggestions = null;

        if (descLower.includes('starbucks') || descLower.includes('coffee')) {
            suggestions = {
                category: SMART_CATEGORIES.find(c => c.id === 'food'),
                merchant: 'Starbucks',
                tags: ['coffee', 'work'],
                canSplit: true,
                confidence: 0.95
            };
        } else if (descLower.includes('uber') || descLower.includes('taxi')) {
            suggestions = {
                category: SMART_CATEGORIES.find(c => c.id === 'transport'),
                merchant: 'Uber',
                tags: ['transport', 'travel'],
                canSplit: true,
                confidence: 0.92
            };
        } else if (descLower.includes('grocery') || descLower.includes('supermarket')) {
            suggestions = {
                category: SMART_CATEGORIES.find(c => c.id === 'groceries'),
                tags: ['groceries', 'food'],
                canSplit: false,
                confidence: 0.88
            };
        } else if (descLower.includes('restaurant') || descLower.includes('dinner')) {
            suggestions = {
                category: SMART_CATEGORIES.find(c => c.id === 'food'),
                tags: ['dining', 'food'],
                canSplit: true,
                confidence: 0.85
            };
        }

        setAiSuggestions(suggestions);
    };

    const applyAISuggestions = () => {
        if (!aiSuggestions) return;

        if (aiSuggestions.category) {
            setSelectedCategory(aiSuggestions.category);
        }
        if (aiSuggestions.merchant) {
            setMerchant(aiSuggestions.merchant);
        }
        if (aiSuggestions.tags) {
            setTags(prev => [...new Set([...prev, ...aiSuggestions.tags])]);
        }
        if (aiSuggestions.canSplit !== undefined) {
            setCanSplit(aiSuggestions.canSplit);
        }
    };

    const validateForm = () => {
        const newErrors: any = {};

        if (!description.trim()) {
            newErrors.description = 'Description is required';
        }
        if (!amount.trim()) {
            newErrors.amount = 'Amount is required';
        } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            newErrors.amount = 'Please enter a valid amount';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const expenseData = {
                description: description.trim(),
                amount: parseFloat(amount),
                category: selectedCategory.id,
                categoryIcon: selectedCategory.icon,
                merchant: merchant.trim() || 'Unknown',
                location: location.trim(),
                notes: notes.trim(),
                tags: [...tags, selectedCategory.id],
                date: expenseDate,
                isRecurring,
                canSplit,
                aiSuggestions: aiSuggestions ? {
                    applied: true,
                    confidence: aiSuggestions.confidence,
                    originalSuggestion: aiSuggestions
                } : null
            };

            await onSubmit(expenseData);
            resetForm();
        } catch (error) {
            // Error handled in parent
        } finally {
            setLoading(false);
        }
    };

    const addTag = () => {
        if (customTag.trim() && !tags.includes(customTag.trim().toLowerCase())) {
            setTags([...tags, customTag.trim().toLowerCase()]);
            setCustomTag('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleReceiptData = (receiptData: any) => {
        if (receiptData.merchant) {
            setDescription(receiptData.merchant);
        }
        if (receiptData.total) {
            setAmount(receiptData.total.toString());
        }
        if (receiptData.date) {
            setExpenseDate(new Date(receiptData.date));
        }
        setShowReceiptScanner(false);
    };

    const suggestedTags = ['work', 'personal', 'business', 'travel', 'recurring'];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={onClose} disabled={loading}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                        Smart Money Expense
                    </Text>
                    <TouchableOpacity onPress={() => setShowReceiptScanner(true)}>
                        <Ionicons name="camera" size={24} color="#00C851" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* AI Suggestions Banner */}
                    {aiSuggestions && (
                        <View style={[styles.aiSuggestionsBanner, { backgroundColor: '#00C851' + '10' }]}>
                            <View style={styles.aiSuggestionsHeader}>
                                <Ionicons name="sparkles" size={20} color="#00C851" />
                                <Text style={[styles.aiSuggestionsTitle, { color: '#00C851' }]}>
                                    AI Suggestions ({Math.round(aiSuggestions.confidence * 100)}% confidence)
                                </Text>
                            </View>
                            <Text style={[styles.aiSuggestionsText, { color: theme.colors.textSecondary }]}>
                                Based on "{description}", we suggest category: {aiSuggestions.category?.name}
                            </Text>
                            <TouchableOpacity
                                style={[styles.applySuggestionsButton, { backgroundColor: '#00C851' }]}
                                onPress={applyAISuggestions}
                            >
                                <Text style={styles.applySuggestionsText}>Apply Suggestions</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Description */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                            Description *
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: errors.description ? theme.colors.error : theme.colors.border,
                                    color: theme.colors.text,
                                }
                            ]}
                            placeholder="What did you spend on?"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={description}
                            onChangeText={(text) => {
                                setDescription(text);
                                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                            }}
                            maxLength={100}
                        />
                        {errors.description && (
                            <Text style={[styles.errorText, { color: theme.colors.error }]}>
                                {errors.description}
                            </Text>
                        )}
                    </View>

                    {/* Amount */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                            Amount *
                        </Text>
                        <View style={styles.amountInputContainer}>
                            <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>
                                {getCurrencySymbol(user?.currency || 'USD')}
                            </Text>
                            <TextInput
                                style={[
                                    styles.amountInput,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: errors.amount ? theme.colors.error : theme.colors.border,
                                        color: theme.colors.text,
                                    }
                                ]}
                                placeholder="0.00"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={amount}
                                onChangeText={(text) => {
                                    setAmount(text);
                                    if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
                                }}
                                keyboardType="decimal-pad"
                            />
                        </View>
                        {errors.amount && (
                            <Text style={[styles.errorText, { color: theme.colors.error }]}>
                                {errors.amount}
                            </Text>
                        )}
                    </View>

                    {/* Category */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                            Category
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.categoryList}>
                                {SMART_CATEGORIES.map((category) => (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={[
                                            styles.categoryItem,
                                            selectedCategory.id === category.id && [
                                                styles.selectedCategory,
                                                { backgroundColor: category.color + '20', borderColor: category.color }
                                            ]
                                        ]}
                                        onPress={() => setSelectedCategory(category)}
                                    >
                                        <Text style={styles.categoryIcon}>{category.icon}</Text>
                                        <Text style={[
                                            styles.categoryName,
                                            {
                                                color: selectedCategory.id === category.id 
                                                    ? category.color 
                                                    : theme.colors.textSecondary
                                            }
                                        ]}>
                                            {category.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Merchant & Location */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                            Merchant
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: theme.colors.border,
                                    color: theme.colors.text,
                                }
                            ]}
                            placeholder="Where did you spend?"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={merchant}
                            onChangeText={setMerchant}
                        />
                    </View>

                    {/* Smart Features */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                            Smart Features
                        </Text>
                        
                        <View style={styles.featuresContainer}>
                            <TouchableOpacity
                                style={[styles.featureToggle, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setCanSplit(!canSplit)}
                            >
                                <View style={styles.featureToggleLeft}>
                                    <Ionicons name="people" size={20} color="#3B82F6" />
                                    <View style={styles.featureToggleText}>
                                        <Text style={[styles.featureToggleTitle, { color: theme.colors.text }]}>
                                            Splittable Expense
                                        </Text>
                                        <Text style={[styles.featureToggleSubtitle, { color: theme.colors.textSecondary }]}>
                                            Can be shared with others
                                        </Text>
                                    </View>
                                </View>
                                <View style={[
                                    styles.toggle,
                                    canSplit && { backgroundColor: '#3B82F6' }
                                ]}>
                                    <View style={[
                                        styles.toggleKnob,
                                        canSplit && styles.toggleKnobActive
                                    ]} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.featureToggle, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setIsRecurring(!isRecurring)}
                            >
                                <View style={styles.featureToggleLeft}>
                                    <Ionicons name="repeat" size={20} color="#F59E0B" />
                                    <View style={styles.featureToggleText}>
                                        <Text style={[styles.featureToggleTitle, { color: theme.colors.text }]}>
                                            Recurring Expense
                                        </Text>
                                        <Text style={[styles.featureToggleSubtitle, { color: theme.colors.textSecondary }]}>
                                            Repeats regularly
                                        </Text>
                                    </View>
                                </View>
                                <View style={[
                                    styles.toggle,
                                    isRecurring && { backgroundColor: '#F59E0B' }
                                ]}>
                                    <View style={[
                                        styles.toggleKnob,
                                        isRecurring && styles.toggleKnobActive
                                    ]} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Tags */}
                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                            Tags
                        </Text>
                        
                        {tags.length > 0 && (
                            <View style={styles.tagsContainer}>
                                {tags.map((tag, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.tag, { backgroundColor: '#00C851' + '20' }]}
                                        onPress={() => removeTag(tag)}
                                    >
                                        <Text style={[styles.tagText, { color: '#00C851' }]}>{tag}</Text>
                                        <Ionicons name="close" size={14} color="#00C851" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View style={styles.addTagContainer}>
                            <TextInput
                                style={[
                                    styles.tagInput,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.border,
                                        color: theme.colors.text,
                                    }
                                ]}
                                placeholder="Add a tag"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={customTag}
                                onChangeText={setCustomTag}
                                onSubmitEditing={addTag}
                                returnKeyType="done"
                            />
                            <TouchableOpacity onPress={addTag} style={styles.addTagButton}>
                                <Ionicons name="add" size={20} color="#00C851" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.suggestedTags}>
                            {suggestedTags.filter(tag => !tags.includes(tag)).map((tag) => (
                                <TouchableOpacity
                                    key={tag}
                                    style={[styles.suggestedTag, { backgroundColor: theme.colors.surface }]}
                                    onPress={() => setTags([...tags, tag])}
                                >
                                    <Text style={[styles.suggestedTagText, { color: theme.colors.textSecondary }]}>
                                        {tag}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                    <Button
                        title="Add Smart Expense"
                        onPress={handleSubmit}
                        loading={loading}
                        style={styles.submitButton}
                        icon="sparkles"
                    />
                </View>
            </SafeAreaView>

            {/* Receipt Scanner Modal */}
            <ReceiptScannerModal
                visible={showReceiptScanner}
                onClose={() => setShowReceiptScanner(false)}
                onReceiptProcessed={handleReceiptData}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    aiSuggestionsBanner: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    aiSuggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    aiSuggestionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    aiSuggestionsText: {
        fontSize: 14,
        marginBottom: 12,
    },
    applySuggestionsButton: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: 'flex-start',
    },
    applySuggestionsText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'white',
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencySymbol: {
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 18,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 14,
        marginTop: 6,
    },
    categoryList: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 4,
    },
    categoryItem: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 2,
        borderColor: 'transparent',
        minWidth: 80,
    },
    selectedCategory: {
        borderWidth: 2,
    },
    categoryIcon: {
        fontSize: 24,
        marginBottom: 4,
    },
    categoryName: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    featuresContainer: {
        gap: 12,
    },
    featureToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
    },
    featureToggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    featureToggleText: {
        marginLeft: 12,
    },
    featureToggleTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    featureToggleSubtitle: {
        fontSize: 14,
    },
    toggle: {
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#E5E7EB',
        padding: 2,
        justifyContent: 'center',
    },
    toggleKnob: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'white',
    },
    toggleKnobActive: {
        transform: [{ translateX: 20 }],
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        fontSize: 14,
        marginRight: 6,
    },
    addTagContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    tagInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
    },
    addTagButton: {
        marginLeft: 8,
        padding: 8,
    },
    suggestedTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    suggestedTag: {
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    suggestedTagText: {
        fontSize: 14,
    },
    footer: {
        borderTopWidth: 1,
        padding: 20,
    },
    submitButton: {
        width: '100%',
    },
});