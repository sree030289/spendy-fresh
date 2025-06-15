// Firebase Functions implementation
// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors')({origin: true});

admin.initializeApp();
const db = admin.firestore();

// Helper function to delay requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class DealsScraperFirebase {
  static async scrapeOzBargain(limit = 30) {
    try {
      console.log('Scraping OzBargain...');
      
      const response = await axios.get('https://www.ozbargain.com.au/deals', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const deals = [];

      $('.node-ozbdeal').slice(0, limit).each((index, element) => {
        try {
          const $deal = $(element);
          
          const title = $deal.find('.title a').text().trim();
          const description = $deal.find('.content').first().text().trim().substring(0, 200);
          const dealUrl = $deal.find('.title a').attr('href');
          const fullUrl = dealUrl ? (dealUrl.startsWith('http') ? dealUrl : `https://www.ozbargain.com.au${dealUrl}`) : '';
          
          // Extract prices
          const priceText = $deal.find('.content').text();
          const priceMatches = priceText.match(/\$[\d,]+\.?\d*/g);
          
          let originalPrice = 0;
          let discountedPrice = 0;
          let discount = 0;
          
          if (priceMatches && priceMatches.length >= 2) {
            originalPrice = parseFloat(priceMatches[0].replace(/[$,]/g, ''));
            discountedPrice = parseFloat(priceMatches[1].replace(/[$,]/g, ''));
            discount = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
          } else if (priceMatches && priceMatches.length === 1) {
            discountedPrice = parseFloat(priceMatches[0].replace(/[$,]/g, ''));
            originalPrice = discountedPrice * 1.5;
            discount = 33;
          }

          const votesText = $deal.find('.voteup .count').text();
          const likes = parseInt(votesText) || Math.floor(Math.random() * 50) + 10;

          const businessName = $deal.find('.via a').text().trim() || 'Various Stores';

          // Determine category
          let category = 'Local Deals';
          const titleLower = title.toLowerCase();
          
          if (titleLower.includes('netflix') || titleLower.includes('streaming')) {
            category = 'OTT';
          } else if (titleLower.includes('free') || discountedPrice === 0) {
            category = 'Freebies';
          } else if (titleLower.includes('group') || titleLower.includes('bulk')) {
            category = 'Group Buying';
          }

          if (title && title.length > 5) {
            deals.push({
              id: `oz_${Date.now()}_${index}`,
              title: title.substring(0, 100),
              description: description || title.substring(0, 200),
              category,
              originalPrice: originalPrice || discountedPrice * 1.3,
              discountedPrice: discountedPrice || 0,
              discount: discount || 25,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              postedBy: 'OzBargain Community',
              likes: likes,
              dislikes: 0,
              isGroupDeal: category === 'Group Buying',
              chatEnabled: true,
              isPartnership: false,
              businessName,
              location: 'Australia',
              source: 'ozbargain',
              dealUrl: fullUrl,
              scrapedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(`Error parsing OzBargain deal ${index}:`, error.message);
        }
      });

      console.log(`Scraped ${deals.length} deals from OzBargain`);
      return deals;
    } catch (error) {
      console.error('OzBargain scraping error:', error.message);
      return [];
    }
  }

  static async scrapeGroupon(limit = 10) {
    try {
      console.log('Scraping Groupon...');
      
      const response = await axios.get('https://www.groupon.com.au/deals/australia', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const deals = [];

      $('.cui-ufc-main-unit, .deal-tile').slice(0, limit).each((index, element) => {
        try {
          const $deal = $(element);
          
          const title = $deal.find('.cui-ufc-deal-title a, [data-testid="deal-title"], .deal-title').text().trim();
          const description = $deal.find('.cui-ufc-merchant-name, [data-testid="merchant-name"], .merchant-name').text().trim();

          const priceText = $deal.find('.cui-ufc-price-current, .price-current, .deal-price').text().trim();
          const originalPriceText = $deal.find('.cui-ufc-price-original, .price-original, .deal-original-price').text().trim();
          
          let discountedPrice = 0;
          let originalPrice = 0;
          
          if (priceText) {
            discountedPrice = parseFloat(priceText.replace(/[$,AUD\s]/g, ''));
          }
          if (originalPriceText) {
            originalPrice = parseFloat(originalPriceText.replace(/[$,AUD\s]/g, ''));
          }

          const discount = originalPrice > 0 ? 
            Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) : 50;

          const dealUrl = $deal.find('a').attr('href');
          const fullUrl = dealUrl ? (dealUrl.startsWith('http') ? dealUrl : `https://www.groupon.com.au${dealUrl}`) : '';

          if (title && title.length > 5) {
            deals.push({
              id: `groupon_${Date.now()}_${index}`,
              title: title.substring(0, 100),
              description: description || 'Great deal from Groupon',
              category: 'Local Deals',
              originalPrice: originalPrice || discountedPrice * 2,
              discountedPrice: discountedPrice || 0,
              discount: discount,
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              postedBy: 'Groupon',
              likes: Math.floor(Math.random() * 50) + 10,
              dislikes: 0,
              isGroupDeal: false,
              chatEnabled: true,
              isPartnership: true,
              businessName: description || 'Groupon Partner',
              location: 'Australia',
              source: 'groupon',
              dealUrl: fullUrl,
              scrapedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(`Error parsing Groupon deal ${index}:`, error.message);
        }
      });

      console.log(`Scraped ${deals.length} deals from Groupon`);
      return deals;
    } catch (error) {
      console.error('Groupon scraping error:', error.message);
      return [];
    }
  }

  static async scrapeCatch(limit = 10) {
    try {
      console.log('Scraping Catch...');
      
      const response = await axios.get('https://www.catch.com.au/deals', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const deals = [];

      $('.product-item, .deal-card').slice(0, limit).each((index, element) => {
        try {
          const $deal = $(element);
          
          const title = $deal.find('.product-title a, .deal-title').text().trim();
          
          const priceText = $deal.find('.price-current, .current-price').text().trim();
          const originalPriceText = $deal.find('.price-previous, .original-price').text().trim();
          
          let discountedPrice = 0;
          let originalPrice = 0;
          
          if (priceText) {
            discountedPrice = parseFloat(priceText.replace(/[$,\s]/g, ''));
          }
          if (originalPriceText) {
            originalPrice = parseFloat(originalPriceText.replace(/[$,\s]/g, ''));
          }

          const discount = originalPrice > 0 ? 
            Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) : 30;

          const dealUrl = $deal.find('a').attr('href');
          const fullUrl = dealUrl ? (dealUrl.startsWith('http') ? dealUrl : `https://www.catch.com.au${dealUrl}`) : '';

          if (title && title.length > 5 && discountedPrice > 0) {
            deals.push({
              id: `catch_${Date.now()}_${index}`,
              title: title.substring(0, 100),
              description: `Great deal on ${title.split(' ').slice(0, 10).join(' ')}`,
              category: 'Local Deals',
              originalPrice: originalPrice || discountedPrice * 1.4,
              discountedPrice: discountedPrice,
              discount: discount,
              expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
              postedBy: 'Catch.com.au',
              likes: Math.floor(Math.random() * 30) + 5,
              dislikes: 0,
              isGroupDeal: false,
              chatEnabled: true,
              isPartnership: true,
              businessName: 'Catch.com.au',
              location: 'Australia',
              source: 'catch',
              dealUrl: fullUrl,
              scrapedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(`Error parsing Catch deal ${index}:`, error.message);
        }
      });

      console.log(`Scraped ${deals.length} deals from Catch`);
      return deals;
    } catch (error) {
      console.error('Catch scraping error:', error.message);
      return [];
    }
  }
}

// Cloud Function to scrape and store deals
exports.updateDeals = functions.pubsub.schedule('every 6 hours').onRun(async (context) => {
  try {
    console.log('Starting scheduled deal update...');
    
    const [ozDeals, grouponDeals, catchDeals] = await Promise.all([
      DealsScraperFirebase.scrapeOzBargain(30),
      DealsScraperFirebase.scrapeGroupon(10),
      DealsScraperFirebase.scrapeCatch(10),
    ]);

    let allDeals = [...ozDeals, ...grouponDeals, ...catchDeals];
    
    // Sort by popularity and limit to 50
    allDeals = allDeals
      .sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes))
      .slice(0, 50);

    // Store in Firestore
    const batch = db.batch();
    
    // Clear existing deals
    const existingDeals = await db.collection('deals').get();
    existingDeals.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new deals
    allDeals.forEach(deal => {
      const dealRef = db.collection('deals').doc(deal.id);
      batch.set(dealRef, deal);
    });

    // Update metadata
    const metaRef = db.collection('metadata').doc('deals');
    batch.set(metaRef, {
      totalDeals: allDeals.length,
      lastUpdated: new Date().toISOString(),
      sources: {
        ozbargain: ozDeals.length,
        groupon: grouponDeals.length,
        catch: catchDeals.length,
      },
    });

    await batch.commit();
    
    console.log(`Successfully updated ${allDeals.length} deals`);
    return { success: true, totalDeals: allDeals.length };
  } catch (error) {
    console.error('Error updating deals:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update deals');
  }
});

// HTTP function to get deals with pagination
exports.getDeals = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const category = req.query.category;
      const refresh = req.query.refresh === 'true';

      // If refresh requested, trigger update
      if (refresh) {
        try {
          await exports.updateDeals.run();
        } catch (error) {
          console.error('Manual refresh failed:', error);
        }
      }

      // Build query
      let query = db.collection('deals').orderBy('likes', 'desc');
      
      if (category && category !== 'All') {
        query = query.where('category', '==', category);
      }

      // Get total count for pagination
      const totalSnapshot = await query.get();
      const totalDeals = totalSnapshot.size;

      // Apply pagination
      const offset = (page - 1) * limit;
      const dealsSnapshot = await query.offset(offset).limit(limit).get();
      
      const deals = [];
      dealsSnapshot.forEach(doc => {
        deals.push({ id: doc.id, ...doc.data() });
      });

      // Get metadata
      const metaDoc = await db.collection('metadata').doc('deals').get();
      const metadata = metaDoc.exists ? metaDoc.data() : { lastUpdated: new Date().toISOString() };

      const totalPages = Math.ceil(totalDeals / limit);

      res.json({
        deals,
        pagination: {
          currentPage: page,
          totalPages,
          totalDeals,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          dealsPerPage: limit,
        },
        lastUpdated: metadata.lastUpdated,
        sources: metadata.sources || {},
      });

    } catch (error) {
      console.error('Error getting deals:', error);
      res.status(500).json({ error: 'Failed to get deals' });
    }
  });
});

// HTTP function to manually refresh deals
exports.refreshDeals = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const result = await exports.updateDeals.run();
      res.json({
        success: true,
        message: 'Deals refreshed successfully',
        totalDeals: result.totalDeals,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error refreshing deals:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to refresh deals' 
      });
    }
  });
});

// HTTP function for health check
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const metaDoc = await db.collection('metadata').doc('deals').get();
      const metadata = metaDoc.exists ? metaDoc.data() : {};
      
      const dealsSnapshot = await db.collection('deals').get();
      
      res.json({
        status: 'OK',
        cachedDeals: dealsSnapshot.size,
        lastUpdated: metadata.lastUpdated,
        sources: metadata.sources || {},
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'ERROR', 
        error: error.message 
      });
    }
  });
});