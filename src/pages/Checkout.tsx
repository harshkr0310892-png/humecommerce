import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCartStore } from "@/store/cartStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Loader2, CheckCircle, Copy, Ticket, X } from "lucide-react";
import { cn, normalizeIndianMobile } from "@/lib/utils";
import { FAQSection } from "@/components/checkout/FAQSection";

function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RYL-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getClientIP(): Promise<string> {
  try {
    // Try multiple services to get IP address
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || '';
  } catch (error) {
    console.error('Error getting client IP:', error);
    return '';
  }
}

interface AppliedCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  id: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, getDiscountedTotal, clearCart, removeItem, updateItem, updateQuantity } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [agreePolicies, setAgreePolicies] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [clientIP, setClientIP] = useState<string>('');
  const [variantImages, setVariantImages] = useState<Record<string, string[]>>({});

  const variantIds = useMemo(() => {
    const ids = items
      .map((i) => (i as any)?.variant_info?.variant_id as string | undefined)
      .filter(Boolean) as string[];
    return Array.from(new Set(ids));
  }, [items]);

  const productIds = useMemo(() => {
    const ids = items
      .map((i) => (i as any)?.product_id || (typeof i.id === "string" ? i.id.split("#")[0] : null))
      .filter(Boolean) as string[];
    return Array.from(new Set(ids));
  }, [items]);

  useEffect(() => {
    if (productIds.length === 0) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,stock_status,stock_quantity")
        .in("id", productIds);
      if (!active) return;
      if (error) return;
      const found = new Set((data || []).map((p: any) => p.id));
      const unavailable = new Set<string>();
      productIds.forEach((pid) => {
        if (!found.has(pid)) unavailable.add(pid);
      });
      (data || []).forEach((p: any) => {
        const s = (p.stock_status || "").toString().toLowerCase();
        if (["deleted", "inactive", "unavailable"].includes(s)) unavailable.add(p.id);
      });
      const toRemove = items.filter((it: any) => {
        const pid = (it.product_id || it.id.split("#")[0]) as string;
        if (unavailable.has(pid)) return true;
        const productRow = (data || []).find((p: any) => p.id === pid);
        const status = (productRow?.stock_status || "").toString().toLowerCase();
        if (status === "sold_out" && !it?.variant_info?.variant_id) return true;
        return false;
      });
      if (toRemove.length > 0) {
        toRemove.forEach((it: any) => removeItem(it.id));
        toast.error("Some cart items were removed because the product is unavailable.");
      }

      const productMap = new Map<string, any>((data || []).map((p: any) => [p.id, p]));
      items.forEach((it: any) => {
        if (it?.variant_info?.variant_id) return;
        const productId = (it.product_id || it.id.split("#")[0]) as string;
        const p = productMap.get(productId);
        if (!p) return;
        const stockQty = p.stock_quantity === null || p.stock_quantity === undefined ? null : Number(p.stock_quantity);
        updateItem(it.id, { stock_quantity: stockQty });
        if (stockQty !== null && Number(it.quantity || 0) > stockQty) {
          updateQuantity(it.id, Math.max(0, stockQty));
        }
      });

      const insufficient = items.filter((it: any) => {
        const productId = (it.product_id || it.id.split("#")[0]) as string;
        const p = productMap.get(productId);
        if (!p) return false;
        if (it?.variant_info?.variant_id) return false;
        const stockQty = p.stock_quantity === null || p.stock_quantity === undefined ? null : Number(p.stock_quantity);
        if (stockQty === null) return false;
        return stockQty < Number(it.quantity || 0) || stockQty <= 0;
      });
      if (insufficient.length > 0) {
        insufficient.forEach((it: any) => removeItem(it.id));
        toast.error("You're too late — some items are now out of stock.");
      }
    })();
    return () => {
      active = false;
    };
  }, [items, productIds, removeItem, updateItem, updateQuantity]);

  useEffect(() => {
    if (variantIds.length === 0) {
      setVariantImages({});
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("product_variants" as any)
        .select("id,image_urls,is_available,stock_quantity")
        .in("id", variantIds);
      if (!active) return;
      if (error) return;
      const variants = (data as any[]) || [];
      const map: Record<string, string[]> = {};
      const found = new Set(variants.map((v: any) => v.id));
      variants.forEach((v: any) => {
        map[v.id] = Array.isArray(v.image_urls) ? v.image_urls : [];
      });
      setVariantImages(map);

      const removedLines = items.filter((it: any) => {
        const vid = it?.variant_info?.variant_id;
        if (!vid) return false;
        if (!found.has(vid)) return true;
        const v = variants.find((x: any) => x.id === vid);
        if (v && v.is_available === false) return true;
        const stockQty = v?.stock_quantity === null || v?.stock_quantity === undefined ? null : Number(v.stock_quantity);
        if (stockQty !== null && (stockQty <= 0 || stockQty < Number(it.quantity || 0))) return true;
        return false;
      });
      if (removedLines.length > 0) {
        removedLines.forEach((it: any) => removeItem(it.id));
        toast.error("You're too late — some options are now out of stock.");
      }

      const variantMap = new Map<string, any>(variants.map((v: any) => [v.id, v]));
      items.forEach((it: any) => {
        const vid = it?.variant_info?.variant_id as string | undefined;
        if (!vid) return;
        const v = variantMap.get(vid);
        if (!v) return;
        const stockQty = v.stock_quantity === null || v.stock_quantity === undefined ? null : Number(v.stock_quantity);
        updateItem(it.id, { stock_quantity: stockQty });
        if (stockQty !== null && Number(it.quantity || 0) > stockQty) {
          updateQuantity(it.id, Math.max(0, stockQty));
        }
      });
    })();
    return () => {
      active = false;
    };
  }, [items, removeItem, updateItem, updateQuantity, variantIds]);

  // 3-step checkout
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    pincode: '',
    landmark1: '',
    landmark2: '',
    landmark3: '',
  });

  const [stateSearch, setStateSearch] = useState('');

  const subtotal = getDiscountedTotal();
  
  // Calculate GST
  const [gstAmount, setGstAmount] = React.useState(0);
  
  React.useEffect(() => {
    const calculateGST = async () => {
      let totalGST = 0;
      
      for (const item of items) {
        try {
          const productId = item.product_id || item.id;
          
          // Fetch product with GST info - GST applies to all variants of this product
          const { data: product, error } = await supabase
            .from('products')
            .select('gst_percentage, category_id')
            .eq('id', productId)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching product for GST:', error);
            continue;
          }
          
          if (!product) {
            console.warn('Product not found for GST calculation:', productId);
            continue;
          }
          
          let gstPercent = 0;
          
          // Product GST takes priority
          if (product.gst_percentage !== null && product.gst_percentage !== undefined && product.gst_percentage > 0) {
            gstPercent = product.gst_percentage;
            console.log(`Product ${productId} GST: ${gstPercent}%`);
          }
          // Fall back to category GST
          else if (product.category_id) {
            const { data: category, error: catError } = await supabase
              .from('categories')
              .select('gst_percentage')
              .eq('id', product.category_id)
              .maybeSingle();
            
            if (!catError && category && category.gst_percentage && category.gst_percentage > 0) {
              gstPercent = category.gst_percentage;
              console.log(`Category GST for ${productId}: ${gstPercent}%`);
            }
          }
          
          // Calculate price with discount
          const discountedPrice = item.price * (1 - item.discount_percentage / 100);
          const itemTotal = discountedPrice * item.quantity;
          
          // Calculate GST on discounted price
          const itemGST = itemTotal * (gstPercent / 100);
          totalGST += itemGST;
          console.log(`Item ${item.name}: Price=${item.price}, Discount=${item.discount_percentage}%, Discounted=${discountedPrice}, Qty=${item.quantity}, GST%=${gstPercent}, ItemGST=${itemGST}`);
        } catch (error) {
          console.error('Error calculating GST for item:', item.id, error);
        }
      }
      
      console.log('Total GST Amount:', totalGST);
      setGstAmount(totalGST);
    };
    
    if (items.length > 0) {
      calculateGST();
    } else {
      setGstAmount(0);
    }
  }, [items]);
    
    // Get client IP on component mount
    React.useEffect(() => {
      const fetchIP = async () => {
        const ip = await getClientIP();
        setClientIP(ip);
      };
      fetchIP();
    }, []);
    
    // Load customer profile if authenticated
    React.useEffect(() => {
      const loadCustomerProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // If customer is logged in, try to load their profile to pre-fill form
          const { data: profile, error } = await supabase
            .from('customer_profiles')
            .select('full_name, phone, address, user_id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (!error && profile) {
            setFormData(prev => ({
              ...prev,
              name: profile.full_name || prev.name,
              phone: profile.phone || prev.phone,
              address: profile.address || prev.address,
              email: session.user.email || prev.email,
            }));
          }
        }
      };
      
      loadCustomerProfile();
    }, []);
  
  // Calculate coupon discount
  const calculateCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discount_type === 'percentage') {
      return subtotal * (appliedCoupon.discount_value / 100);
    }
    return Math.min(appliedCoupon.discount_value, subtotal);
  };

  const couponDiscount = calculateCouponDiscount();
  const subtotalAfterCoupon = subtotal - couponDiscount;

  // Calculate shipping charge based on order subtotal
  const shippingCharge = subtotal < 300 ? 40 : 0;

  const total = subtotalAfterCoupon + gstAmount + shippingCharge;

  const validateDeliveryStep = () => {
    if (!formData.name || !formData.phone || !formData.address) {
      toast.error('Please fill in all required fields');
      return false;
    }

    const normalizedPhone = normalizeIndianMobile(formData.phone);
    if (!normalizedPhone) {
      toast.error('Please enter a valid Indian mobile number');
      return false;
    }

    return true;
  };

  const validateAddressStep = () => {
    if (!formData.state || !formData.pincode) {
      toast.error('Please select a state and enter a pin code');
      return false;
    }

    // Validate pincode format (6 digits)
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    if (!pincodeRegex.test(formData.pincode)) {
      toast.error('Please enter a valid 6-digit pin code');
      return false;
    }

    return true;
  };

  const getIndianStates = () => [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli',
    'Daman and Diu',
    'Delhi',
    'Lakshadweep',
    'Puducherry',
    'Jammu and Kashmir',
    'Ladakh',
  ];

  const goToPaymentStep = () => {
    if (!validateDeliveryStep()) return;
    setCheckoutStep(2);
  };

  const goToAddressStep = () => {
    if (!validateAddressStep()) return;
    setCheckoutStep(3);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    setApplyingCoupon(true);
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!coupon) {
        toast.error('Invalid coupon code');
        return;
      }

      // Check expiry
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        toast.error('This coupon has expired');
        return;
      }

      // Check max uses
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        toast.error('This coupon has reached its usage limit');
        return;
      }

      // Check minimum order amount
      if (coupon.min_order_amount && subtotal < Number(coupon.min_order_amount)) {
        toast.error(`Minimum order amount is ₹${coupon.min_order_amount}`);
        return;
      }

      setAppliedCoupon({
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
      });
      toast.success('Coupon applied successfully!');
    } catch (error) {
      console.error('Error applying coupon:', error);
      toast.error('Failed to apply coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.success('Coupon removed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure all steps are completed before placing order
    if (checkoutStep === 1) {
      if (validateDeliveryStep()) setCheckoutStep(2);
      return;
    } else if (checkoutStep === 2) {
      if (validateAddressStep()) setCheckoutStep(3);
      return;
    }

    if (!formData.name || !formData.phone || !formData.address || !formData.state || !formData.pincode) {
      toast.error('Please fill in all required fields');
      return;
    }

    const normalizedPhone = normalizeIndianMobile(formData.phone);
    if (!normalizedPhone) {
      toast.error('Please enter a valid Indian mobile number');
      return;
    }

    // Check if user is banned
    try {
      // Normalize phone number for comparison
      const formattedPhone = `+91${normalizedPhone}`;
      
      console.log('Checking ban status for:', { 
        phone: formData.phone, 
        normalizedPhone, 
        formattedPhone,
        email: formData.email 
      });
      
      // Check if phone number is banned (try multiple formats)
      const { data: bannedByPhone, error: phoneError } = await supabase
        .from('banned_users')
        .select('*')
        .or(`phone.eq.${formattedPhone},phone.eq.${normalizedPhone}`)
        .eq('is_active', true)
        .maybeSingle();

      if (phoneError) {
        console.error('Error checking banned phone:', phoneError);
      } else {
        console.log('Phone ban check result:', bannedByPhone);
      }

      // Check if email is banned (if provided)
      let bannedByEmail = null;
      if (formData.email) {
        const { data, error: emailError } = await supabase
          .from('banned_users')
          .select('*')
          .eq('email', formData.email.toLowerCase())
          .eq('is_active', true)
          .maybeSingle();

        if (emailError) {
          console.error('Error checking banned email:', emailError);
        } else {
          bannedByEmail = data;
          console.log('Email ban check result:', bannedByEmail);
        }
      }

      // If user is banned, show error and prevent order
      if (bannedByPhone || bannedByEmail) {
        console.log('User is banned, preventing order');
        toast.error('Unable to place order. Please contact support for assistance.');
        return;
      }
      
      console.log('User is not banned, proceeding with order');
    } catch (error) {
      console.error('Error checking banned users:', error);
      toast.error('An error occurred while processing your order. Please try again.');
      return;
    }

    if (!agreePolicies) {
      toast.error('Please agree to the FAQs and Privacy Policy before placing your order.');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    // Ensure COD is eligible for all items when selected
    const codEligible = items.every((it) => it.cash_on_delivery === true);
    if (paymentMethod === 'cod' && !codEligible) {
      toast.error('Cash on Delivery is not available for some items in your cart.');
      return;
    }

    const validateStockBeforeOrder = async () => {
      const productIds = Array.from(
        new Set(
          items
            .map((i: any) => i.product_id || (typeof i.id === "string" ? i.id.split("#")[0] : null))
            .filter(Boolean) as string[]
        )
      );
      const variantIds = Array.from(
        new Set(
          items
            .map((i: any) => i?.variant_info?.variant_id)
            .filter(Boolean) as string[]
        )
      );

      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id,stock_status,stock_quantity")
          .in("id", productIds);
        if (productsError) throw productsError;
        const found = new Set((productsData || []).map((p: any) => p.id));
        const unavailable = new Set<string>();
        productIds.forEach((pid) => {
          if (!found.has(pid)) unavailable.add(pid);
        });
        (productsData || []).forEach((p: any) => {
          const s = (p.stock_status || "").toString().toLowerCase();
          if (["deleted", "inactive", "unavailable"].includes(s)) unavailable.add(p.id);
        });
        const toRemove = items.filter((it: any) => {
          const pid = (it.product_id || it.id.split("#")[0]) as string;
          if (unavailable.has(pid)) return true;
          const productRow = (productsData || []).find((p: any) => p.id === pid);
          const status = (productRow?.stock_status || "").toString().toLowerCase();
          if (status === "sold_out" && !it?.variant_info?.variant_id) return true;
          return false;
        });
        if (toRemove.length > 0) {
          toRemove.forEach((it: any) => removeItem(it.id));
          toast.error("Some cart items are unavailable and were removed.");
          return false;
        }

        const productMap = new Map<string, any>((productsData || []).map((p: any) => [p.id, p]));
        const insufficient = items.filter((it: any) => {
          const productId = (it.product_id || it.id.split("#")[0]) as string;
          const p = productMap.get(productId);
          if (!p) return false;
          if (it?.variant_info?.variant_id) return false;
          const stockQty = p.stock_quantity === null || p.stock_quantity === undefined ? null : Number(p.stock_quantity);
          if (stockQty === null) return false;
          return stockQty <= 0 || stockQty < Number(it.quantity || 0);
        });
        if (insufficient.length > 0) {
          insufficient.forEach((it: any) => removeItem(it.id));
          toast.error("You're too late — some items are now out of stock.");
          return false;
        }
      }

      if (variantIds.length > 0) {
        const { data: variantsData, error: variantsError } = await supabase
          .from("product_variants" as any)
          .select("id,is_available,stock_quantity")
          .in("id", variantIds);
        if (variantsError) throw variantsError;
        const variants = (variantsData as any[]) || [];
        const found = new Set(variants.map((v: any) => v.id));
        const invalid = items.filter((it: any) => {
          const vid = it?.variant_info?.variant_id;
          if (!vid) return false;
          if (!found.has(vid)) return true;
          const v = variants.find((x: any) => x.id === vid);
          if (v && v.is_available === false) return true;
          const stockQty = v?.stock_quantity === null || v?.stock_quantity === undefined ? null : Number(v.stock_quantity);
          if (stockQty !== null && (stockQty <= 0 || stockQty < Number(it.quantity || 0))) return true;
          return false;
        });
        if (invalid.length > 0) {
          invalid.forEach((it: any) => removeItem(it.id));
          toast.error("You're too late — some options are now out of stock.");
          return false;
        }
      }

      return true;
    };

    try {
      const ok = await validateStockBeforeOrder();
      if (!ok) return;
    } catch {
      toast.error("Unable to verify stock right now. Please try again.");
      return;
    }

    // Check individual phone restrictions first
    try {
      const formattedPhone = `+91${normalizedPhone}`;
      
      // Check for individual phone restrictions
      const { data: individualRestrictions, error: individualError } = await supabase
        .from('individual_phone_restrictions')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('is_active', true)
        .maybeSingle();
      
      if (individualError) throw individualError;
      
      // If individual restrictions exist, check them
      if (individualRestrictions) {
        const today = new Date().toISOString().split('T')[0];
        
        // Check payment method specific limits
        if (paymentMethod === 'cod') {
          // Check individual COD limit
          const { data: codOrderCounts, error: codCountError } = await supabase
            .from('individual_phone_order_counts')
            .select('order_count')
            .eq('phone', formattedPhone)
            .eq('payment_method', 'cod')
            .eq('last_order_date', today)
            .maybeSingle();
          
          if (codCountError) throw codCountError;
          
          const currentCount = codOrderCounts?.order_count || 0;
          if (currentCount >= individualRestrictions.cod_daily_limit) {
            toast.error(`You have reached your daily limit of ${individualRestrictions.cod_daily_limit} COD orders.`);
            return;
          }
        } else if (paymentMethod === 'online') {
          // Check individual online payment limit
          const { data: onlineOrderCounts, error: onlineCountError } = await supabase
            .from('individual_phone_order_counts')
            .select('order_count')
            .eq('phone', formattedPhone)
            .eq('payment_method', 'online')
            .eq('last_order_date', today)
            .maybeSingle();
          
          if (onlineCountError) throw onlineCountError;
          
          const currentCount = onlineOrderCounts?.order_count || 0;
          if (currentCount >= individualRestrictions.online_daily_limit) {
            toast.error(`You have reached your daily limit of ${individualRestrictions.online_daily_limit} online payment orders.`);
            return;
          }
        }
      } else {
        // Check global restrictions if no individual restrictions exist
        const { data: codRestrictions, error: restrictionsError } = await supabase
          .from('cod_restrictions')
          .select('*')
          .limit(1);

        if (restrictionsError) throw restrictionsError;

        // If restrictions are enabled, check limits
        if (codRestrictions && codRestrictions.length > 0) {
          const restriction = codRestrictions[0];
          
          if (paymentMethod === 'cod' && restriction.cod_restrictions_enabled) {
            // Check phone number order limit for COD
            const { data: phoneOrderCounts, error: phoneCountError } = await supabase
              .from('phone_order_counts')
              .select('order_count')
              .eq('phone', formattedPhone);
            
            if (phoneCountError) throw phoneCountError;
            
            if (phoneOrderCounts && phoneOrderCounts.length > 0 && 
                phoneOrderCounts[0].order_count >= restriction.phone_order_limit) {
              toast.error(`You have reached the maximum limit of ${restriction.phone_order_limit} COD orders with this phone number.`);
              return;
            }
            
            // Check IP address daily order limit for COD
            if (clientIP) {
              const today = new Date().toISOString().split('T')[0];
              const { data: ipOrderCounts, error: ipCountError } = await supabase
                .from('ip_order_counts')
                .select('order_count')
                .eq('ip_address', clientIP)
                .eq('last_order_date', today);
              
              if (ipCountError) throw ipCountError;
              
              if (ipOrderCounts && ipOrderCounts.length > 0 && 
                  ipOrderCounts[0].order_count >= restriction.ip_daily_order_limit) {
                toast.error(`You have reached the maximum limit of ${restriction.ip_daily_order_limit} COD orders from this IP address today.`);
                return;
              }
            }
          } else if (paymentMethod === 'online' && restriction.online_restrictions_enabled) {
            // Check phone number order limit for online payment
            const { data: onlinePhoneOrderCounts, error: onlinePhoneCountError } = await supabase
              .from('online_phone_order_counts')
              .select('order_count')
              .eq('phone', formattedPhone);
            
            if (onlinePhoneCountError) throw onlinePhoneCountError;
            
            if (onlinePhoneOrderCounts && onlinePhoneOrderCounts.length > 0 && 
                onlinePhoneOrderCounts[0].order_count >= restriction.online_phone_order_limit) {
              toast.error(`You have reached the maximum limit of ${restriction.online_phone_order_limit} online payment orders with this phone number.`);
              return;
            }
            
            // Check IP address daily order limit for online payment
            if (clientIP) {
              const today = new Date().toISOString().split('T')[0];
              const { data: onlineIpOrderCounts, error: onlineIpCountError } = await supabase
                .from('online_ip_order_counts')
                .select('order_count')
                .eq('ip_address', clientIP)
                .eq('last_order_date', today);
              
              if (onlineIpCountError) throw onlineIpCountError;
              
              if (onlineIpOrderCounts && onlineIpOrderCounts.length > 0 && 
                  onlineIpOrderCounts[0].order_count >= restriction.online_ip_daily_order_limit) {
                toast.error(`You have reached the maximum limit of ${restriction.online_ip_daily_order_limit} online payment orders from this IP address today.`);
                return;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking individual phone restrictions:', error);
      // Don't block the order if there's an error checking restrictions
      // This ensures customers can still place orders even if our restriction system has issues
    }

    setIsLoading(true);

    try {
      const newOrderId = generateOrderId();

      // Get current user session to get user_id if authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_id: newOrderId,
          customer_name: formData.name,
          customer_phone: `+91${normalizedPhone}`,
          customer_email: formData.email || null,
          customer_address: formData.address,
          customer_state: formData.state,
          customer_pincode: formData.pincode,
          customer_landmark1: formData.landmark1,
          customer_landmark2: formData.landmark2,
          customer_landmark3: formData.landmark3,
          total: total,
          status: 'pending',
          payment_method: paymentMethod,
          user_id: session?.user?.id || null, // Link order to authenticated user
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Update order counts based on individual or global restrictions
      try {
        const formattedPhone = `+91${normalizedPhone}`;
        const today = new Date().toISOString().split('T')[0];
        
        // Check for individual phone restrictions
        const { data: individualRestrictions, error: individualError } = await supabase
          .from('individual_phone_restrictions')
          .select('*')
          .eq('phone', formattedPhone)
          .eq('is_active', true)
          .maybeSingle();
        
        if (individualError) {
          console.error('Error checking individual phone restrictions:', individualError);
        }
        
        if (individualRestrictions) {
          // Update individual phone order count
          const { data: individualCountData, error: individualCountError } = await supabase
            .from('individual_phone_order_counts')
            .select('*')
            .eq('phone', formattedPhone)
            .eq('payment_method', paymentMethod)
            .eq('last_order_date', today)
            .maybeSingle();
          
          if (individualCountError) {
            console.error('Error checking individual phone order count:', individualCountError);
          } else if (individualCountData) {
            // Update existing record
            await supabase
              .from('individual_phone_order_counts')
              .update({ 
                order_count: individualCountData.order_count + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', individualCountData.id);
          } else {
            // Insert new record
            await supabase
              .from('individual_phone_order_counts')
              .insert({
                phone: formattedPhone,
                payment_method: paymentMethod,
                order_count: 1,
                last_order_date: today
              });
          }
        } else {
          // Update global order counts based on payment method
          if (paymentMethod === 'cod') {
            // Update global phone order count for COD orders
            const { data: phoneCountData, error: phoneCountError } = await supabase
              .from('phone_order_counts')
              .select('*')
              .eq('phone', formattedPhone)
              .maybeSingle();
            
            if (phoneCountError) {
              console.error('Error checking phone order count:', phoneCountError);
            } else if (phoneCountData) {
              // Update existing record
              await supabase
                .from('phone_order_counts')
                .update({ 
                  order_count: phoneCountData.order_count + 1,
                  updated_at: new Date().toISOString()
                })
                .eq('id', phoneCountData.id);
            } else {
              // Insert new record
              await supabase
                .from('phone_order_counts')
                .insert({
                  phone: formattedPhone,
                  order_count: 1,
                  last_order_date: today
                });
            }
            
            // Update IP order count for COD orders
            if (clientIP) {
              const { data: ipCountData, error: ipCountError } = await supabase
                .from('ip_order_counts')
                .select('*')
                .eq('ip_address', clientIP)
                .eq('last_order_date', today)
                .maybeSingle();
              
              if (ipCountError) {
                console.error('Error checking IP order count:', ipCountError);
              } else if (ipCountData) {
                // Update existing record
                await supabase
                  .from('ip_order_counts')
                  .update({ 
                    order_count: ipCountData.order_count + 1,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', ipCountData.id);
              } else {
                // Insert new record
                await supabase
                  .from('ip_order_counts')
                  .insert({
                    ip_address: clientIP,
                    order_count: 1,
                    last_order_date: today
                  });
              }
            }
          } else if (paymentMethod === 'online') {
            // Update global phone order count for online payment orders
            const { data: onlinePhoneCountData, error: onlinePhoneCountError } = await supabase
              .from('online_phone_order_counts')
              .select('*')
              .eq('phone', formattedPhone)
              .maybeSingle();
            
            if (onlinePhoneCountError) {
              console.error('Error checking online phone order count:', onlinePhoneCountError);
            } else if (onlinePhoneCountData) {
              // Update existing record
              await supabase
                .from('online_phone_order_counts')
                .update({ 
                  order_count: onlinePhoneCountData.order_count + 1,
                  updated_at: new Date().toISOString()
                })
                .eq('id', onlinePhoneCountData.id);
            } else {
              // Insert new record
              await supabase
                .from('online_phone_order_counts')
                .insert({
                  phone: formattedPhone,
                  order_count: 1,
                  last_order_date: today
                });
            }
            
            // Update IP order count for online payment orders
            if (clientIP) {
              const { data: onlineIpCountData, error: onlineIpCountError } = await supabase
                .from('online_ip_order_counts')
                .select('*')
                .eq('ip_address', clientIP)
                .eq('last_order_date', today)
                .maybeSingle();
              
              if (onlineIpCountError) {
                console.error('Error checking online IP order count:', onlineIpCountError);
              } else if (onlineIpCountData) {
                // Update existing record
                await supabase
                  .from('online_ip_order_counts')
                  .update({ 
                    order_count: onlineIpCountData.order_count + 1,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', onlineIpCountData.id);
              } else {
                // Insert new record
                await supabase
                  .from('online_ip_order_counts')
                  .insert({
                    ip_address: clientIP,
                    order_count: 1,
                    last_order_date: today
                  });
              }
            }
          }
        }
      } catch (countError) {
        console.error('Error updating order counts:', countError);
        // Don't block the order if there's an error updating counts
      }

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: (item as any).product_id || item.id,
        product_name: item.name,
        product_price: item.price * (1 - item.discount_percentage / 100),
        quantity: item.quantity,
        variant_info: item.variant_info
          ? {
              variant_id: (item.variant_info as any).variant_id || null,
              attribute_name: (item.variant_info as any).attribute_name || (item.variant_info as any).attribute || null,
              value_name: (item.variant_info as any).value_name || (item.variant_info as any).attribute_value || null,
            }
          : null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Update coupon used_count if coupon was applied
      if (appliedCoupon) {
        const { data: couponData } = await supabase
          .from('coupons')
          .select('used_count')
          .eq('id', appliedCoupon.id)
          .single();
        
        if (couponData) {
          await supabase
            .from('coupons')
            .update({ used_count: (couponData.used_count || 0) + 1 })
            .eq('id', appliedCoupon.id);
        }
      }

      setOrderId(newOrderId);
      setOrderComplete(true);
      clearCart();
      
      // Send order notification to Telegram
      try {
        const orderNotification = {
          id: newOrderId,
          customer_name: formData.name,
          customer_email: formData.email || 'N/A',
          customer_phone: `+91${normalizedPhone}`,
          items: items.map(item => ({
            product_name: item.name,
            variant: item.variant_info ? `${item.variant_info.attribute_name}: ${item.variant_info.attribute_value}` : 'N/A',
            quantity: item.quantity,
            price: item.price * (1 - item.discount_percentage / 100),
          })),
          total_amount: total,
          order_date: new Date().toISOString(),
          shipping_address: `${formData.address}, ${formData.state} - ${formData.pincode}`,
          status: 'pending',
        };
        
        console.log('Attempting to send order notification:', orderNotification);
        
        // Send full order details to Telegram bot
        let orderDetails = `📦 *NEW ORDER* 📦\n\n`;
        orderDetails += `*Order ID:* ${orderNotification.id}\n`;
        orderDetails += `*Customer Name:* ${orderNotification.customer_name}\n`;
        orderDetails += `*Email:* ${orderNotification.customer_email}\n`;
        orderDetails += `*Phone:* ${orderNotification.customer_phone}\n`;
        orderDetails += `*Payment Method:* ${paymentMethod}\n`;
        orderDetails += `*Shipping Address:* ${orderNotification.shipping_address}\n`;
        orderDetails += `*Landmark 1:* ${formData.landmark1 || 'N/A'}\n`;
        orderDetails += `*Landmark 2:* ${formData.landmark2 || 'N/A'}\n`;
        orderDetails += `*Landmark 3:* ${formData.landmark3 || 'N/A'}\n`;
        orderDetails += `*State:* ${formData.state}\n`;
        orderDetails += `*Pin Code:* ${formData.pincode}\n\n`;
        
        orderDetails += `*ORDERED ITEMS:*\n`;
        orderNotification.items.forEach((item, index) => {
          orderDetails += `${index + 1}. *${item.product_name}*\n`;
          orderDetails += `   Variant: ${item.variant}\n`;
          orderDetails += `   Quantity: ${item.quantity}\n`;
          orderDetails += `   Price: ₹${item.price}\n\n`;
        });
        
        orderDetails += `*Total Amount:* ₹${orderNotification.total_amount}\n`;
        orderDetails += `*Order Date:* ${new Date(orderNotification.order_date).toLocaleString()}\n`;
        orderDetails += `*Status:* ${orderNotification.status}\n`;
        
        const telegramUrl = `https://api.telegram.org/bot${import.meta.env.VITE_TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${import.meta.env.VITE_TELEGRAM_CHAT_ID}&text=${encodeURIComponent(orderDetails)}&parse_mode=Markdown`;
        
        const response = await fetch(telegramUrl);
        const result = await response.json();
        
        console.log('Telegram test result:', result);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          console.error('Failed to send Telegram notification:', result);
          toast.error('Failed to send notification to Telegram');
        } else {
          console.log('Telegram notification sent successfully');
          toast.success('Order notification sent to Telegram!');
        }
      } catch (notificationError) {
        console.error('Error sending Telegram notification:', notificationError);
        toast.error('Error sending notification to Telegram');
      }
      
      toast.success('Order placed successfully!');
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyOrderId = () => {
    navigator.clipboard.writeText(orderId);
    toast.success('Order ID copied to clipboard!');
  };

  if (orderComplete) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center checkout-order-complete-container">
          <div className="max-w-md mx-auto animate-fade-in">
            <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center mx-auto mb-4 checkout-order-complete-icon">
              <CheckCircle className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-2 checkout-order-complete-title">
              Order Confirmed!
            </h1>
            <p className="text-muted-foreground mb-4 checkout-order-complete-desc">
              Thank you for your order. Your order has been placed successfully.
            </p>

            <div className="bg-card rounded-xl border border-border/50 p-4 mb-4 checkout-order-complete-id-container">
              <p className="text-xs text-muted-foreground mb-1">Your Order ID</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-display text-lg font-bold text-primary checkout-order-complete-id">
                  {orderId}
                </span>
                <button
                  onClick={copyOrderId}
                  className="p-1 hover:bg-muted rounded-lg transition-colors checkout-order-complete-id-copy"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 checkout-order-complete-id-text">
                Save this ID to track your order status.
              </p>
            </div>

            <div className="flex flex-col gap-3 checkout-order-complete-buttons">
              <Button
                variant="royal"
                size="lg"
                onClick={() => navigate('/track-order')}
              >
                Track Your Order
              </Button>
              <Button
                variant="royalOutline"
                size="lg"
                onClick={() => navigate('/products')}
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center checkout-empty-container">
          <Crown className="w-16 h-16 text-primary/30 mx-auto mb-2 checkout-empty-icon" />
          <h1 className="font-display text-xl font-bold mb-2 checkout-empty-title">Your Cart is Empty</h1>
          <p className="text-muted-foreground mb-4 checkout-empty-desc">
            Add some products to your cart before checkout.
          </p>
          <Button variant="royal" onClick={() => navigate('/products')} className="checkout-empty-btn">
            Browse Products
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12 checkout-container">
        <h1 className="font-display text-xl sm:text-2xl md:text-4xl font-bold mb-3 sm:mb-4 checkout-title">
          <span className="gradient-gold-text">Checkout</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 xl:gap-8 checkout-grid">
          {/* Form - shown first on desktop, last on mobile */}
          <div className="order-last lg:order-first">
            <div className="bg-card rounded-xl border border-border/50 p-3 sm:p-4 md:p-6 sticky top-4 md:top-24 checkout-summary-container">
              <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold mb-3 md:mb-4 checkout-summary-header">
                Order Summary
              </h2>
              
              <div className="space-y-3 max-h-64 overflow-y-auto checkout-summary-items">
                {items.map((item) => {
                  const discountedPrice = item.price * (1 - item.discount_percentage / 100);
                  const variantId = (item as any)?.variant_info?.variant_id as string | undefined;
                  const variantImage = variantId ? variantImages[variantId]?.[0] : undefined;
                  const imageUrl = variantImage || item.image_url;
                  const maxQty = (item as any).stock_quantity ?? null;
                  return (
                    <div key={item.id} className="flex gap-2 md:gap-3 checkout-summary-item">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 checkout-summary-item-image">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Crown className="w-4 h-4 md:w-6 md:h-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 checkout-summary-item-details">
                        <p className="font-medium line-clamp-1 text-xs sm:text-sm md:text-base checkout-summary-item-name">{item.name}</p>
                        {(item as any)?.variant_info?.attribute_name && (
                          <p className="text-xs text-muted-foreground">
                            {(item as any).variant_info.attribute_name}:{" "}
                            {((item as any).variant_info.value_name ?? (item as any).variant_info.attribute_value) as any}
                          </p>
                        )}
                        {maxQty !== null && maxQty !== undefined && (
                          <p className="text-[11px] text-muted-foreground">
                            Available: {Number(maxQty)}
                          </p>
                        )}
                        <p className="text-xs sm:text-sm text-muted-foreground checkout-summary-item-qty">
                          Qty: {item.quantity} × ₹{discountedPrice.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold text-xs sm:text-sm md:text-base checkout-summary-item-price">
                        ₹{(discountedPrice * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Coupon Section */}
              <div className="border-t border-border mt-4 md:mt-6 pt-4 md:pt-6 checkout-coupon-section">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Ticket className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Have a coupon?</span>
                </div>
                
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                    <div>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({appliedCoupon.discount_type === 'percentage' 
                          ? `${appliedCoupon.discount_value}% off` 
                          : `₹${appliedCoupon.discount_value} off`})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="p-1 hover:bg-background rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1 sm:gap-2 checkout-coupon-input">
                    <Input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="flex-1 uppercase checkout-coupon-input-field"
                    />
                    <Button
                      type="button"
                      variant="royalOutline"
                      onClick={handleApplyCoupon}
                      disabled={applyingCoupon}
                      className="checkout-coupon-apply-btn"
                    >
                      {applyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-border mt-3 md:mt-6 pt-3 md:pt-6 space-y-2 md:space-y-3 checkout-price-breakdown">
                <div className="flex justify-between text-muted-foreground text-xs sm:text-sm md:text-base checkout-price-item">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {appliedCoupon && couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 text-xs sm:text-sm md:text-base checkout-price-item">
                    <span>Coupon Discount</span>
                    <span>-₹{couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                {gstAmount > 0 && (
                  <div className="flex justify-between text-orange-600 dark:text-orange-400 text-xs sm:text-sm md:text-base checkout-price-item">
                    <span>GST</span>
                    <span>+₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground text-xs sm:text-sm md:text-base checkout-price-item">
                  <span>Shipping</span>
                  <span>{shippingCharge > 0 ? `+₹${shippingCharge.toFixed(2)}` : 'FREE'}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-border">
                  <span className="font-display text-xs sm:text-base md:text-lg font-semibold checkout-price-item">Total</span>
                  <span className="font-display text-lg sm:text-xl md:text-2xl font-bold text-primary checkout-price-total">
                    ₹{total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form - shown second on mobile */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-6 animate-fade-in checkout-form">
            {/* Stepper */}
            <div className="bg-card rounded-xl border border-border/50 p-2 sm:p-3 md:p-4 checkout-stepper">
              <div className="flex items-center justify-between gap-1 sm:gap-2 md:gap-4">
                <button
                  type="button"
                  onClick={() => setCheckoutStep(1)}
                  className={cn(
                    'flex-1 text-left rounded-lg px-1 sm:px-2 md:px-3 py-2 transition-colors checkout-step',
                    checkoutStep === 1 ? 'bg-muted font-semibold' : 'hover:bg-muted/60'
                  )}
                >
                  <div className="text-xs md:text-xs text-muted-foreground checkout-step-number">Step 1</div>
                  <div className="font-display text-sm md:text-base checkout-step-title">Delivery Information</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutStep === 1) {
                      if (validateDeliveryStep()) setCheckoutStep(2);
                    } else if (checkoutStep === 3) {
                      setCheckoutStep(2);
                    }
                  }}
                  className={cn(
                    'flex-1 text-left rounded-lg px-1 sm:px-2 md:px-3 py-2 transition-colors checkout-step',
                    checkoutStep === 2 ? 'bg-muted font-semibold' : 'hover:bg-muted/60'
                  )}
                >
                  <div className="text-xs md:text-xs text-muted-foreground checkout-step-number">Step 2</div>
                  <div className="font-display text-sm md:text-base checkout-step-title">Address Details</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutStep === 2) {
                      if (validateAddressStep()) setCheckoutStep(3);
                    } else if (checkoutStep === 1) {
                      if (validateDeliveryStep()) setCheckoutStep(2);
                    }
                  }}
                  className={cn(
                    'flex-1 text-left rounded-lg px-1 sm:px-2 md:px-3 py-2 transition-colors checkout-step',
                    checkoutStep === 3 ? 'bg-muted font-semibold' : 'hover:bg-muted/60'
                  )}
                >
                  <div className="text-xs md:text-xs text-muted-foreground checkout-step-number">Step 3</div>
                  <div className="font-display text-sm md:text-base checkout-step-title">Payment</div>
                </button>
              </div>
            </div>

            {/* Step 1: Delivery */}
            {checkoutStep === 1 && (
              <div className="bg-card rounded-xl border border-border/50 p-3 sm:p-4 md:p-6 animate-in fade-in slide-in-from-left-2 duration-300 checkout-step-content">
                <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold mb-3 md:mb-4 checkout-step-header">
                  Delivery Information
                </h2>

                <div className="space-y-2 sm:space-y-3 checkout-form-group">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter your full name"
                      required
                      className="mt-1 checkout-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g., 9876543210 (10 digits, starting with 6-9)"
                      required
                      className="mt-1 checkout-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter your email address"
                      className="mt-1 checkout-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Delivery Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter your complete delivery address"
                      required
                      className="mt-1 checkout-textarea"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-3 md:mt-6 flex gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="royal"
                    size="lg"
                    className="w-full checkout-continue-btn"
                    onClick={goToPaymentStep}
                  >
                    Continue to Address Details
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Address Details */}
            {checkoutStep === 2 && (
              <div className="bg-card rounded-xl border border-border/50 p-3 sm:p-4 md:p-6 animate-in fade-in slide-in-from-right-2 duration-300 checkout-step-content">
                <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold mb-3 md:mb-4 checkout-step-header">
                  Address Details
                </h2>

                <div className="space-y-2 sm:space-y-3 checkout-form-group">
                  <div>
                    <Label htmlFor="state">Select State *</Label>
                    <div className="relative">
                      <Input
                        id="state"
                        value={stateSearch}
                        onChange={(e) => setStateSearch(e.target.value)}
                        placeholder="Search for a state"
                        required
                        className="w-full checkout-input"
                        onFocus={() => setStateSearch(formData.state)}
                      />
                      {stateSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                          {getIndianStates().filter(state => 
                            state.toLowerCase().includes(stateSearch.toLowerCase())
                          ).map(state => (
                            <div
                              key={state}
                              className="p-2 hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setFormData({ ...formData, state });
                                setStateSearch(state);
                              }}
                            >
                              {state}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="hidden"
                      value={formData.state}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="pincode">Pin Code *</Label>
                    <Input
                      id="pincode"
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="Enter 6-digit pin code"
                      required
                      className="mt-1 checkout-input"
                      maxLength={6}
                    />
                  </div>

                  <div>
                    <Label htmlFor="landmark1">Landmark 1 (Optional)</Label>
                    <Input
                      id="landmark1"
                      value={formData.landmark1}
                      onChange={(e) => setFormData({ ...formData, landmark1: e.target.value })}
                      placeholder="Enter first landmark"
                      className="mt-1 checkout-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="landmark2">Landmark 2 (Optional)</Label>
                    <Input
                      id="landmark2"
                      value={formData.landmark2}
                      onChange={(e) => setFormData({ ...formData, landmark2: e.target.value })}
                      placeholder="Enter second landmark"
                      className="mt-1 checkout-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="landmark3">Landmark 3 (Optional)</Label>
                    <Input
                      id="landmark3"
                      value={formData.landmark3}
                      onChange={(e) => setFormData({ ...formData, landmark3: e.target.value })}
                      placeholder="Enter third landmark"
                      className="mt-1 checkout-input"
                    />
                  </div>
                </div>

                <div className="mt-3 md:mt-6 flex gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="royalOutline"
                    size="lg"
                    className="w-full checkout-back-btn"
                    onClick={() => setCheckoutStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="royal"
                    size="lg"
                    className="w-full checkout-continue-btn"
                    onClick={goToAddressStep}
                  >
                    Continue to Payment
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {checkoutStep === 3 && (
              <>
                <div className="bg-card rounded-xl border border-border/50 p-3 sm:p-4 md:p-6 animate-in fade-in slide-in-from-right-2 duration-300 checkout-payment-content">
                  <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold mb-3 md:mb-4 checkout-payment-header">Payment</h2>

                  {/* Delivery summary */}
                  <div className="mb-3 md:mb-6 rounded-lg border border-border/50 p-2 sm:p-3 md:p-4 bg-muted/20 checkout-delivery-summary">
                    <div className="flex items-center justify-between gap-1 sm:gap-2 md:gap-3 checkout-delivery-info">
                      <div>
                        <div className="text-xs sm:text-sm font-medium">Deliver to</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          {formData.name} • {formData.phone}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">
                          {formData.address}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          {formData.state}, {formData.pincode}
                        </div>
                        {formData.landmark1 && (
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            Landmarks: {formData.landmark1}{formData.landmark2 ? `, ${formData.landmark2}` : ''}{formData.landmark3 ? `, ${formData.landmark3}` : ''}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="royalOutline"
                        size="sm"
                        onClick={() => setCheckoutStep(2)}
                        className="checkout-delivery-edit-btn"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <h3 className="font-medium mb-3">Payment Method</h3>
                    <div className="flex flex-col gap-2 checkout-payment-methods">
                      <label className="flex items-center gap-2 md:gap-3 checkout-payment-method">
                        <input
                          type="radio"
                          name="payment"
                          value="online"
                          checked={paymentMethod === 'online'}
                          onChange={() => setPaymentMethod('online')}
                          className="accent-primary"
                        />
                        <span className="text-sm md:text-base">Online Payment (Available for all products)</span>
                      </label>
                      <label className="flex items-center gap-2 md:gap-3 checkout-payment-method">
                        <input
                          type="radio"
                          name="payment"
                          value="cod"
                          checked={paymentMethod === 'cod'}
                          onChange={() => setPaymentMethod('cod')}
                          disabled={!items.every((it) => it.cash_on_delivery === true)}
                          className="accent-primary"
                        />
                        <span className="text-sm md:text-base">Cash on Delivery (Only for eligible products)</span>
                      </label>
                      {!items.every((it) => it.cash_on_delivery === true) && (
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Cash on Delivery is not available for some items in your cart.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3 bg-muted/30 border border-border/50 rounded-xl p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Checkbox
                    id="agree"
                    checked={agreePolicies}
                    onCheckedChange={(checked) => setAgreePolicies(Boolean(checked))}
                    className="mt-1"
                  />
                  <Label htmlFor="agree" className="text-xs sm:text-sm leading-5 sm:leading-6 cursor-pointer">
                    I agree to the{' '}
                    <Link to="/faq" className="text-primary underline">
                      FAQs
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary underline">
                      Privacy Policy
                    </Link>
                    .
                  </Label>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Button
                    type="button"
                    variant="royalOutline"
                    size="xl"
                    className="w-full sm:w-1/2"
                    onClick={() => setCheckoutStep(1)}
                    disabled={isLoading}
                  >
                    Back
                  </Button>

                  <Button
                    type="submit"
                    variant="royal"
                    size="xl"
                    className="w-full sm:w-1/2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <Crown className="w-5 h-5 mr-2" />
                        Place Order - ₹{total.toFixed(2)}
                      </>
                    )}
                  </Button>
                </div>

                {/* FAQ Section */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-4">
                  <FAQSection />
                </div>
              </>
            )}
          </form>

        </div>
      </div>
    </Layout>
  );
}
