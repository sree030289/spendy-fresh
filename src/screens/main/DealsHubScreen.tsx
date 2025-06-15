import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { DealsAPI, useDeals, Deal } from '@/services/DealsAPI';

interface ChatMessage {
  id: string;
  dealId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}

// Robinhood Green Color Palette
const COLORS = {
  primary: '#00C851',
  primaryDark: '#00A843',
  primaryLight: '#4FD66D',
  background: '#0D0D0D',
  surface: '#1A1A1A',
  cardBg: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#666666',
  accent: '#00FF5F',
  warning: '#FF6B35',
  error: '#FF4757',
  success: '#2ED573',
};

const DEAL_CATEGORIES = ['All', 'OTT', 'Freebies', 'Group Buying', 'Local Deals', 'Partners'];

const DealsHubScreen: React.FC = () => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showPostModal, setShowPostModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  // Use the custom hook for deals management
  const {
    deals,
    loading,
    error,
    pagination,
    lastUpdated,
    refreshDeals,
    loadMore,
    canLoadMore,
  } = useDeals(selectedCategory);

  // Post Deal Form State
  const [postForm, setPostForm] = useState({
    title: '',
    description: '',
    category: 'OTT' as Deal['category'],
    originalPrice: '',
    discountedPrice: '',
    businessName: '',
    location: '',
    isGroupDeal: false,
    maxParticipants: '',
    expiresAt: new Date(),
  });

  // Filter deals based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = deals.filter(deal => 
        deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.businessName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDeals(filtered);
    } else {
      setFilteredDeals(deals);
    }
  }, [deals, searchQuery]);

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    try {
      await refreshDeals();
      Alert.alert(
        'Deals Updated! 🎉',
        `Found ${pagination?.totalDeals || 0} deals. Swipe down anytime to refresh!`,
        [{ text: 'Great!', style: 'default' }]
      );
    } catch (error) {
      Alert.alert('Refresh Failed', 'Unable to fetch latest deals. Please try again.');
    } finally {
      setIsManualRefresh(false);
    }
  }, [refreshDeals, pagination?.totalDeals]);

  const handlePostDeal = async () => {
    if (!postForm.title || !postForm.description || !postForm.originalPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // This would integrate with your backend to post user-generated deals
    Alert.alert('Coming Soon', 'User-generated deals will be available in the next update!');
    setShowPostModal(false);
    resetPostForm();
  };

  const resetPostForm = () => {
    setPostForm({
      title: '',
      description: '',
      category: 'OTT',
      originalPrice: '',
      discountedPrice: '',
      businessName: '',
      location: '',
      isGroupDeal: false,
      maxParticipants: '',
      expiresAt: new Date(),
    });
  };

  const handleLike = async (deal: Deal) => {
    const newLikedState = !deal.userLiked;
    
    // Optimistic update
    const updatedDeals = deals.map(d => {
      if (d.id === deal.id) {
        return {
          ...d,
          likes: newLikedState ? d.likes + 1 : d.likes - 1,
          dislikes: d.userDisliked ? d.dislikes - 1 : d.dislikes,
          userLiked: newLikedState,
          userDisliked: false,
        };
      }
      return d;
    });

    // Update local cache
    await DealsAPI.updateDealInteraction(deal.id, { 
      liked: newLikedState,
      disliked: false 
    });
  };

  const handleDislike = async (deal: Deal) => {
    const newDislikedState = !deal.userDisliked;
    
    // Update local cache
    await DealsAPI.updateDealInteraction(deal.id, { 
      disliked: newDislikedState,
      liked: false 
    });
  };

  const openDealUrl = async (deal: Deal) => {
    if (deal.dealUrl) {
      try {
        const supported = await Linking.canOpenURL(deal.dealUrl);
        if (supported) {
          await Linking.openURL(deal.dealUrl);
        } else {
          Alert.alert('Error', 'Cannot open deal link');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to open deal link');
      }
    } else {
      Alert.alert('No Link', 'This deal does not have a direct link available');
    }
  };

  const openChat = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowChatModal(true);
    setChatMessages([
      {
        id: '1',
        dealId: deal.id,
        userId: 'system',
        userName: 'System',
        message: `Welcome to the chat for "${deal.title}". Ask questions or share your experience!`,
        timestamp: new Date(),
      }
    ]);
  };

  const handleShareDeal = async (deal: Deal) => {
    try {
      const shareMessage = `💚 DEAL ALERT from Spendy! 💚

${deal.title}

💰 Was: ${deal.originalPrice}
✨ Now: ${deal.discountedPrice}
🎯 Save ${deal.discount}% OFF!

${deal.description}

${deal.dealUrl ? `\n🔗 ${deal.dealUrl}` : ''}

Found this amazing deal on Spendy app!`;

      await Share.share({
        message: shareMessage,
        title: `${deal.title} - ${deal.discount}% OFF`,
        url: deal.dealUrl,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share deal. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDeal) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      dealId: selectedDeal.id,
      userId: 'current-user',
      userName: 'You',
      message: newMessage,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      'OTT': 'tv',
      'Freebies': 'gift',
      'Group Buying': 'people',
      'Local Deals': 'location',
      'Partners': 'business',
    };
    return icons[category as keyof typeof icons] || 'pricetag';
  };

  const getSourceBadge = (source?: string) => {
    const badges = {
      'ozbargain': { text: 'OzBargain', color: '#FF6B35' },
      'groupon': { text: 'Groupon', color: '#53B83A' },
      'catch': { text: 'Catch', color: '#E31E24' },
      'partner': { text: 'Partner', color: COLORS.accent },
      'user': { text: 'Community', color: COLORS.primary },
    };
    return badges[source as keyof typeof badges] || badges.user;
  };

  const renderDealCard = ({ item: deal }: { item: Deal }) => {
    const isExpiringSoon = new Date(deal.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;
    const sourceBadge = getSourceBadge(deal.source);

    return (
      <TouchableOpacity 
        style={[styles.dealCard, { backgroundColor: COLORS.cardBg }]}
        onPress={() => openDealUrl(deal)}
        activeOpacity={0.9}
      >
        {/* Header */}
        <View style={styles.dealHeader}>
          <View style={styles.dealBadges}>
            <View style={[styles.categoryBadge, { backgroundColor: COLORS.primary }]}>
              <Ionicons 
                name={getCategoryIcon(deal.category) as any} 
                size={12} 
                color="white" 
              />
              <Text style={styles.categoryText}>{deal.category}</Text>
            </View>
            
            <View style={[styles.sourceBadge, { backgroundColor: sourceBadge.color }]}>
              <Text style={styles.sourceText}>{sourceBadge.text}</Text>
            </View>
            
            {isExpiringSoon && (
              <View style={styles.urgentBadge}>
                <Ionicons name="time" size={10} color={COLORS.warning} />
                <Text style={[styles.urgentText, { color: COLORS.warning }]}>Expiring Soon</Text>
              </View>
            )}
          </View>
          <View style={[styles.discountBadge, { backgroundColor: COLORS.success }]}>
            <Text style={styles.discountText}>{deal.discount}%</Text>
            <Text style={styles.offText}>OFF</Text>
          </View>
        </View>

        {/* Title & Description */}
        <Text style={[styles.dealTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
          {deal.title}
        </Text>
        <Text style={[styles.dealDescription, { color: COLORS.textSecondary }]} numberOfLines={2}>
          {deal.description}
        </Text>

        {/* Business Info */}
        {deal.businessName && (
          <View style={styles.businessInfo}>
            <Ionicons name="business" size={14} color={COLORS.textMuted} />
            <Text style={[styles.businessName, { color: COLORS.textSecondary }]}>
              {deal.businessName}
            </Text>
          </View>
        )}

        {/* Location */}
        {deal.location && (
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={14} color={COLORS.textMuted} />
            <Text style={[styles.locationText, { color: COLORS.textMuted }]}>
              {deal.location}
            </Text>
          </View>
        )}

        {/* Pricing */}
        <View style={styles.pricingSection}>
          <View style={styles.priceContainer}>
            <Text style={[styles.originalPrice, { color: COLORS.textMuted }]}>
              ${deal.originalPrice.toFixed(2)}
            </Text>
            <Text style={[styles.discountedPrice, { color: COLORS.primary }]}>
              ${deal.discountedPrice.toFixed(2)}
            </Text>
          </View>
          <Text style={[styles.savedAmount, { color: COLORS.success }]}>
            Save ${(deal.originalPrice - deal.discountedPrice).toFixed(2)}
          </Text>
        </View>

        {/* Group Deal Progress */}
        {deal.isGroupDeal && (
          <View style={styles.groupSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.groupTitle, { color: COLORS.textPrimary }]}>
                Group Progress
              </Text>
              <Text style={[styles.participantCount, { color: COLORS.textSecondary }]}>
                {deal.currentParticipants}/{deal.maxParticipants} joined
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: COLORS.surface }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${deal.groupProgress || 0}%`, backgroundColor: COLORS.primary }
                ]} 
              />
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <View style={styles.leftActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLike(deal)}
            >
              <Ionicons 
                name={deal.userLiked ? "heart" : "heart-outline"} 
                size={18} 
                color={deal.userLiked ? COLORS.error : COLORS.textMuted} 
              />
              <Text style={[styles.actionText, { color: COLORS.textMuted }]}>
                {deal.likes}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openChat(deal)}
            >
              <Ionicons name="chatbubble-outline" size={18} color={COLORS.textMuted} />
              <Text style={[styles.actionText, { color: COLORS.textMuted }]}>Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShareDeal(deal)}
            >
              <Ionicons name="share-outline" size={18} color={COLORS.textMuted} />
              <Text style={[styles.actionText, { color: COLORS.textMuted }]}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.claimButton, { backgroundColor: COLORS.primary }]}
            onPress={() => openDealUrl(deal)}
          >
            <Text style={styles.claimText}>Get Deal</Text>
            <Ionicons name="open-outline" size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.dealFooter}>
          <Text style={[styles.postedBy, { color: COLORS.textMuted }]}>
            by {deal.postedBy}
          </Text>
          <Text style={[styles.timeRemaining, { color: COLORS.textMuted }]}>
            {Math.max(1, Math.ceil((new Date(deal.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} days left
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!canLoadMore) return null;
    
    return (
      <View style={styles.loadMoreContainer}>
        <TouchableOpacity
          style={[styles.loadMoreButton, { backgroundColor: COLORS.primary }]}
          onPress={loadMore}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.loadMoreText}>Load More Deals</Text>
              <Ionicons name="chevron-down" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: COLORS.surface }]}>
        <Ionicons name="pricetag-outline" size={64} color={COLORS.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>
        {error ? 'Connection Error' : 'No deals found'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: COLORS.textSecondary }]}>
        {error 
          ? 'Unable to load deals. Check your internet connection.' 
          : searchQuery 
            ? 'Try adjusting your search or category filter'
            : 'We\'re fetching the latest deals for you'
        }
      </Text>
      {error && (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: COLORS.primary }]}
          onPress={handleManualRefresh}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Compact Header */}
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Deals Hub</Text>
              <Text style={styles.headerSubtitle}>
                {pagination ? `${pagination.totalDeals} live deals` : 'Loading deals...'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleManualRefresh}
                disabled={isManualRefresh}
              >
                {isManualRefresh ? (
                  <ActivityIndicator size={16} color={COLORS.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.postButton}
                onPress={() => setShowPostModal(true)}
              >
                <Ionicons name="add" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: COLORS.surface }]}>
              <Ionicons name="search" size={20} color={COLORS.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: COLORS.textPrimary }]}
                placeholder="Search deals..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Last Updated Indicator */}
          {lastUpdated && (
            <View style={styles.lastUpdatedContainer}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.lastUpdatedText}>
                Updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {DEAL_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              { 
                backgroundColor: selectedCategory === category ? COLORS.primary : COLORS.surface,
                borderColor: selectedCategory === category ? COLORS.primary : COLORS.surface,
              }
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryButtonText,
                { 
                  color: selectedCategory === category ? 'white' : COLORS.textSecondary 
                }
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Deals List */}
      {loading && filteredDeals.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
            Loading fresh deals...
          </Text>
        </View>
      ) : filteredDeals.length === 0 ? (
        <ScrollView
          refreshControl={
            <RefreshControl 
              refreshing={false} 
              onRefresh={handleManualRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          {renderEmptyState()}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredDeals}
          renderItem={renderDealCard}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={false} 
              onRefresh={handleManualRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.dealsContainer}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
        />
      )}

      {/* Post Deal Modal */}
      <Modal
        visible={showPostModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: COLORS.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: COLORS.primary }]}>
              <TouchableOpacity
                onPress={() => setShowPostModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Post New Deal</Text>
              <TouchableOpacity
                onPress={handlePostDeal}
                style={styles.modalSaveButton}
                disabled={loading}
              >
                <Text style={styles.modalSaveText}>Post</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.comingSoonContainer}>
                <Ionicons name="construct-outline" size={64} color={COLORS.textMuted} />
                <Text style={[styles.comingSoonTitle, { color: COLORS.textPrimary }]}>
                  Coming Soon!
                </Text>
                <Text style={[styles.comingSoonText, { color: COLORS.textSecondary }]}>
                  User-generated deals will be available in the next update. 
                  For now, enjoy thousands of curated deals from top Australian retailers!
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: COLORS.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: COLORS.primary }]}>
            <TouchableOpacity
              onPress={() => setShowChatModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Deal Discussion</Text>
            <View style={styles.modalSaveButton} />
          </View>

          <View style={styles.chatContainer}>
            <FlatList
              data={chatMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[styles.chatMessage, { backgroundColor: COLORS.surface }]}>
                  <Text style={[styles.chatUserName, { color: COLORS.primary }]}>
                    {item.userName}
                  </Text>
                  <Text style={[styles.chatMessageText, { color: COLORS.textPrimary }]}>
                    {item.message}
                  </Text>
                  <Text style={[styles.chatTimestamp, { color: COLORS.textMuted }]}>
                    {item.timestamp.toLocaleTimeString()}
                  </Text>
                </View>
              )}
              style={styles.chatMessages}
            />
            
            <View style={[styles.chatInputContainer, { 
              backgroundColor: COLORS.background,
              borderTopColor: COLORS.surface,
            }]}>
              <TextInput
                style={[styles.chatInput, { 
                  backgroundColor: COLORS.surface,
                  borderColor: COLORS.surface,
                  color: COLORS.textPrimary,
                }]}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type your message..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.chatSendButton, { backgroundColor: COLORS.primary }]}
                onPress={sendMessage}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 8,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  refreshButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    marginTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  categoriesContainer: {
    backgroundColor: COLORS.background,
    paddingTop: 16,
  },
  categoriesContent: {
    paddingHorizontal: 20,
  },
  categoryButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  retryButton: {
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dealsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  dealCard: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dealBadges: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  categoryText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  sourceBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '600',
  },
  discountBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 50,
  },
  discountText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  offText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 24,
  },
  dealDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  businessName: {
    fontSize: 14,
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 13,
  },
  pricingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originalPrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  savedAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  groupSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  participantCount: {
    fontSize: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  claimText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postedBy: {
    fontSize: 12,
  },
  timeRemaining: {
    fontSize: 12,
  },
  loadMoreContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  loadMoreText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  modalSaveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
  },
  comingSoonText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  chatContainer: {
    flex: 1,
  },
  chatMessages: {
    flex: 1,
    padding: 20,
  },
  chatMessage: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chatUserName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  chatMessageText: {
    fontSize: 16,
    marginBottom: 6,
    lineHeight: 22,
  },
  chatTimestamp: {
    fontSize: 12,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DealsHubScreen;