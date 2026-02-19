import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  product_image?: string;
  variant_text?: string | null;
}

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  images: string[] | null;
  description: string | null;
  gst_percentage?: number;
  category_id?: string;
}

interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_state?: string | null;
  customer_pincode?: string | null;
  customer_landmark1?: string | null;
  customer_landmark2?: string | null;
  customer_landmark3?: string | null;
  status: string;
  total: number;
  created_at: string;
  updated_at?: string;
}

export const generateInvoice = async (order: Order, orderItems: OrderItem[], products: Record<string, Product>) => {
  if (!order || orderItems.length === 0) return;
  
  try {
    // Calculate GST from products
    let totalGST = 0;
    
    // We need to fetch GST details if they are not in the products map
    // Since we can't easily fetch here without potentially missing data, 
    // we will try to fetch if we can, or rely on what's passed.
    // However, to be safe and consistent with TrackOrder logic, let's fetch product details if needed.
    // But for simplicity and performance, we'll assume products map has basic info, 
    // and we might need to fetch GST specific info if not present.
    // Actually, let's re-implement the fetch logic here to be sure.
    
    const itemsWithGst = await Promise.all(orderItems.map(async (item) => {
      let gstPercent = 0;
      try {
        const { data: product } = await supabase
          .from('products')
          .select('gst_percentage, category_id')
          .eq('id', item.product_id)
          .maybeSingle();
        
        if (product) {
          if (product.gst_percentage && product.gst_percentage > 0) {
            gstPercent = product.gst_percentage;
          } else if (product.category_id) {
            const { data: category } = await supabase
              .from('categories')
              .select('gst_percentage')
              .eq('id', product.category_id)
              .maybeSingle();
            
            if (category && category.gst_percentage && category.gst_percentage > 0) {
              gstPercent = category.gst_percentage;
            }
          }
        }
      } catch (e) {
        console.error("Error fetching GST", e);
      }
      return { ...item, gstPercent };
    }));

    itemsWithGst.forEach(item => {
      const itemTotal = Number(item.product_price) * item.quantity;
      totalGST += itemTotal * (item.gstPercent / 100);
    });
    
    // Calculate subtotal (before GST and shipping)
    // Assuming order.total includes GST and Shipping.
    // Shipping logic from TrackOrder: subtotal < 300 ? 40 : 0
    // But we need to reverse calculate.
    // Total = Subtotal + GST + Shipping
    // This is tricky if we don't know exact shipping logic used at time of order.
    // Let's assume the standard logic:
    // If we subtract GST from Total, we get (Subtotal + Shipping).
    
    // Let's try to reconstruct:
    // We have item prices. Sum of (Price * Qty) = ItemTotal (inc GST usually in Indian context, or ex GST?)
    // In this system, it seems `product_price` is likely the selling price.
    // If `product_price` is inclusive of GST, then GST component is Price - (Price / (1 + GST%)).
    // If `product_price` is exclusive, then GST is Price * GST%.
    // The previous code did: `totalGST += itemTotal * (gstPercent / 100);` 
    // implying `product_price` is EXCLUSIVE of GST? 
    // Or it's just a simple calculation added on top.
    // Let's stick to the logic in TrackOrder.tsx:
    // `subtotal = Number(order.total) - totalGST;`
    // `shippingCharge = subtotal < 300 ? 40 : 0;`
    // This implies `order.total` is the final amount paid.
    
    const subtotalFromTotal = Number(order.total) - totalGST;
    const shippingCharge = subtotalFromTotal < 300 ? 40 : 0; // Approximate
    const subtotal = subtotalFromTotal - shippingCharge;

    const orderDate = new Date(order.created_at);
    const orderDateString = orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    let deliveredDateString = '';
    let deliveredAgoString = '';

    if (order.status === 'delivered' && order.updated_at) {
      const deliveredDate = new Date(order.updated_at);
      deliveredDateString = deliveredDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const diffSinceDeliveryMs = Date.now() - deliveredDate.getTime();
      const diffSinceDeliveryDays = Math.max(0, Math.floor(diffSinceDeliveryMs / (1000 * 60 * 60 * 24)));
      if (diffSinceDeliveryDays === 0) {
        deliveredAgoString = 'Today';
      } else if (diffSinceDeliveryDays === 1) {
        deliveredAgoString = '1 day ago';
      } else {
        deliveredAgoString = `${diffSinceDeliveryDays} days ago`;
      }
    }
    
    // Create invoice HTML content
    const invoiceContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Invoice - ${order.order_id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
          .invoice { max-width: 800px; margin: 0 auto; border: 1px solid #eee; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #d4af37; }
          .logo { font-size: 28px; font-weight: bold; color: #d4af37; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { font-size: 32px; color: #333; margin-bottom: 5px; }
          .invoice-title p { color: #666; }
          .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .info-block h3 { font-size: 14px; color: #888; margin-bottom: 10px; text-transform: uppercase; }
          .info-block p { margin: 5px 0; font-size: 14px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .items-table th { background: #f8f8f8; padding: 15px; text-align: left; border-bottom: 2px solid #d4af37; font-size: 12px; text-transform: uppercase; color: #666; }
          .items-table td { padding: 15px; border-bottom: 1px solid #eee; font-size: 14px; }
          .items-table .qty { text-align: center; }
          .items-table .price { text-align: right; }
          .total-section { text-align: right; margin-top: 20px; }
          .total-row { display: flex; justify-content: flex-end; margin: 10px 0; font-size: 14px; }
          .total-row span { width: 150px; }
          .total-row.grand-total { font-size: 20px; font-weight: bold; color: #d4af37; border-top: 2px solid #d4af37; padding-top: 15px; margin-top: 15px; }
          .footer { margin-top: 60px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
          .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status.cancelled { background: #fee2e2; color: #dc2626; }
          .status.delivered { background: #dcfce7; color: #16a34a; }
          .status.pending { background: #fef3c7; color: #d97706; }
          @media print { 
            body { padding: 0; }
            .invoice { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div>
              <div class="logo">cartlyfy.com</div>
              <p style="margin-top: 4px; color: #666; font-size: 12px;">store@cartlyfy.com</p>
            </div>
            <div class="invoice-title">
              <h1>INVOICE</h1>
              <p>#${order.order_id}</p>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-block">
              <h3>Bill To</h3>
              <p><strong>${order.customer_name}</strong></p>
              <p>${order.customer_phone}</p>
              <p style="max-width: 300px;">${order.customer_address}</p>
              ${(order.customer_state || order.customer_pincode) ? `<p>${order.customer_state || ''}${order.customer_state && order.customer_pincode ? ', ' : ''} ${order.customer_pincode || ''}</p>` : ''}
            </div>
            <div class="info-block" style="text-align: right;">
              <h3>Invoice Details</h3>
              <p><strong>Order Date:</strong> ${orderDateString}</p>
              ${deliveredDateString ? `<p><strong>Delivered On:</strong> ${deliveredDateString}</p>` : ''}
              ${deliveredAgoString ? `<p><strong>Delivery Time:</strong> ${deliveredAgoString}</p>` : ''}
              <p><strong>Status:</strong> <span class="status ${order.status}">${order.status.toUpperCase()}</span></p>
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="qty">Qty</th>
                <th class="price">Price</th>
                <th class="price">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map(item => {
                const product = products[item.product_id];
                const imageUrl = item.product_image || product?.images?.[0] || product?.image_url || '';
                return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      ${imageUrl ? `<img src="${imageUrl}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #eee;" />` : ''}
                      <div>
                        <div>${item.product_name}</div>
                        ${item.variant_text ? `<div style="font-size:12px;color:#888;">${item.variant_text}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="qty">${item.quantity}</td>
                  <td class="price">₹${Number(item.product_price).toFixed(2)}</td>
                  <td class="price">₹${(Number(item.product_price) * item.quantity).toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="total-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${totalGST > 0 ? `
            <div class="total-row">
              <span>GST:</span>
              <span>₹${totalGST.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row">
              <span>Shipping:</span>
              <span>${shippingCharge === 0 ? 'FREE' : `₹${shippingCharge.toFixed(2)}`}</span>
            </div>
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>₹${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for shopping with cartlyfy.com!</p>
            <p style="margin-top: 5px;">This is a computer generated invoice and does not require a signature.</p>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    
    // Create blob and open
    const blob = new Blob([invoiceContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    return true;
  } catch (error) {
    console.error('Error generating invoice:', error);
    toast.error('Failed to generate invoice');
    return false;
  }
};
