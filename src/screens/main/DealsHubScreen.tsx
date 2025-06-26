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
  Image,
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

// Deal Sources Configuration
const DEAL_SOURCES = [
  {
    id: 'all',
    name: 'All',
    logo: null,
    color: '#6C7B7F',
    apiEndpoint: null,
  },
  {
    id: 'ozbargain',
    name: 'OzBargain',
    logo: 'https://files.ozbargain.com.au/n/71/538271.png',
    color: '#FF6B35',
    apiEndpoint: '/api/ozbargain',
  },
  {
    id: 'coles',
    name: 'Coles',
    logo: 'https://logoeps.com/wp-content/uploads/2014/05/coles-vector-logo.png',
    color: '#E31E24',
    apiEndpoint: '/api/coles',
  },
  {
    id: 'woolworths',
    name: 'Woolworths',
    logo: 'https://logos-world.net/wp-content/uploads/2021/02/Woolworths-Logo.png',
    color: '#1BAA2F',
    apiEndpoint: '/api/woolworths',
  },
  {
    id: 'costco',
    name: 'Costco',
    logo: 'https://logos-world.net/wp-content/uploads/2020/09/Costco-Logo.png',
    color: '#E31837',
    apiEndpoint: '/api/costco',
  },
  {
    id: 'bunnings',
    name: 'Bunnings',
    logo: 'https://logos-world.net/wp-content/uploads/2021/02/Bunnings-Logo.png',
    color: '#007A33',
    apiEndpoint: '/api/bunnings',
  },
  {
    id: 'jbhifi',
    name: 'JB Hi-Fi',
    logo: 'https://logos-world.net/wp-content/uploads/2021/02/JB-Hi-Fi-Logo.png',
    color: '#000000',
    apiEndpoint: '/api/jbhifi',
  },
  {
    id: 'goodguys',
    name: 'Good Guys',
    logo: 'https://logos-world.net/wp-content/uploads/2021/02/Good-Guys-Logo.png',
    color: '#D4282D',
    apiEndpoint: '/api/goodguys',
  },
  {
    id: 'harveynorman',
    name: 'Harvey Norman',
    logo: 'https://logos-world.net/wp-content/uploads/2021/02/Harvey-Norman-Logo.png',
    color: '#E4002B',
    apiEndpoint: '/api/harveynorman',
  },
];

const DEAL_CATEGORIES = ['All', 'Electronics', 'Groceries', 'Home & Garden', 'Fashion', 'Entertainment', 'Sports'];

