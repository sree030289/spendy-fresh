// Debug script to check Firebase expenses vs API expenses
// This can be run in the browser console when logged in as admin6

const checkDataSources = async () => {
  console.log('🔍 Checking data sources for discrepancy...');
  
  // Group ID from the API call
  const groupId = 'ZZAkWWay3NmPZmmdMvcN';
  
  // Admin6 user ID from the token payload
  const admin6Id = 'VwRMjepAD4arE9ylGv9n';
  
  // Admin5 user ID (from group members)
  const admin5Id = '4TH0BEePuvoHJ3kALYxw';
  
  console.log('📊 Checking what UnifiedSettlementService.calculateGroupPairwiseBalance sees...');
  
  try {
    // This should match what the UI is calculating
    const balance = await window.UnifiedSettlementService?.calculateGroupPairwiseBalance?.(
      admin6Id, 
      admin5Id, 
      groupId
    );
    
    console.log('💰 Calculated balance (admin6 perspective):', balance);
    
    // Also check SplittingService directly if available
    if (window.SplittingService?.getGroupExpenses) {
      const firebaseExpenses = await window.SplittingService.getGroupExpenses(groupId);
      console.log('🔥 Firebase expenses:', firebaseExpenses);
    }
    
  } catch (error) {
    console.error('❌ Error in debug check:', error);
  }
};

// Run the check
checkDataSources();
