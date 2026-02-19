// Test script to check seller notification emails
const { createClient } = require('@supabase/supabase-js');

// Replace with your actual values
const SUPABASE_URL = 'https://hdstelpktngunkqzsfkd.supabase.co';
const SUPABASE_SERVICE_KEY = 'your-service-role-key-here'; // Get from Supabase dashboard

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testSellerEmails() {
  try {
    console.log('🔍 Checking seller notification emails...');
    
    // First, get all sellers
    const { data: sellers, error: sellersError } = await supabase
      .from('sellers')
      .select('id, name, email');
    
    if (sellersError) {
      console.error('❌ Error fetching sellers:', sellersError);
      return;
    }
    
    console.log('🏪 Found sellers:', sellers);
    
    // Check notification emails for each seller
    for (const seller of sellers) {
      console.log(`\n📧 Checking emails for seller: ${seller.name} (${seller.email})`);
      
      const { data: emails, error: emailsError } = await supabase
        .from('seller_notification_emails')
        .select('*')
        .eq('seller_id', seller.id);
      
      if (emailsError) {
        console.error('❌ Error fetching emails:', emailsError);
      } else {
        console.log('📧 Notification emails:', emails || 'None found');
      }
    }
    
    // Test the notification function directly
    console.log('\n🚀 Testing seller notifier function...');
    
    const testPayload = {
      event: 'return_requested',
      order_id: 'test-order-id',
      seller_id: sellers[0]?.id || 'test-seller-id',
      message: 'Test return request'
    };
    
    const { data: functionResult, error: functionError } = await supabase
      .functions
      .invoke('seller-notifier', {
        body: testPayload
      });
    
    if (functionError) {
      console.error('❌ Function error:', functionError);
    } else {
      console.log('✅ Function result:', functionResult);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testSellerEmails();