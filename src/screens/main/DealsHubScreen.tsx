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
  Share,
  Linking,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Icon } from '../../components/common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { DealsAPI, useDeals, Deal, OZBARGAIN_CATEGORIES } from '@/services/DealsAPI';

const DealsHubScreen: React.FC = () => {
  const { theme, colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('All Deals');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [currentDealUrl, setCurrentDealUrl] = useState('');
  const [currentDealTitle, setCurrentDealTitle] = useState('');

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
    availableCategories,
  } = useDeals(selectedCategory);

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
        `Found ${pagination?.totalDeals || 0} deals in ${selectedCategory}`,
        [{ text: 'Great!', style: 'default' }]
      );
    } catch (error) {
      Alert.alert('Refresh Failed', 'Unable to fetch latest deals. Please try again.');
    } finally {
      setIsManualRefresh(false);
    }
  }, [refreshDeals, pagination?.totalDeals, selectedCategory]);

  const openDeal = (deal: Deal) => {
    if (deal.dealUrl) {
      setCurrentDealUrl(deal.dealUrl);
      setCurrentDealTitle(deal.title);
      setShowWebView(true);
    } else {
      Alert.alert('No Link', 'This deal does not have a direct link available');
    }
  };

  const generateDeepLink = (deal: Deal) => {
    return `spendy://deal/${deal.id}`;
  };

  const generateAppStoreLink = () => {
    return Platform.OS === 'ios' 
      ? 'https://apps.apple.com/au/app/spendy/id123456789'
      : 'https://play.google.com/store/apps/details?id=com.spendy.app';
  };

  const handleShareDeal = async (deal: Deal) => {
    try {
      const deepLink = generateDeepLink(deal);
      const appStoreLink = generateAppStoreLink();
      
      const shareMessage = `💚 DEAL ALERT from Spendy! 💚

${deal.title}

Found this great deal on OzBargain via Spendy app!

📱 Open in Spendy: ${deepLink}
📲 Get Spendy: ${appStoreLink}`;

      await Share.share({
        message: shareMessage,
        title: deal.title,
        url: deepLink,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share deal. Please try again.');
    }
  };

  const getCategoryIcon = (iconName?: string) => {
    return iconName || 'pricetag';
  };

  const renderDealCard = ({ item: deal }: { item: Deal }) => {
    const hasPrice = deal.originalPrice > 0 && deal.discountedPrice > 0;
    
    return (
      <TouchableOpacity 
        style={[styles.dealCard, { backgroundColor: colors.surface }]}
        onPress={() => openDeal(deal)}
        activeOpacity={0.7}
      >
        {/* Header Row */}
        <View style={styles.dealHeader}>
          <View style={styles.leftHeader}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
              <Icon 
                name={getCategoryIcon(deal.categoryIcon) as any} 
                size={12} 
                color="white" 
              />
              <Text style={styles.categoryText}>{deal.category}</Text>
            </View>
            <View style={[styles.sourceBadge, { backgroundColor: '#FF6B35' }]}>
              <Text style={styles.sourceText}>OzBargain</Text>
            </View>
          </View>
          <View style={styles.voteContainer}>
            <Icon name="chevron-up" size={12} color={colors.success} />
            <Text style={[styles.voteText, { color: colors.success }]}>
              {deal.likes}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.dealTitle, { color: colors.text }]} numberOfLines={2}>
          {deal.title}
        </Text>

        {/* Price Row - Only show if prices are available and meaningful */}
        {hasPrice && (
          <View style={styles.priceRow}>
            {deal.originalPrice !== deal.discountedPrice && (
              <Text style={[styles.originalPrice, { color: colors.textMuted }]}>
                ${deal.originalPrice.toFixed(2)}
              </Text>
            )}
            <Text style={[styles.discountedPrice, { color: colors.primary }]}>
              ${deal.discountedPrice.toFixed(2)}
            </Text>
            {deal.discount > 0 && (
              <View style={[styles.discountBadge, { backgroundColor: colors.success }]}>
                <Text style={styles.discountText}>{deal.discount}% OFF</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer Row */}
        <View style={styles.dealFooter}>
          <View style={styles.dealMeta}>
            <Text style={[styles.postedBy, { color: colors.textMuted }]}>
              by {deal.postedBy}
            </Text>
            {deal.timePosted && (
              <Text style={[styles.timePosted, { color: colors.textMuted }]}>
                • {deal.timePosted}
              </Text>
            )}
          </View>
          
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShareDeal(deal)}
            >
              <Icon name="share" size={16} color={colors.textMuted}  />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.getDealButton, { backgroundColor: colors.primary }]}
              onPress={() => openDeal(deal)}
            >
              <Text style={styles.getDealText}>Get Deal</Text>
              <Icon name="open-outline" size={14} color="white" />
            </TouchableOpacity>
          </View>
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
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.loadMoreText}>Load More</Text>
              <Icon name="chevron-down" size={16} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
        <Icon name="pricetag-outline" size={48} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {error ? 'Connection Error' : 'No deals found'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {error 
          ? 'Unable to load deals. Check your internet connection.' 
          : searchQuery 
            ? 'Try adjusting your search'
            : `We're fetching the latest deals from ${selectedCategory}`
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>OzBargain Deals</Text>
              <Text style={styles.headerSubtitle}>
                {pagination ? `${pagination.totalDeals} live deals` : 'Loading deals...'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleManualRefresh}
              disabled={isManualRefresh}
            >
              {isManualRefresh ? (
                <ActivityIndicator size={16} color={colors.primary} />
              ) : (
                <Icon name="refresh" size={18} color={colors.primary}  />
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
              <Icon name="search" size={18} color={colors.textMuted}  />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search deals..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="error" size={18} color={colors.textMuted}  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Last Updated */}
          {lastUpdated && (
            <View style={styles.lastUpdatedContainer}>
              <Icon name="time" size={12} color="rgba(255,255,255,0.7)"  />
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

      {/* Category Filters */}
      <View style={[styles.categoriesSection, { backgroundColor: colors.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {OZBARGAIN_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                { 
                  backgroundColor: selectedCategory === category ? colors.primary : colors.surface,
                  borderColor: selectedCategory === category ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryChipText,
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

      {/* Deals List */}
      {loading && filteredDeals.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading {selectedCategory} deals...
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

      {/* WebView Modal */}
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.webViewContainer}>
          <View style={[styles.webViewHeader, { backgroundColor: colors.primary }]}>
            <TouchableOpacity
              onPress={() => setShowWebView(false)}
              style={styles.webViewCloseButton}
            >
              <Icon name="close" size={24} color="white"  />
            </TouchableOpacity>
            <Text style={styles.webViewTitle} numberOfLines={1}>
              {currentDealTitle}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (currentDealUrl) {
                  Linking.openURL(currentDealUrl);
                }
              }}
              style={styles.webViewOpenButton}
            >
              <Icon name="open-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
          
          {currentDealUrl ? (
            <WebView
              source={{ uri: currentDealUrl }}
              style={styles.webView}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.webViewLoadingText, { color: colors.textSecondary }]}>
                    Loading deal...
                  </Text>
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView error: ', nativeEvent);
                Alert.alert(
                  'Error Loading Deal',
                  'Unable to load the deal page. Would you like to open it in your browser?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Open in Browser', 
                      onPress: () => {
                        setShowWebView(false);
                        Linking.openURL(currentDealUrl);
                      }
                    }
                  ]
                );
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView HTTP error: ', nativeEvent);
              }}
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            />
          ) : (
            <View style={styles.webViewError}>
              <Icon name="alert" size={48} color={colors.textMuted}  />
              <Text style={[styles.webViewErrorText, { color: colors.text }]}>
                No URL available for this deal
              </Text>
            </View>
          )}
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
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 36,
    height: 36,
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
    paddingVertical: 10,
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
  categoriesSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  categoriesContent: {
    paddingHorizontal: 20,
  },
  categoryChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 10,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
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
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dealsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  dealCard: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leftHeader: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  categoryText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  sourceBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  voteText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dealTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  discountBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  dealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  postedBy: {
    fontSize: 11,
  },
  timePosted: {
    fontSize: 11,
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  getDealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  getDealText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  loadMoreText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // WebView Modal Styles
  webViewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  webViewCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  webViewOpenButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  webViewLoadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  webViewError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  webViewErrorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default DealsHubScreen;