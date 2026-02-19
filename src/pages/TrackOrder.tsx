import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Crown, Package, Truck, CheckCircle, Clock, Loader2, XCircle, MessageCircle, FileText, Download, AlertCircle } from "lucide-react";
import { cn, normalizeIndianMobile } from "@/lib/utils";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_state: string | null;
  customer_pincode: string | null;
  customer_landmark1: string | null;
  customer_landmark2: string | null;
  customer_landmark3: string | null;
  status: string;
  total: number;
  created_at: string;
  updated_at: string;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  images: string[] | null;
  description: string | null;
}

interface OrderMessage {
  id: string;
  message: string;
  is_admin: boolean;
  is_delivery_boy?: boolean;
  created_at: string;
}

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'packed', label: 'Packed', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function TrackOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, loading } = useCustomerAuth();
  const [searchId, setSearchId] = useState('');
  const [searchType, setSearchType] = useState<'order-id' | 'phone'>('order-id');
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (isLoggedIn) return;

    const redirectTo = `${location.pathname}${location.search}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
  }, [isLoggedIn, loading, location.pathname, location.search, navigate]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSearchDoneRef = useRef(false);
  const autoInvoiceTriggeredRef = useRef(false);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for order updates
  useEffect(() => {
    if (!order) return;

    const orderChannel = supabase
      .channel(`order-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => {
          setOrder(prev => prev ? { ...prev, ...payload.new } : null);
          toast.info('Order status updated!');
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel(`messages-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${order.id}` },
        (payload) => {
          const newMsg = payload.new as OrderMessage;
          if (newMsg.is_admin || newMsg.is_delivery_boy) {
            setMessages(prev => [...prev, newMsg]);
            toast.info('New message from store!');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [order?.id]);

  const runSearch = async (searchBy: 'order-id' | 'phone', value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      toast.error(searchBy === 'order-id' 
        ? 'Please enter an order ID' 
        : 'Please enter a phone number');
      return;
    }

    if (searchBy === 'phone') {
      const normalizedPhone = normalizeIndianMobile(trimmed);
      if (!normalizedPhone) {
        toast.error('Please enter a valid Indian mobile number');
        return;
      }
    }

    setIsLoading(true);
    setOrder(null);
    setOrderItems([]);
    setProducts({});
    setMessages([]);

    try {
      let orderData: Order | null = null;
      
      if (searchBy === 'order-id') {
        const { data, error: orderError } = await supabase
          .from('orders')
          .select('id, order_id, customer_name, customer_phone, customer_address, customer_state, customer_pincode, customer_landmark1, customer_landmark2, customer_landmark3, status, total, created_at, updated_at')
          .eq('order_id', trimmed.toUpperCase())
          .maybeSingle();
          
        if (orderError) throw orderError;
        orderData = data as Order | null;
      } else {
        const normalizedPhone = normalizeIndianMobile(trimmed);
        if (!normalizedPhone) {
          toast.error('Please enter a valid Indian mobile number');
          return;
        }
        
        const formattedPhone = `+91${normalizedPhone}`;
        
        const { data, error: orderError } = await supabase
          .from('orders')
          .select('id, order_id, customer_name, customer_phone, customer_address, customer_state, customer_pincode, customer_landmark1, customer_landmark2, customer_landmark3, status, total, created_at, updated_at')
          .eq('customer_phone', formattedPhone)
          .order('created_at', { ascending: false });
          
        if (orderError) throw orderError;
        
        if (data && data.length > 0) {
          orderData = data[0] as Order;
        }
      }

      if (!orderData) {
        toast.error(searchBy === 'order-id' 
          ? 'Order not found. Please check your order ID.' 
          : 'No orders found for this phone number.');
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderData.id);

      if (itemsError) throw itemsError;

      const productIds = itemsData?.map(item => item.product_id) || [];
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, image_url, images, description')
          .in('id', productIds);
        
        if (productsData) {
          const productsMap: Record<string, Product> = {};
          productsData.forEach(p => { productsMap[p.id] = p; });
          setProducts(productsMap);
        }
      }

      const { data: messagesData } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderData.id)
        .or('is_admin.eq.true,is_delivery_boy.eq.true')
        .order('created_at', { ascending: true });

      setOrder(orderData);
      setOrderItems(itemsData || []);
      setMessages(messagesData || []);
      
      if (orderData.status === 'cancelled') {
        toast.error('This order has been cancelled.');
      } else {
        toast.success('Order found!');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to fetch order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(searchType, searchId);
  };

  useEffect(() => {
    if (loading) return;
    if (initialSearchDoneRef.current) return;

    const params = new URLSearchParams(location.search);
    const idParam = params.get('id');
    if (!idParam) return;

    initialSearchDoneRef.current = true;
    setSearchType('order-id');
    setSearchId(idParam);
    runSearch('order-id', idParam);
  }, [loading, location.search]);

  // Generate Invoice PDF
  const generateInvoice = async () => {
    if (!order || orderItems.length === 0) return;
    if (order.status !== 'delivered') {
      toast.error('Invoice is available only after your order is delivered.');
      return;
    }
    
    setGeneratingInvoice(true);
    
    try {
      // Calculate GST from products
      let totalGST = 0;
      
      for (const item of orderItems) {
        try {
          const { data: product } = await supabase
            .from('products')
            .select('gst_percentage, category_id')
            .eq('id', item.product_id)
            .maybeSingle();
          
          if (product) {
            let gstPercent = 0;
            
            // Product GST takes priority
            if (product.gst_percentage && product.gst_percentage > 0) {
              gstPercent = product.gst_percentage;
            }
            // Fall back to category GST
            else if (product.category_id) {
              const { data: category } = await supabase
                .from('categories')
                .select('gst_percentage')
                .eq('id', product.category_id)
                .maybeSingle();
              
              if (category && category.gst_percentage && category.gst_percentage > 0) {
                gstPercent = category.gst_percentage;
              }
            }
            
            const itemTotal = Number(item.product_price) * item.quantity;
            totalGST += itemTotal * (gstPercent / 100);
          }
        } catch (error) {
          console.error('Error calculating GST for item:', error);
        }
      }
      
      // Calculate subtotal (before GST and shipping)
      const subtotal = Number(order.total) - totalGST;
      
      // Calculate shipping charge
      const shippingCharge = subtotal < 300 ? 40 : 0;
      
      // Calculate actual subtotal (before GST and shipping)
      const actualSubtotal = subtotal - shippingCharge;
      
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
            .invoice { max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #d4af37; }
            .logo { font-size: 28px; font-weight: bold; color: #d4af37; }
            .invoice-title { text-align: right; }
            .invoice-title h1 { font-size: 32px; color: #333; margin-bottom: 5px; }
            .invoice-title p { color: #666; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .info-block h3 { font-size: 14px; color: #888; margin-bottom: 10px; text-transform: uppercase; }
            .info-block p { margin: 5px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { background: #f8f8f8; padding: 15px; text-align: left; border-bottom: 2px solid #d4af37; font-size: 12px; text-transform: uppercase; color: #666; }
            .items-table td { padding: 15px; border-bottom: 1px solid #eee; }
            .items-table .qty { text-align: center; }
            .items-table .price { text-align: right; }
            .total-section { text-align: right; margin-top: 20px; }
            .total-row { display: flex; justify-content: flex-end; margin: 10px 0; }
            .total-row span { width: 150px; }
            .total-row.grand-total { font-size: 20px; font-weight: bold; color: #d4af37; border-top: 2px solid #d4af37; padding-top: 15px; margin-top: 15px; }
            .footer { margin-top: 60px; text-align: center; color: #888; font-size: 12px; }
            .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
            .status.cancelled { background: #fee2e2; color: #dc2626; }
            .status.delivered { background: #dcfce7; color: #16a34a; }
            .status.pending { background: #fef3c7; color: #d97706; }
            @media print { body { padding: 20px; } }
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
                <p>${order.order_id}</p>
              </div>
            </div>
            
            <div class="info-section">
              <div class="info-block">
                <h3>Bill To</h3>
                <p><strong>${order.customer_name}</strong></p>
                <p>${order.customer_phone}</p>
                <p>${order.customer_address}</p>
                ${(order.customer_state || order.customer_pincode) ? `<p>${order.customer_state}${order.customer_state && order.customer_pincode ? ', ' : ''} ${order.customer_pincode}</p>` : ''}
                ${(order.customer_landmark1 || order.customer_landmark2 || order.customer_landmark3) ? `
                <p><strong>Landmarks:</strong></p>
                ${order.customer_landmark1 ? `<p>• ${order.customer_landmark1}</p>` : ''}
                ${order.customer_landmark2 ? `<p>• ${order.customer_landmark2}</p>` : ''}
                ${order.customer_landmark3 ? `<p>• ${order.customer_landmark3}</p>` : ''}` : ''}
              </div>
              <div class="info-block" style="text-align: right;">
                <h3>Invoice Details</h3>
                <p><strong>Order Date:</strong> ${orderDateString}</p>
                ${deliveredDateString ? `<p><strong>Delivered On:</strong> ${deliveredDateString}</p>` : ''}
                ${deliveredAgoString ? `<p><strong>Delivered:</strong> ${deliveredAgoString}</p>` : ''}
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
                  const imageUrl = product?.images?.[0] || product?.image_url || '';
                  return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${item.product_name}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #eee;" />` : ''}
                        <span>${item.product_name}</span>
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
              <p style="margin-top: 5px;">For any queries, please email us at store@cartlyfy.com.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Create blob and download
      const blob = new Blob([invoiceContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Open in new window for printing/saving as PDF
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      toast.success('Invoice opened! Use Print > Save as PDF to download.');
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId.trim()) {
      toast.error('Please enter your order ID');
      return;
    }

    setCancelling(true);
    try {
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', cancelOrderId.trim().toUpperCase())
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!orderData) {
        toast.error('Order not found');
        return;
      }

      if (['shipped', 'delivered', 'cancelled'].includes(orderData.status)) {
        toast.error(`Cannot cancel order. Current status: ${orderData.status}`);
        return;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderData.id);

      if (updateError) throw updateError;

      // Add cancellation message
      await supabase
        .from('order_messages')
        .insert({
          order_id: orderData.id,
          message: 'Customer cancelled the order.',
          is_admin: false,
        });

      toast.success('Order cancelled successfully');
      setCancelDialogOpen(false);
      setCancelOrderId('');

      // Refresh if viewing the same order
      if (order?.order_id === cancelOrderId.trim().toUpperCase()) {
        setOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const getCurrentStep = () => {
    if (!order) return -1;
    if (order.status === 'cancelled') return -2;
    return statusSteps.findIndex((step) => step.key === order.status);
  };

  const currentStep = getCurrentStep();

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="warm-bg min-h-screen">
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Track Your <span className="gradient-gold-text">Order</span>
            </h1>
            <p className="text-muted-foreground">
              {searchType === 'order-id' 
                ? 'Enter your order ID to track your order status' 
                : 'Enter your phone number to find your order'}
            </p>
          </div>

          {/* Return Policy Notice */}
          <Alert className="mb-8 border-amber-200 bg-amber-50 text-amber-800">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-semibold text-amber-900">Return Policy Notice</AlertTitle>
            <AlertDescription className="text-amber-700">
              If you wish to return your product, please download your invoice first as proof of purchase. 
              You can download the invoice from the order details section below once you track your order.
            </AlertDescription>
          </Alert>

          {/* Search Type Selector */}
          <div className="mb-6">
            <Select value={searchType} onValueChange={(value: 'order-id' | 'phone') => setSearchType(value)}>
              <SelectTrigger className="w-full max-w-xs mx-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order-id">Search by Order ID</SelectItem>
                <SelectItem value="phone">Search by Phone Number</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-8 animate-fade-in stagger-1">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder={searchType === 'order-id' 
                    ? "Enter your Order ID (e.g., RYL-XXXXXXXX)" 
                    : "e.g., 9876543210 (10 digits, starting with 6-9)"}
                  className="pl-12 h-14 text-lg"
                />
              </div>
              <Button type="submit" variant="royal" size="lg" className="h-14 px-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track'}
              </Button>
            </div>
          </form>

          {/* Cancel Order Button */}
          <div className="flex justify-center mb-8">
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel an Order
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Order</DialogTitle>
                  <DialogDescription>
                    Enter your Order ID to cancel. Orders that are already shipped or delivered cannot be cancelled.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={cancelOrderId}
                    onChange={(e) => setCancelOrderId(e.target.value)}
                    placeholder="Enter Order ID (e.g., RYL-XXXXXXXX)"
                  />
                  <Button 
                    variant="destructive" 
                    className="w-full" 
                    onClick={handleCancelOrder}
                    disabled={cancelling}
                  >
                    {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Confirm Cancellation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Order Details */}
          {order && (
            <div className="animate-fade-in">
              {/* Order Status */}
              <div className="bg-card rounded-xl border border-border/50 p-6 mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Order ID</p>
                        <p className="font-display text-xl font-bold text-primary">{order.order_id}</p>
                      </div>
                      {order.status === 'delivered' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={generateInvoice}
                          disabled={generatingInvoice}
                          className="flex items-center gap-2"
                        >
                          {generatingInvoice ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                          Invoice
                        </Button>
                      )}
                    </div>
                    {order.status !== 'delivered' && (
                      <p className="text-xs text-amber-400/80 mt-2">
                        Invoice will be available once your order is delivered.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Order Date</p>
                    <p className="font-medium">
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Cancelled Status */}
                {order.status === 'cancelled' ? (
                  <div className="flex items-center justify-center gap-3 py-6 bg-destructive/10 rounded-lg">
                    <XCircle className="w-8 h-8 text-destructive" />
                    <span className="font-display text-xl text-destructive font-semibold">Order Cancelled</span>
                  </div>
                ) : (
                  <>
                  {/* Enhanced Progress Steps - Always Vertical */}
                  <div className="relative">
                    <div className="flex justify-center relative">
                      <div className="flex flex-col items-center space-y-6">
                        {statusSteps.map((step, index) => {
                          const Icon = step.icon;
                          const isActive = index <= currentStep;
                          const isCurrent = index === currentStep;
                          
                          // Define specific colors for each step
                          const stepColors = [
                            { bg: 'from-blue-400 to-blue-600', border: 'border-blue-500', text: 'text-blue-700', bgInactive: 'from-gray-300 to-gray-400', borderInactive: 'border-gray-400' },
                            { bg: 'from-indigo-400 to-indigo-600', border: 'border-indigo-500', text: 'text-indigo-700', bgInactive: 'from-gray-300 to-gray-400', borderInactive: 'border-gray-400' },
                            { bg: 'from-amber-400 to-amber-600', border: 'border-amber-500', text: 'text-amber-700', bgInactive: 'from-gray-300 to-gray-400', borderInactive: 'border-gray-400' },
                            { bg: 'from-orange-400 to-orange-600', border: 'border-orange-500', text: 'text-orange-700', bgInactive: 'from-gray-300 to-gray-400', borderInactive: 'border-gray-400' },
                            { bg: 'from-emerald-400 to-emerald-600', border: 'border-emerald-500', text: 'text-emerald-700', bgInactive: 'from-gray-300 to-gray-400', borderInactive: 'border-gray-400' },
                          ];
                          
                          const currentStepColors = stepColors[index] || stepColors[0];
                          
                          return (
                            <div key={step.key} className="flex flex-col items-center relative z-10">
                              <div className={cn(
                                "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 relative z-10 shadow-lg",
                                isCurrent 
                                  ? `bg-gradient-to-br ${currentStepColors.bg} ${currentStepColors.border} text-white scale-110 shadow-amber-200/50` 
                                  : isActive
                                    ? `bg-gradient-to-br ${currentStepColors.bg} ${currentStepColors.border} text-white`
                                    : `bg-gradient-to-br ${currentStepColors.bgInactive} ${currentStepColors.borderInactive} text-gray-500`
                              )}>
                                <Icon className={cn(
                                  "w-5 h-5 md:w-6 md:h-6 transition-all duration-300",
                                  isCurrent ? "scale-110" : ""
                                )} />
                                {isCurrent && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-white flex items-center justify-center border-2 border-white">
                                    <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-current animate-pulse"></div>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 text-center">
                                <p className={cn(
                                  "text-xs md:text-sm font-medium transition-colors duration-300",
                                  isCurrent 
                                    ? `${currentStepColors.text} font-bold` 
                                    : isActive
                                      ? currentStepColors.text
                                      : "text-gray-500"
                                )}>
                                  {step.label}
                                </p>
                                {isCurrent && (
                                  <div className="mt-1 w-2 h-2 rounded-full bg-current mx-auto animate-pulse"></div>
                                )}
                              </div>
                              
                              {/* Vertical Progress Line between steps */}
                              {index < statusSteps.length - 1 && (
                                <div className="absolute top-full left-1/2 h-4 -translate-x-1/2 w-0.5 bg-gray-200">
                                  <div 
                                    className="w-full bg-gradient-to-b from-emerald-400 via-amber-400 to-amber-500 rounded-full"
                                    style={{ height: `${currentStep > index ? '100%' : '0%'}` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Horizontal Progress Line for Desktop - REMOVED to keep vertical on all devices */}
                  </div>
                  </>
                )}
              </div>

              {/* Product Details & Delivery Info */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-card rounded-xl border border-border/50 p-6">
                  <h3 className="font-display text-lg font-semibold mb-4">Delivery Address</h3>
                  <p className="font-medium">{order.customer_name}</p>
                  <p className="text-muted-foreground">{order.customer_phone}</p>
                  <p className="text-muted-foreground mt-2">{order.customer_address}</p>
                  
                  {(order.customer_state || order.customer_pincode) && (
                    <p className="text-muted-foreground mt-1">
                      {order.customer_state}{order.customer_state && order.customer_pincode && ', '} {order.customer_pincode}
                    </p>
                  )}
                  
                  {(order.customer_landmark1 || order.customer_landmark2 || order.customer_landmark3) && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-muted-foreground">Landmarks:</p>
                      {order.customer_landmark1 && (
                        <p className="text-muted-foreground">• {order.customer_landmark1}</p>
                      )}
                      {order.customer_landmark2 && (
                        <p className="text-muted-foreground">• {order.customer_landmark2}</p>
                      )}
                      {order.customer_landmark3 && (
                        <p className="text-muted-foreground">• {order.customer_landmark3}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-6">
                  <h3 className="font-display text-lg font-semibold mb-4">Order Summary</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {orderItems.map((item) => {
                      const product = products[item.product_id];
                      const imageUrl = product?.images?.[0] || product?.image_url;
                      return (
                        <div key={item.id} className="flex gap-3 pb-3 border-b border-border/50 last:border-0">
                          {imageUrl && (
                            <img 
                              src={imageUrl} 
                              alt={item.product_name}
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product_name}</p>
                            {product?.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                            )}
                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              ₹{(item.product_price * item.quantity).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ₹{item.product_price.toFixed(2)} each
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex justify-between font-display font-bold text-lg">
                      <span>Total:</span>
                      <span>₹{Number(order.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Section - Only Admin Messages */}
              <div className="bg-card rounded-xl border border-border/50 p-6 mb-8">
                <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Messages from Store
                </h3>
                
                <div className="min-h-[120px] max-h-48 overflow-y-auto space-y-3 bg-muted/30 rounded-lg p-4">
                  {messages.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">No messages from store yet</p>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-[90%] px-4 py-2 rounded-2xl text-sm bg-primary/10 text-foreground rounded-bl-md">
                          <p>{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!order && !isLoading && (
            <div className="text-center py-12 bg-card/50 rounded-xl border border-border/50 animate-fade-in stagger-2">
              <Crown className="w-16 h-16 text-primary/30 mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold text-muted-foreground mb-2">
                {searchType === 'order-id' 
                  ? 'Enter your Order ID above' 
                  : 'Enter your phone number above'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {searchType === 'order-id' 
                  ? "You'll find your Order ID in your order confirmation" 
                  : "Use the phone number you used when placing the order (without +91)"}
              </p>
            </div>
          )}


        </div>
      </div>
    </Layout>
    </div>
  );
}
