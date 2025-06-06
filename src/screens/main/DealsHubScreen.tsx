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
} from 'react-native';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
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
    checkFirstTime();
    loadDeals();
  }, []);

  useEffect(() => {
    filterDeals();
  }, [deals, selectedCategory, searchQuery]);

  const checkFirstTime = async () => {
    // Check if user is first time visitor
    const isFirstTime = true; // This would be from AsyncStorage in real app
    if (isFirstTime) {
      setTimeout(() => setShowOnboarding(true), 1000);
    }
  };

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
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
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
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
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
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
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
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
          postedBy: 'FitZone',
          likes: 43,
          dislikes: 0,
          isGroupDeal: false,
          chatEnabled: true,
          isPartnership: true,
          businessName: 'FitZone Gym',
          location: 'Downtown Melbourne',
        },
        {
          id: '5',
          title: 'Uber Eats: 40% Off First Order',
          description: 'Partner deal: Get 40% off your first order with code FRESH40. Max discount $15.',
          category: 'Partners',
          originalPrice: 35,
          discountedPrice: 21,
          discount: 40,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
          postedBy: 'SpendyPartner',
          likes: 156,
          dislikes: 3,
          isGroupDeal: false,
          chatEnabled: true,
          isPartnership: true,
          businessName: 'Uber Eats',
        }
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

  const performAIModerationCheck = async (content: string): Promise<boolean> => {
    // AI moderation simulation
    const bannedWords = ['spam', 'fake', 'scam', 'illegal'];
    const lowerContent = content.toLowerCase();
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const isClean = !bannedWords.some(word => lowerContent.includes(word));
        resolve(isClean);
      }, 1000);
    });
  };

  const handlePostDeal = async () => {
    if (!postForm.title || !postForm.description || !postForm.originalPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      // AI Moderation Check
      const contentToCheck = `${postForm.title} ${postForm.description} ${postForm.businessName}`;
      const isContentClean = await performAIModerationCheck(contentToCheck);
      
      if (!isContentClean) {
        Alert.alert('Content Flagged', 'Your post contains inappropriate content and cannot be published.');
        setLoading(false);
        return;
      }

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
    // Load chat messages for this deal
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

${deal.businessName ? `🏪 ${deal.businessName}` : ''}
${deal.location ? `📍 ${deal.location}` : ''}

Found this deal on Spendy Deals Hub! Download the app to discover more amazing deals.`;

      const result = await Share.share({
        message: shareMessage,
        title: `${deal.title} - ${deal.discount}% OFF`,
      });

      if (result.action === Share.sharedAction) {
        // Deal was shared successfully
        Alert.alert('Success', 'Deal shared successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share deal. Please try again.');
      console.error('Share error:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDeal) return;

    const isClean = await performAIModerationCheck(newMessage);
    if (!isClean) {
      Alert.alert('Message Flagged', 'Your message contains inappropriate content.');
      return;
    }

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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyIconContainer}
      >
        <Ionicons name="pricetag" size={50} color="white" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>No deals yet!</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to share an amazing deal with the community
      </Text>
      <TouchableOpacity
        style={styles.postFirstDealButton}
        onPress={() => setShowPostModal(true)}
      >
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.postFirstDealGradient}
        >
          <Text style={styles.postFirstDealText}>Post Your First Deal</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderDealCard = ({ item: deal }: { item: Deal }) => (
    <View style={styles.dealCard}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.compactDealCardGradient}
      >
        <View style={styles.compactDealHeader}>
          <View style={styles.compactDealCategory}>
            <Text style={styles.compactDealCategoryText}>{deal.category}</Text>
          </View>
          <View style={styles.compactDealDiscount}>
            <Text style={styles.compactDealDiscountText}>{deal.discount}% OFF</Text>
          </View>
        </View>
        
        <Text style={styles.compactDealTitle} numberOfLines={1}>{deal.title}</Text>
        <Text style={styles.compactDealDescription} numberOfLines={2}>{deal.description}</Text>
        
        <View style={styles.compactDealInfoRow}>
          <View style={styles.compactDealPricing}>
            <Text style={styles.compactOriginalPrice}>${deal.originalPrice}</Text>
            <Text style={styles.compactDiscountedPrice}>${deal.discountedPrice}</Text>
          </View>
          <Text style={styles.compactPostedBy} numberOfLines={1}>by {deal.postedBy}</Text>
        </View>
        
        {deal.isGroupDeal && (
          <View style={styles.compactGroupDealSection}>
            <View style={styles.compactProgressBar}>
              <View 
                style={[
                  styles.compactProgressFill, 
                  { width: `${deal.groupProgress || 0}%` }
                ]} 
              />
            </View>
            <Text style={styles.compactGroupDealText}>
              {deal.currentParticipants}/{deal.maxParticipants} joined
            </Text>
          </View>
        )}
        
        <View style={styles.compactDealActions}>
          <TouchableOpacity
            style={[styles.compactActionButton, deal.userLiked && styles.compactActionButtonActive]}
            onPress={() => handleLike(deal.id)}
          >
            <Ionicons 
              name={deal.userLiked ? "heart" : "heart-outline"} 
              size={8} 
              color={deal.userLiked ? "#EC4899" : "#fff"} 
            />
            <Text style={styles.compactActionText}>{deal.likes}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.compactActionButton, deal.userDisliked && styles.compactActionButtonActive]}
            onPress={() => handleDislike(deal.id)}
          >
            <Ionicons 
              name={deal.userDisliked ? "heart-dislike" : "heart-dislike-outline"} 
              size={8} 
              color={deal.userDisliked ? "#EC4899" : "#fff"} 
            />
            <Text style={styles.compactActionText}>{deal.dislikes}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.compactActionButton}
            onPress={() => openChat(deal)}
          >
            <Ionicons name="chatbubble-outline" size={8} color="#fff" />
            <Text style={styles.compactActionText}>Chat</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.compactActionButton}
            onPress={() => handleShareDeal(deal)}
          >
            <Ionicons name="share-outline" size={8} color="#fff" />
            <Text style={styles.compactActionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Deals Hub</Text>
        <TouchableOpacity
          style={styles.postButton}
          onPress={() => setShowPostModal(true)}
        >
          <Ionicons name="add" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search deals..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
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
          keyboardVerticalOffset={0}
        >
          <SafeAreaView style={styles.modalContainer}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
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
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 50 }}
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
                  color="#8B5CF6"
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
            )}            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <SafeAreaView style={styles.modalContainer}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
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
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              />
              
              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type your message..."
                  multiline
                  maxLength={200}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={styles.chatSendButton}
                  onPress={sendMessage}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.chatSendGradient}
                  >
                    <Ionicons name="send" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Onboarding Modal */}
      <Modal
        visible={showOnboarding}
        animationType="fade"
        transparent
      >
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingContainer}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.onboardingGradient}
            >
              <Ionicons name="rocket" size={60} color="white" />
              <Text style={styles.onboardingTitle}>Welcome to Deals Hub!</Text>
              <Text style={styles.onboardingSubtitle}>
                Discover amazing deals, share with friends, and save money together
              </Text>
              
              <View style={styles.onboardingFeatures}>
                <View style={styles.onboardingFeature}>
                  <Ionicons name="pricetag" size={24} color="white" />
                  <Text style={styles.onboardingFeatureText}>Share Real Deals</Text>
                </View>
                <View style={styles.onboardingFeature}>
                  <Ionicons name="people" size={24} color="white" />
                  <Text style={styles.onboardingFeatureText}>Group Buying</Text>
                </View>
                <View style={styles.onboardingFeature}>
                  <Ionicons name="chatbubbles" size={24} color="white" />
                  <Text style={styles.onboardingFeatureText}>Real-time Chat</Text>
                </View>
                <View style={styles.onboardingFeature}>
                  <Ionicons name="shield-checkmark" size={24} color="white" />
                  <Text style={styles.onboardingFeatureText}>AI Moderation</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.onboardingButton}
                onPress={() => setShowOnboarding(false)}
              >
                <Text style={styles.onboardingButtonText}>Get Started</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  postButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryButton: {
    backgroundColor: 'white',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 35,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  categoryButtonText: {
    color: '#666',
    fontSize: 8,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  postFirstDealButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  postFirstDealGradient: {
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  postFirstDealText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dealsContainer: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  dealCard: {
    marginBottom: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dealCardGradient: {
    padding: 20,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dealCategory: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dealCategoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  dealDiscount: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dealDiscountText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dealTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dealDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 10,
  },
  dealBusiness: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 5,
  },
  dealLocation: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 10,
  },
  dealPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  originalPrice: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textDecorationLine: 'line-through',
    marginRight: 10,
  },
  discountedPrice: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  groupDealSection: {
    marginBottom: 15,
  },
  groupDealLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  groupDealText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  dealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 5,
  },
  dealFooter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
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
    paddingVertical: 15,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  formTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  formHalf: {
    flex: 0.48,
  },
  categorySelectButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  categorySelectButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  categorySelectText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  categorySelectTextActive: {
    color: 'white',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  chatContainer: {
    flex: 1,
  },
  chatMessages: {
    flex: 1,
    padding: 20,
  },
  chatMessage: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  chatUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 5,
  },
  chatMessageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  chatTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10,
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
  onboardingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingContainer: {
    width: width * 0.9,
    borderRadius: 20,
    overflow: 'hidden',
  },
  onboardingGradient: {
    padding: 30,
    alignItems: 'center',
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    marginBottom: 10,
  },
  onboardingSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  onboardingFeatures: {
    width: '100%',
    marginBottom: 30,
  },
  onboardingFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  onboardingFeatureText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 15,
    fontWeight: '500',
  },
  onboardingButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  onboardingButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Compact Deal Card Styles
  compactDealCardGradient: {
    padding: 4,
  },
  compactDealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  compactDealCategory: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 25,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDealCategoryText: {
    color: 'white',
    fontSize: 7,
    fontWeight: '600',
  },
  compactDealDiscount: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 30,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDealDiscountText: {
    color: '#8B5CF6',
    fontSize: 7,
    fontWeight: 'bold',
  },
  compactDealTitle: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  compactDealDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    marginBottom: 2,
    lineHeight: 11,
  },
  compactDealInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  compactDealPricing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactOriginalPrice: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    textDecorationLine: 'line-through',
    marginRight: 2,
  },
  compactDiscountedPrice: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  compactPostedBy: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 7,
    fontStyle: 'italic',
  },
  compactGroupDealSection: {
    marginBottom: 4,
  },
  compactProgressBar: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    marginBottom: 1,
  },
  compactProgressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 1,
  },
  compactGroupDealText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 8,
  },
  compactDealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  compactActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginRight: 2,
    marginBottom: 1,
    minWidth: 25,
    height: 14,
  },
  compactActionButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  compactActionText: {
    color: 'white',
    fontSize: 6,
    marginLeft: 1,
    fontWeight: '500',
  },
});

export default DealsHubScreen;