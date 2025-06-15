import React, { useState, useEffect } from 'react';
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
  ImageBackground,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Deal {
  id: string;
  title: string;
  description: string;
  category: 'OTT' | 'Freebies' | 'Group Buying' | 'Local Deals' | 'Partners';
  originalPrice: number;
  discountedPrice: number;
  discount: number;
  expiresAt: Date;
  postedBy: string;
  likes: number;
  dislikes: number;
  userLiked?: boolean;
  userDisliked?: boolean;
  isGroupDeal: boolean;
  groupProgress?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  chatEnabled: boolean;
  isPartnership: boolean;
  businessName?: string;
  location?: string;
}

interface ChatMessage {
  id: string;
  dealId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}

const DEAL_CATEGORIES = ['All', 'OTT', 'Freebies', 'Group Buying', 'Local Deals', 'Partners'];

const DealsHubScreen: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showPostModal, setShowPostModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

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

  useEffect(() => {
    loadDeals();
  }, []);

  useEffect(() => {
    filterDeals();
  }, [deals, selectedCategory, searchQuery]);

  const loadDeals = async () => {
    setLoading(true);
    try {
      // Sample deals to demonstrate functionality
      const sampleDeals: Deal[] = [
        {
          id: '1',
          title: 'Netflix Premium 3 Months',
          description: 'Get Netflix Premium for 3 months at 50% off. Perfect for binge-watching with family!',
          category: 'OTT',
          originalPrice: 45.99,
          discountedPrice: 22.99,
          discount: 50,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          postedBy: 'StreamDeals',
          likes: 124,
          dislikes: 5,
          isGroupDeal: false,
          chatEnabled: true,
          isPartnership: true,
          businessName: 'Netflix',
        },
        {
          id: '2',
          title: 'Free Coffee at Starbucks',
          description: 'Download the app and get a free tall coffee. Limited time offer for new users only.',
          category: 'Freebies',
          originalPrice: 4.50,
          discountedPrice: 0,
          discount: 100,
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          postedBy: 'FreebieHunter',
          likes: 89,
          dislikes: 2,
          isGroupDeal: false,
          chatEnabled: true,
          isPartnership: false,
          location: 'Nationwide',
        },
        {
          id: '3',
          title: 'Group Buy: AirPods Pro',
          description: 'Looking for 8 more people to buy AirPods Pro in bulk. Get them for $180 instead of $249!',
          category: 'Group Buying',
          originalPrice: 249,
          discountedPrice: 180,
          discount: 28,
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          postedBy: 'TechSaver',
          likes: 67,
          dislikes: 1,
          isGroupDeal: true,
          maxParticipants: 10,
          currentParticipants: 2,
          groupProgress: 20,
          chatEnabled: true,
          isPartnership: false,
        },
        {
          id: '4',
          title: '50% Off Local Gym Membership',
          description: 'FitZone Gym offering 50% off annual membership. Includes pool, sauna, and group classes.',
          category: 'Local Deals',
          originalPrice: 600,
          discountedPrice: 300,
          discount: 50,
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          postedBy: 'FitZone',
          likes: 43,
          dislikes: 0,
          isGroupDeal: false,
          chatEnabled: true,
          isPartnership: true,
          businessName: 'FitZone Gym',
          location: 'Downtown Melbourne',
        },
      ];
      
      setDeals(sampleDeals);
      setLoading(false);
    } catch (error) {
      console.error('Error loading deals:', error);
      setLoading(false);
    }
  };

  const filterDeals = () => {
    let filtered = deals;
    
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(deal => deal.category === selectedCategory);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(deal => 
        deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.businessName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredDeals(filtered);
  };

  const handlePostDeal = async () => {
    if (!postForm.title || !postForm.description || !postForm.originalPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const originalPrice = parseFloat(postForm.originalPrice);
      const discountedPrice = parseFloat(postForm.discountedPrice);
      const discount = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);

      const newDeal: Deal = {
        id: Date.now().toString(),
        title: postForm.title,
        description: postForm.description,
        category: postForm.category,
        originalPrice,
        discountedPrice,
        discount,
        expiresAt: postForm.expiresAt,
        postedBy: 'You',
        likes: 0,
        dislikes: 0,
        isGroupDeal: postForm.isGroupDeal,
        maxParticipants: postForm.isGroupDeal ? parseInt(postForm.maxParticipants) : undefined,
        currentParticipants: postForm.isGroupDeal ? 1 : undefined,
        groupProgress: postForm.isGroupDeal ? 10 : undefined,
        chatEnabled: true,
        isPartnership: postForm.category === 'Partners',
        businessName: postForm.businessName || undefined,
        location: postForm.location || undefined,
      };

      setDeals(prev => [newDeal, ...prev]);
      setShowPostModal(false);
      resetPostForm();
      Alert.alert('Success', 'Your deal has been posted successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to post deal. Please try again.');
    } finally {
      setLoading(false);
    }
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

  const handleLike = (dealId: string) => {
    setDeals(prev => prev.map(deal => {
      if (deal.id === dealId) {
        const wasLiked = deal.userLiked;
        const wasDisliked = deal.userDisliked;
        
        return {
          ...deal,
          likes: wasLiked ? deal.likes - 1 : deal.likes + 1,
          dislikes: wasDisliked ? deal.dislikes - 1 : deal.dislikes,
          userLiked: !wasLiked,
          userDisliked: false,
        };
      }
      return deal;
    }));
  };

  const handleDislike = (dealId: string) => {
    setDeals(prev => prev.map(deal => {
      if (deal.id === dealId) {
        const wasLiked = deal.userLiked;
        const wasDisliked = deal.userDisliked;
        
        return {
          ...deal,
          likes: wasLiked ? deal.likes - 1 : deal.likes,
          dislikes: wasDisliked ? deal.dislikes - 1 : deal.dislikes + 1,
          userLiked: false,
          userDisliked: !wasDisliked,
        };
      }
      return deal;
    }));
  };

  const openChat = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowChatModal(true);
    setChatMessages([]);
  };

  const handleShareDeal = async (deal: Deal) => {
    try {
      const shareMessage = `🔥 Amazing Deal Alert! 🔥

${deal.title}

💰 Was: $${deal.originalPrice}
✨ Now: $${deal.discountedPrice}
🎯 Save ${deal.discount}% OFF!

${deal.description}

Found this deal on Spendy Deals Hub!`;

      await Share.share({
        message: shareMessage,
        title: `${deal.title} - ${deal.discount}% OFF`,
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeals();
    setRefreshing(false);
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

  const getCategoryColor = (category: string) => {
    const colors = {
      'OTT': ['#667eea', '#764ba2'],
      'Freebies': ['#f093fb', '#f5576c'],
      'Group Buying': ['#4facfe', '#00f2fe'],
      'Local Deals': ['#43e97b', '#38f9d7'],
      'Partners': ['#fa709a', '#fee140'],
    };
    return colors[category as keyof typeof colors] || ['#667eea', '#764ba2'];
  };

  const renderDealCard = ({ item: deal }: { item: Deal }) => {
    const categoryColors = getCategoryColor(deal.category);
    const isExpiringSoon = new Date(deal.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

    return (
      <View style={styles.dealCard}>
        <LinearGradient
          colors={categoryColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dealGradient}
        >
          <BlurView intensity={20} style={styles.dealContent}>
            {/* Header */}
            <View style={styles.dealHeader}>
              <View style={styles.dealBadges}>
                <View style={styles.categoryBadge}>
                  <Ionicons 
                    name={getCategoryIcon(deal.category) as any} 
                    size={12} 
                    color="white" 
                  />
                  <Text style={styles.categoryText}>{deal.category}</Text>
                </View>
                {isExpiringSoon && (
                  <View style={styles.urgentBadge}>
                    <Ionicons name="time" size={10} color="#FF6B6B" />
                    <Text style={styles.urgentText}>Expiring Soon</Text>
                  </View>
                )}
              </View>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{deal.discount}%</Text>
                <Text style={styles.offText}>OFF</Text>
              </View>
            </View>

            {/* Title & Description */}
            <Text style={styles.dealTitle} numberOfLines={2}>{deal.title}</Text>
            <Text style={styles.dealDescription} numberOfLines={2}>{deal.description}</Text>

            {/* Business Info */}
            {deal.businessName && (
              <View style={styles.businessInfo}>
                <Ionicons name="business" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.businessName}>{deal.businessName}</Text>
              </View>
            )}

            {/* Location */}
            {deal.location && (
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.locationText}>{deal.location}</Text>
              </View>
            )}

            {/* Pricing */}
            <View style={styles.pricingSection}>
              <View style={styles.priceContainer}>
                <Text style={styles.originalPrice}>${deal.originalPrice}</Text>
                <Text style={styles.discountedPrice}>${deal.discountedPrice}</Text>
              </View>
              <Text style={styles.savedAmount}>Save ${(deal.originalPrice - deal.discountedPrice).toFixed(2)}</Text>
            </View>

            {/* Group Deal Progress */}
            {deal.isGroupDeal && (
              <View style={styles.groupSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.groupTitle}>Group Progress</Text>
                  <Text style={styles.participantCount}>
                    {deal.currentParticipants}/{deal.maxParticipants} joined
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[styles.progressFill, { width: `${deal.groupProgress || 0}%` }]} 
                  />
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <View style={styles.leftActions}>
                <TouchableOpacity
                  style={[styles.actionButton, deal.userLiked && styles.activeAction]}
                  onPress={() => handleLike(deal.id)}
                >
                  <Ionicons 
                    name={deal.userLiked ? "heart" : "heart-outline"} 
                    size={18} 
                    color={deal.userLiked ? "#FF6B6B" : "rgba(255,255,255,0.8)"} 
                  />
                  <Text style={styles.actionText}>{deal.likes}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openChat(deal)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.actionText}>Chat</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleShareDeal(deal)}
                >
                  <Ionicons name="share-outline" size={18} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.claimButton}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.claimGradient}
                >
                  <Text style={styles.claimText}>Claim Deal</Text>
                  <Ionicons name="arrow-forward" size={16} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.dealFooter}>
              <Text style={styles.postedBy}>by {deal.postedBy}</Text>
              <Text style={styles.timeRemaining}>
                {Math.ceil((new Date(deal.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days left
              </Text>
            </View>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="pricetag-outline" size={64} color="#CBD5E1" />
      </View>
      <Text style={styles.emptyTitle}>No deals found</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to share an amazing deal with the community
      </Text>
      <TouchableOpacity
        style={styles.postFirstDealButton}
        onPress={() => setShowPostModal(true)}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.postFirstDealGradient}
        >
          <Text style={styles.postFirstDealText}>Post Your First Deal</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <BlurView intensity={20} style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Deals Hub</Text>
              <Text style={styles.headerSubtitle}>Discover amazing savings</Text>
            </View>
            <TouchableOpacity
              style={styles.postButton}
              onPress={() => setShowPostModal(true)}
            >
              <Ionicons name="add" size={24} color="#667eea" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search deals..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
          >
            {DEAL_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category && styles.categoryButtonTextActive
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BlurView>
      </LinearGradient>

      {/* Deals List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading deals...</Text>
        </View>
      ) : filteredDeals.length === 0 ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.dealsContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowPostModal(true)}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>

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
          <SafeAreaView style={styles.modalContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.modalHeader}
            >
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
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalSaveText}>Post</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Deal Title *</Text>
                <TextInput
                  style={styles.formInput}
                  value={postForm.title}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, title: text }))}
                  placeholder="Enter deal title"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description *</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={postForm.description}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, description: text }))}
                  placeholder="Describe the deal"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['OTT', 'Freebies', 'Group Buying', 'Local Deals', 'Partners'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categorySelectButton,
                        postForm.category === cat && styles.categorySelectButtonActive
                      ]}
                      onPress={() => setPostForm(prev => ({ ...prev, category: cat as Deal['category'] }))}
                    >
                      <Text
                        style={[
                          styles.categorySelectText,
                          postForm.category === cat && styles.categorySelectTextActive
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Original Price *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={postForm.originalPrice}
                    onChangeText={(text) => setPostForm(prev => ({ ...prev, originalPrice: text }))}
                    placeholder="$0.00"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.formLabel}>Discounted Price *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={postForm.discountedPrice}
                    onChangeText={(text) => setPostForm(prev => ({ ...prev, discountedPrice: text }))}
                    placeholder="$0.00"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Business Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={postForm.businessName}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, businessName: text }))}
                  placeholder="Enter business name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location</Text>
                <TextInput
                  style={styles.formInput}
                  value={postForm.location}
                  onChangeText={(text) => setPostForm(prev => ({ ...prev, location: text }))}
                  placeholder="Enter location"
                />
              </View>

              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setPostForm(prev => ({ ...prev, isGroupDeal: !prev.isGroupDeal }))}
                >
                  <Ionicons
                    name={postForm.isGroupDeal ? "checkbox" : "checkbox-outline"}
                    size={24}
                    color="#667eea"
                  />
                  <Text style={styles.checkboxLabel}>This is a group deal</Text>
                </TouchableOpacity>
              </View>

              {postForm.isGroupDeal && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Max Participants</Text>
                  <TextInput
                    style={styles.formInput}
                    value={postForm.maxParticipants}
                    onChangeText={(text) => setPostForm(prev => ({ ...prev, maxParticipants: text }))}
                    placeholder="Enter max participants"
                    keyboardType="numeric"
                  />
                </View>
              )}
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
        <SafeAreaView style={styles.modalContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalHeader}
          >
            <TouchableOpacity
              onPress={() => setShowChatModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Deal Chat</Text>
            <View style={styles.modalSaveButton} />
          </LinearGradient>

          <View style={styles.chatContainer}>
            <FlatList
              data={chatMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.chatMessage}>
                  <Text style={styles.chatUserName}>{item.userName}</Text>
                  <Text style={styles.chatMessageText}>{item.message}</Text>
                  <Text style={styles.chatTimestamp}>
                    {item.timestamp.toLocaleTimeString()}
                  </Text>
                </View>
              )}
              style={styles.chatMessages}
            />
            
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type your message..."
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={styles.chatSendButton}
                onPress={sendMessage}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.chatSendGradient}
                >
                  <Ionicons name="send" size={20} color="white" />
                </LinearGradient>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 8,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  postButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  categoriesContainer: {
    marginTop: 8,
  },
  categoryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryButtonActive: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  categoryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: '#667eea',
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
    color: '#64748B',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  postFirstDealButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  postFirstDealGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  postFirstDealText: {
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
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dealGradient: {
    borderRadius: 20,
  },
  dealContent: {
    padding: 20,
    borderRadius: 20,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dealBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  urgentText: {
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: '600',
  },
  discountBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  discountText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  offText: {
    color: '#667eea',
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
  dealTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 26,
  },
  dealDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  businessName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  locationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  pricingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originalPrice: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
  },
  savedAmount: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  groupSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  participantCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeAction: {
    // Add styles for active state if needed
  },
  actionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  claimButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
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
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  timeRemaining: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
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
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    color: '#1E293B',
  },
  formTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  formHalf: {
    flex: 1,
  },
  categorySelectButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categorySelectButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  categorySelectText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  categorySelectTextActive: {
    color: 'white',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  chatContainer: {
    flex: 1,
  },
  chatMessages: {
    flex: 1,
    padding: 20,
  },
  chatMessage: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chatUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 6,
  },
  chatMessageText: {
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 6,
    lineHeight: 22,
  },
  chatTimestamp: {
    fontSize: 12,
    color: '#64748B',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
  },
  chatSendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  chatSendGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DealsHubScreen;