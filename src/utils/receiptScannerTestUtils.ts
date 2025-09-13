import { robustOCRService } from '@/services/RobustOCRService';
import { enhancedReceiptParser } from '@/services/EnhancedReceiptParser';

// Test utility functions for receipt scanning
export class ReceiptScannerTestUtils {
  
  // Test OCR service with mock data
  static async testOCRService() {
    console.log('🧪 Testing OCR Service...');
    
    try {
      const status = robustOCRService.getServiceStatus();
      console.log('📊 OCR Service Status:', status);
      
      // Test with mock receipt text
      const mockReceiptText = `WALMART SUPERCENTER
STORE #1234
123 MAIN ST
ANYTOWN, ST 12345

04/15/2024 14:23

GROCERIES:
MILK 1 GAL         $3.98
BREAD LOAF         $2.49
EGGS DOZEN         $4.99
BANANAS 2 LBS      $1.98

SUBTOTAL          $13.44
TAX                $1.07
TOTAL             $14.51

VISA ****1234
THANK YOU!`;

      const parsedData = await enhancedReceiptParser.parseReceipt(mockReceiptText, 0.9);
      console.log('✅ Parsed Receipt Data:', parsedData);
      
      return {
        success: true,
        data: parsedData,
        message: 'OCR service test completed successfully'
      };
    } catch (error) {
      console.error('❌ OCR service test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'OCR service test failed'
      };
    }
  }
  
  // Test receipt parser with various formats
  static async testReceiptParser() {
    console.log('🧪 Testing Receipt Parser...');
    
    const testReceipts = [
      {
        name: 'Standard Receipt',
        text: `TARGET STORE T-1234
        123 SHOPPING BLVD
        
        04/20/2024  15:45
        
        HOUSEHOLD ITEMS:
        PAPER TOWELS       $12.99
        DISH SOAP          $3.49
        LAUNDRY DETERGENT  $8.99
        
        SUBTOTAL          $25.47
        SALES TAX          $2.04
        TOTAL             $27.51
        
        MASTERCARD ****5678`
      },
      {
        name: 'Restaurant Receipt',
        text: `PIZZA HUT #456
        789 FOOD COURT
        
        04/18/2024 19:30
        
        1 LARGE PEPPERONI  $15.99
        2 SODAS            $4.98
        DELIVERY FEE       $2.99
        
        SUBTOTAL          $23.96
        TAX               $1.92
        TIP               $4.80
        TOTAL             $30.68
        
        CASH PAYMENT`
      },
      {
        name: 'Gas Station Receipt',
        text: `SHELL STATION 789
        456 HIGHWAY 101
        
        04/19/2024 08:15
        
        FUEL GRADE: REGULAR
        GALLONS: 12.456
        PRICE/GAL: $3.45
        
        FUEL TOTAL        $42.97
        CAR WASH          $8.00
        
        SUBTOTAL          $50.97
        TAX               $0.64
        TOTAL             $51.61
        
        DEBIT CARD ****9012`
      }
    ];
    
    const results = [];
    
    for (const testReceipt of testReceipts) {
      try {
        console.log(`\n📄 Testing ${testReceipt.name}...`);
        const parsed = await enhancedReceiptParser.parseReceipt(testReceipt.text, 0.85);
        
        console.log('✅ Results:', {
          merchant: parsed.merchant,
          total: parsed.total,
          date: parsed.date,
          category: parsed.category,
          itemCount: parsed.items?.length || 0
        });
        
        results.push({
          name: testReceipt.name,
          success: true,
          data: parsed
        });
      } catch (error) {
        console.error(`❌ Failed to parse ${testReceipt.name}:`, error);
        results.push({
          name: testReceipt.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }
  
  // Generate test report
  static generateTestReport(results: any[]) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log('\n📊 TEST REPORT');
    console.log('═══════════════');
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`Success Rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
    
    if (failureCount > 0) {
      console.log('\n❌ FAILURES:');
      results.filter(r => !r.success).forEach(result => {
        console.log(`• ${result.name}: ${result.error}`);
      });
    }
    
    return {
      totalTests: results.length,
      passed: successCount,
      failed: failureCount,
      successRate: (successCount / results.length) * 100
    };
  }
}

// Export for easy testing in development
export const runReceiptScannerTests = async () => {
  console.log('🚀 Starting Receipt Scanner Tests...\n');
  
  // Test 1: OCR Service
  const ocrTest = await ReceiptScannerTestUtils.testOCRService();
  
  // Test 2: Receipt Parser
  const parserTests = await ReceiptScannerTestUtils.testReceiptParser();
  
  // Generate report
  const allResults = [ocrTest, ...parserTests];
  const report = ReceiptScannerTestUtils.generateTestReport(allResults);
  
  console.log('\n🏁 Receipt Scanner Tests Complete!');
  return report;
};