const DealsHubScreen: React.FC = () => {
  const { theme, colors } = useTheme();
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showPostModal, setShowPostModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);

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
  } = useDeals(selectedCategory, selectedSource);

  // Post Deal Form State
  const [postForm, setPostForm] = useState({
    title: '',
    description: '',
    category: 'Electronics' as Deal['category'],
    originalPrice: '',
    discountedPrice: '',
    businessName: '',
    location: '',
    isGroupDeal: false,
    maxParticipants: '',
    expiresAt: new Date(),
    dealUrl: '',
    source: selectedSource,
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

  // Auto-hide filters during loading to save space
  useEffect(() => {
    if (loading && deals.length === 0) {
      setFiltersVisible(false);
    } else {
      setFiltersVisible(true);
    }
  }, [loading, deals.length]);

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    try {
      await refreshDeals();
      Alert.alert(
        'Deals Updated! 🎉',
        `Found ${pagination?.totalDeals || 0} deals from ${DEAL_SOURCES.find(s => s.id === selectedSource)?.name || 'All Sources'}`,
        [{ text: 'Great!', style: 'default' }]
      );
    } catch (error) {
      Alert.alert('Refresh Failed', 'Unable to fetch latest deals. Please try again.');
    } finally {
      setIsManualRefresh(false);
    }
  }, [refreshDeals, pagination?.totalDeals, selectedSource]);

  const handlePostDeal = async () => {
    if (!postForm.title || !postForm.description || !postForm.originalPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      // Here you would integrate with your backend to post user-generated deals
      const newDeal = {
        ...postForm,
        id: Date.now().toString(),
        originalPrice: parseFloat(postForm.originalPrice),
        discountedPrice: parseFloat(postForm.discountedPrice),
        discount: Math.round(((parseFloat(postForm.originalPrice) - parseFloat(postForm.discountedPrice)) / parseFloat(postForm.originalPrice)) * 100),
        postedBy: 'You',
        likes: 0,
        dislikes: 0,
        isGroupDeal: postForm.isGroupDeal,
        chatEnabled: true,
        isPartnership: false,
        source: 'user',
      };

      Alert.alert('Deal Posted!', 'Your deal has been submitted and will be reviewed shortly.');
      setShowPostModal(false);
      resetPostForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to post deal. Please try again.');
    }
  };

  const resetPostForm = () => {
    setPostForm({
      title: '',
      description: '',
      category: 'Electronics',
      originalPrice: '',
      discountedPrice: '',
      businessName: '',
      location: '',
      isGroupDeal: false,
      maxParticipants: '',
      expiresAt: new Date(),
      dealUrl: '',
      source: selectedSource,
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

  const generateDeepLink = (deal: Deal) => {
    // Generate deep link for the app
    return `spendy://deal/${deal.id}`;
  };

  const generateAppStoreLink = () => {
    if (Platform.OS === 'ios') {
      return 'https://apps.apple.com/au/app/spendy/id123456789'; // Replace with actual App Store ID
    } else {
      return 'https://play.google.com/store/apps/details?id=com.spendy.app'; // Replace with actual package name
    }
  };

  const handleShareDeal = async (deal: Deal) => {
    try {
      const deepLink = generateDeepLink(deal);
      const appStoreLink = generateAppStoreLink();
      
      const shareMessage = `💚 DEAL ALERT from Spendy! 💚

${deal.title}

💰 Was: $${deal.originalPrice.toFixed(2)}
✨ Now: $${deal.discountedPrice.toFixed(2)}
🎯 Save ${deal.discount}% OFF!

${deal.description}

📱 Open in Spendy: ${deepLink}
📲 Get Spendy: ${appStoreLink}

Found this amazing deal on Spendy app!`;

      await Share.share({
        message: shareMessage,
        title: `${deal.title} - ${deal.discount}% OFF`,
        url: deepLink,
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
      'Electronics': 'phone-portrait',
      'Groceries': 'basket',
      'Home & Garden': 'home',
      'Fashion': 'shirt',
      'Entertainment': 'game-controller',
      'Sports': 'fitness',
    };
    return icons[category as keyof typeof icons] || 'pricetag';
  };

  const getSourceBadge = (source?: string) => {
    const sourceData = DEAL_SOURCES.find(s => s.id === source);
    return sourceData ? { text: sourceData.name, color: sourceData.color } : { text: 'Community', color: colors.primary };
  };

  const renderSourceFilter = ({ item: source }: { item: typeof DEAL_SOURCES[0] }) => {
    const isSelected = selectedSource === source.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.sourceFilter,
          { 
            backgroundColor: isSelected ? source.color : colors.surface,
            borderColor: isSelected ? source.color : colors.border,
          }
        ]}
        onPress={() => setSelectedSource(source.id)}
      >
        {source.logo && (
          <Image 
            source={{ uri: source.logo }} 
            style={styles.sourceLogo}
            resizeMode="contain"
          />
        )}
        {!source.logo && (
          <Ionicons 
            name="apps" 
            size={16} 
            color={isSelected ? 'white' : colors.textSecondary} 
          />
        )}
        <Text
          style={[
            styles.sourceFilterText,
            { 
              color: isSelected ? 'white' : colors.textSecondary 
            }
          ]}
        >
          {source.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDealCard = ({ item: deal }: { item: Deal }) => {
    const isExpiringSoon = new Date(deal.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;
    const sourceBadge = getSourceBadge(deal.source);

    return (
      <TouchableOpacity 
        style={[styles.dealCard, { backgroundColor: colors.surface }]}
        onPress={() => openDealUrl(deal)}
        activeOpacity={0.9}
      >
        {/* Header */}
        <View style={styles.dealHeader}>
          <View style={styles.dealBadges}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
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
              <View style={[styles.urgentBadge, { backgroundColor: `${colors.warning}20` }]}>
                <Ionicons name="time" size={10} color={colors.warning} />
                <Text style={[styles.urgentText, { color: colors.warning }]}>Expiring Soon</Text>
              </View>
            )}
          </View>
          <View style={[styles.discountBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.discountText}>{deal.discount}%</Text>
            <Text style={styles.offText}>OFF</Text>
          </View>
        </View>

        {/* Title & Description */}
        <Text style={[styles.dealTitle, { color: colors.text }]} numberOfLines={2}>
          {deal.title}
        </Text>
        <Text style={[styles.dealDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {deal.description}
        </Text>

        {/* Business Info */}
        {deal.businessName && (
          <View style={styles.businessInfo}>
            <Ionicons name="business" size={14} color={colors.textMuted} />
            <Text style={[styles.businessName, { color: colors.textSecondary }]}>
              {deal.businessName}
            </Text>
          </View>
        )}

        {/* Location */}
        {deal.location && (
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={14} color={colors.textMuted} />
            <Text style={[styles.locationText, { color: colors.textMuted }]}>
              {deal.location}
            </Text>
          </View>
        )}

        {/* Pricing */}
        <View style={styles.pricingSection}>
          <View style={styles.priceContainer}>
            <Text style={[styles.originalPrice, { color: colors.textMuted }]}>
              ${deal.originalPrice.toFixed(2)}
            </Text>
            <Text style={[styles.discountedPrice, { color: colors.primary }]}>
              ${deal.discountedPrice.toFixed(2)}
            </Text>
          </View>
          <Text style={[styles.savedAmount, { color: colors.success }]}>
            Save ${(deal.originalPrice - deal.discountedPrice).toFixed(2)}
          </Text>
        </View>

        {/* Group Deal Progress */}
        {deal.isGroupDeal && (
          <View style={styles.groupSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.groupTitle, { color: colors.text }]}>
                Group Progress
              </Text>
              <Text style={[styles.participantCount, { color: colors.textSecondary }]}>
                {deal.currentParticipants}/{deal.maxParticipants} joined
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${deal.groupProgress || 0}%`, backgroundColor: colors.primary }
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
                color={deal.userLiked ? colors.error : colors.textMuted} 
              />
              <Text style={[styles.actionText, { color: colors.textMuted }]}>
                {deal.likes}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openChat(deal)}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.actionText, { color: colors.textMuted }]}>Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShareDeal(deal)}
            >
              <Ionicons name="share-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.actionText, { color: colors.textMuted }]}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.claimButton, { backgroundColor: colors.primary }]}
            onPress={() => openDealUrl(deal)}
          >
            <Text style={styles.claimText}>Get Deal</Text>
            <Ionicons name="open-outline" size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.dealFooter}>
          <Text style={[styles.postedBy, { color: colors.textMuted }]}>
            by {deal.postedBy}
          </Text>
          <Text style={[styles.timeRemaining, { color: colors.textMuted }]}>
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
          style={[styles.loadMoreButton, { backgroundColor: colors.primary }]}
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
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="pricetag-outline" size={64} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {error ? 'Connection Error' : 'No deals found'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {error 
          ? 'Unable to load deals. Check your internet connection.' 
          : searchQuery 
            ? 'Try adjusting your search or filters'
            : `We're fetching the latest deals from ${DEAL_SOURCES.find(s => s.id === selectedSource)?.name || 'all sources'}`
        }
      </Text>
      {error && (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={handleManualRefresh}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Compact Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
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
                  <ActivityIndicator size={16} color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.postButton}
                onPress={() => setShowPostModal(true)}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search deals..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
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

      {/* Filters Section - Hidden during initial loading */}
      {filtersVisible && (
        <View style={[styles.filtersSection, { backgroundColor: colors.background }]}>
          {/* Source Filters */}
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Sources</Text>
            <FlatList
              horizontal
              data={DEAL_SOURCES}
              renderItem={renderSourceFilter}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sourceFiltersContainer}
            />
          </View>

          {/* Category Filters */}
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContent}
            >
              {DEAL_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    { 
                      backgroundColor: selectedCategory === category ? colors.primary : colors.surface,
                      borderColor: selectedCategory === category ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      { 
                        color: selectedCategory === category ? 'white' : colors.textSecondary 
                      }
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Deals List */}
      {loading && filteredDeals.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading deals from {DEAL_SOURCES.find(s => s.id === selectedSource)?.name || 'all sources'}...
          </Text>
        </View>
      ) : filteredDeals.length === 0 ? (
        <ScrollView
          refreshControl={
            <RefreshControl 
              refreshing={false} 
              onRefresh={handleManualRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
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
              tintColor={colors.primary}
              colors={[colors.primary]}
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
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.primary }]}>
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
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Deal Title *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={postForm.title}
                  onChangeText={(text) => setPostForm({...postForm, title: text})}
                  placeholder="Enter deal title"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Description *</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={postForm.description}
                  onChangeText={(text) => setPostForm({...postForm, description: text})}
                  placeholder="Describe the deal"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                  {DEAL_CATEGORIES.filter(cat => cat !== 'All').map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryOption,
                        { 
                          backgroundColor: postForm.category === category ? colors.primary : colors.surface,
                          borderColor: postForm.category === category ? colors.primary : colors.border,
                        }
                      ]}
                      onPress={() => setPostForm({...postForm, category: category as Deal['category']})}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        { color: postForm.category === category ? 'white' : colors.text }
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.priceRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.label, { color: colors.text }]}>Original Price *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={postForm.originalPrice}
                    onChangeText={(text) => setPostForm({...postForm, originalPrice: text})}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: colors.text }]}>Sale Price *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={postForm.discountedPrice}
                    onChangeText={(text) => setPostForm({...postForm, discountedPrice: text})}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Business Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={postForm.businessName}
                  onChangeText={(text) => setPostForm({...postForm, businessName: text})}
                  placeholder="Store or business name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Deal URL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={postForm.dealUrl}
                  onChangeText={(text) => setPostForm({...postForm, dealUrl: text})}
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
                  keyboardType="url"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Location</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={postForm.location}
                  onChangeText={(text) => setPostForm({...postForm, location: text})}
                  placeholder="City, State or 'Online'"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <TouchableOpacity
                style={styles.groupDealToggle}
                onPress={() => setPostForm({...postForm, isGroupDeal: !postForm.isGroupDeal})}
              >
                <View style={styles.toggleRow}>
                  <Text style={[styles.label, { color: colors.text }]}>Group Deal</Text>
                  <View style={[
                    styles.toggle,
                    { backgroundColor: postForm.isGroupDeal ? colors.primary : colors.surface }
                  ]}>
                    <View style={[
                      styles.toggleIndicator,
                      { 
                        backgroundColor: 'white',
                        transform: [{ translateX: postForm.isGroupDeal ? 20 : 2 }]
                      }
                    ]} />
                  </View>
                </View>
                <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                  Enable if this deal requires multiple people to activate
                </Text>
              </TouchableOpacity>

              {postForm.isGroupDeal && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Max Participants</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={postForm.maxParticipants}
                    onChangeText={(text) => setPostForm({...postForm, maxParticipants: text})}
                    placeholder="10"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              )}

              <View style={styles.formFooter}>
                <Text style={[styles.formNote, { color: colors.textMuted }]}>
                  Your deal will be reviewed before being published to ensure quality and accuracy.
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.primary }]}>
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
                <View style={[styles.chatMessage, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.chatUserName, { color: colors.primary }]}>
                    {item.userName}
                  </Text>
                  <Text style={[styles.chatMessageText, { color: colors.text }]}>
                    {item.message}
                  </Text>
                  <Text style={[styles.chatTimestamp, { color: colors.textMuted }]}>
                    {item.timestamp.toLocaleTimeString()}
                  </Text>
                </View>
              )}
              style={styles.chatMessages}
            />
            
            <View style={[styles.chatInputContainer, { 
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            }]}>
              <TextInput
                style={[styles.chatInput, { 
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                }]}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type your message..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.chatSendButton, { backgroundColor: colors.primary }]}
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
  filtersSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  sourceFiltersContainer: {
    paddingHorizontal: 20,
  },
  sourceFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
    gap: 8,
  },
  sourceLogo: {
    width: 16,
    height: 16,
  },
  sourceFilterText: {
    fontSize: 14,
    fontWeight: '600',
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
    textAlign: 'center',
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
  },
  categoryOption: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  groupDealToggle: {
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  toggleDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  formFooter: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  formNote: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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