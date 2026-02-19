import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Crown, Home, Loader2, User, Phone, MapPin, Package, 
  Clock, CheckCircle, Truck, XCircle, LogOut, Camera,
  Edit2, Save, X, ChevronDown, ChevronUp, Sparkles, Shield, Star, Heart, Copy, StopCircle, Menu, PanelLeftClose, PanelLeftOpen, Mic, MicOff, Volume2, VolumeX, FileText
} from "lucide-react";
import { generateInvoice } from "@/utils/invoiceGenerator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn, normalizeIndianMobile } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBanCheck } from "@/hooks/useBanCheck";

// Royal Premium Styles
const royalStyles = `
  /* Royal Premium Color Variables */
  :root {
    --royal-gold: linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%);
    --royal-purple: linear-gradient(135deg, #4A0E4E 0%, #2D0A31 50%, #1A0620 100%);
    --royal-burgundy: linear-gradient(135deg, #af313fff 0%, #4A1C20 100%);
    --royal-navy: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    --premium-shadow: 0 10px 40px rgba(212, 175, 55, 0.15);
    --glass-bg: rgba(26, 26, 46, 0.85);
    --gold-glow: 0 0 30px rgba(212, 175, 55, 0.3);
  }

  /* Royal Card Styling */
  .royal-card {
    background: linear-gradient(145deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
    border: 1px solid rgba(212, 175, 55, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(212, 175, 55, 0.1);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
  }

  .royal-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #D4AF37, transparent);
  }

  /* Premium Avatar Ring */
  .avatar-ring {
    background: linear-gradient(135deg, #D4AF37 0%, #FFD700 25%, #D4AF37 50%, #FFD700 75%, #D4AF37 100%);
    padding: 4px;
    border-radius: 50%;
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  /* Royal Button Styles */
  .royal-btn {
    background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%);
    color: #1a1a2e;
    font-weight: 600;
    border: none;
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .royal-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
    background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%);
  }

  .royal-btn-outline {
    background: transparent;
    border: 2px solid rgba(212, 175, 55, 0.5);
    color: #D4AF37;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .royal-btn-outline:hover {
    background: rgba(212, 175, 55, 0.1);
    border-color: #D4AF37;
    box-shadow: 0 0 20px rgba(212, 175, 55, 0.2);
  }

  /* Navigation Tab Styles */
  .nav-tab {
    background: rgba(26, 26, 46, 0.6);
    border: 1px solid rgba(212, 175, 55, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .nav-tab::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: #D4AF37;
    transform: scaleY(0);
    transition: transform 0.3s ease;
  }

  .nav-tab:hover {
    background: rgba(212, 175, 55, 0.08);
    border-color: rgba(212, 175, 55, 0.3);
  }

  .nav-tab.active {
    background: linear-gradient(90deg, rgba(212, 175, 55, 0.15) 0%, transparent 100%);
    border-color: rgba(212, 175, 55, 0.4);
  }

  .nav-tab.active::after {
    transform: scaleY(1);
  }

  /* Order Card Styles */
  .order-card {
    background: linear-gradient(145deg, rgba(30, 30, 50, 0.9) 0%, rgba(20, 25, 40, 0.9) 100%);
    border: 1px solid rgba(212, 175, 55, 0.15);
    transition: all 0.3s ease;
    position: relative;
  }

  .order-card:hover {
    border-color: rgba(212, 175, 55, 0.4);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(212, 175, 55, 0.1);
    transform: translateY(-2px);
  }

  .order-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.4), transparent);
  }

  /* Status Badge Styles */
  .status-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .status-pending {
    background: linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 152, 0, 0.2) 100%);
    border: 1px solid rgba(255, 193, 7, 0.4);
    color: #FFC107;
  }

  .status-confirmed {
    background: linear-gradient(135deg, rgba(33, 150, 243, 0.2) 0%, rgba(3, 169, 244, 0.2) 100%);
    border: 1px solid rgba(33, 150, 243, 0.4);
    color: #42A5F5;
  }

  .status-processing {
    background: linear-gradient(135deg, rgba(156, 39, 176, 0.2) 0%, rgba(142, 36, 170, 0.2) 100%);
    border: 1px solid rgba(156, 39, 176, 0.4);
    color: #BA68C8;
  }

  .status-shipped {
    background: linear-gradient(135deg, rgba(63, 81, 181, 0.2) 0%, rgba(48, 63, 159, 0.2) 100%);
    border: 1px solid rgba(63, 81, 181, 0.4);
    color: #7986CB;
  }

  .status-delivered {
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.2) 0%, rgba(56, 142, 60, 0.2) 100%);
    border: 1px solid rgba(76, 175, 80, 0.4);
    color: #66BB6A;
  }

  .status-cancelled {
    background: linear-gradient(135deg, rgba(244, 67, 54, 0.2) 0%, rgba(211, 47, 47, 0.2) 100%);
    border: 1px solid rgba(244, 67, 54, 0.4);
    color: #EF5350;
  }

  /* Premium Input Styles */
  .royal-input {
    background: rgba(26, 26, 46, 0.8);
    border: 1px solid rgba(212, 175, 55, 0.2);
    color: #f0f0f0;
    transition: all 0.3s ease;
  }

  .royal-input:focus {
    border-color: #D4AF37;
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15);
    outline: none;
  }

  .royal-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* Section Header Styles */
  .section-header {
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, transparent 100%);
    border-left: 3px solid #D4AF37;
    padding: 12px 20px;
    margin-bottom: 24px;
  }

  .section-header h2 {
    background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Premium Scrollbar */
  .royal-scrollbar {
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #B8860B rgba(26, 26, 46, 0.5);
  }

  .royal-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .royal-scrollbar::-webkit-scrollbar-track {
    background: rgba(26, 26, 46, 0.5);
    border-radius: 3px;
  }

  .royal-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #D4AF37 0%, #B8860B 100%);
    border-radius: 3px;
  }

  /* Chatbot Styles */
  .chat-message-user {
    background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%);
    color: #1a1a2e;
  }

  .chat-message-bot {
    background: rgba(45, 45, 70, 0.9);
    border: 1px solid rgba(212, 175, 55, 0.2);
    color: #ffffff;
  }

  .chat-message-user .markdown-content,
  .chat-message-user .markdown-content * {
    color: #1a1a2e !important;
  }

  .chat-message-bot .markdown-content,
  .chat-message-bot .markdown-content * {
    color: #ffffff !important;
  }

  /* Loading Animation */
  .royal-spinner {
    border: 3px solid rgba(212, 175, 55, 0.2);
    border-top-color: #D4AF37;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Decorative Crown Pattern */
  .crown-pattern {
    position: absolute;
    top: 20px;
    right: 20px;
    opacity: 0.05;
    font-size: 120px;
    pointer-events: none;
  }

  /* Premium Gradient Text */
  .gold-text {
    background: linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Empty State Styling */
  .empty-state {
    background: radial-gradient(circle at center, rgba(212, 175, 55, 0.05) 0%, transparent 70%);
  }

  /* Floating Animation */
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  .float-animation {
    animation: float 3s ease-in-out infinite;
  }

  /* Premium Badge */
  .premium-badge {
    background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%);
    color: #1a1a2e;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    box-shadow: 0 2px 10px rgba(212, 175, 55, 0.3);
  }

  /* Order Amount Display */
  .order-amount {
    font-family: 'Georgia', serif;
    font-size: 1.5rem;
    background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
  }

  /* Dialog Premium Styling */
  .royal-dialog {
    background: linear-gradient(145deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%);
    border: 1px solid rgba(212, 175, 55, 0.3);
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(212, 175, 55, 0.1);
  }

  /* Markdown Content Styles */
  .markdown-content {
    color: #ffffff;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .markdown-content table {
    width: 100%;
    min-width: 520px;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.9rem;
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .markdown-content th {
    background: rgba(212, 175, 55, 0.1);
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  }
  
  .markdown-content td {
    padding: 12px;
    border-bottom: 1px solid rgba(212, 175, 55, 0.1);
    color: #ffffff;
  }
  
  .markdown-content tr:last-child td {
    border-bottom: none;
  }
  
  .markdown-content p {
    margin-bottom: 0.75rem;
  }
  
  .markdown-content p:last-child {
    margin-bottom: 0;
  }
  
  .markdown-content ul, .markdown-content ol {
    margin-left: 1.5rem;
    margin-bottom: 0.75rem;
  }
  
  .markdown-content li {
    margin-bottom: 0.25rem;
  }
  
  .markdown-content strong {
    color: #ffffff;
    font-weight: 600;
  }
  
  .markdown-content a {
    color: #ffffff;
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .markdown-content table {
      min-width: 440px;
      margin: 0.75rem 0;
    }

    .markdown-content th,
    .markdown-content td {
      padding: 8px;
      font-size: 0.85rem;
    }
  }
`;

interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  address: string | null;
  avatar_url: string | null;
}

interface Order {
  id: string;
  order_id: string;
  user_id?: string | null;
  customer_email?: string | null;
  status: string;
  total: number;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  return_status?: string | null;
  return_reason?: string | null;
  return_request_date?: string | null;
  return_processed_date?: string | null;
  return_refund_amount?: number | null;
  updated_at?: string;
  items?: {
    product_name: string;
    quantity: number;
    product_price: number;
    product_id?: string | null;
    variant_info?: unknown;
    product_image?: string;
    variant_text?: string | null;
  }[];
  messages?: {
    id: string;
    message: string;
    created_at: string;
    is_admin: boolean;
  }[];
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; className: string }> = {
  pending: { icon: <Clock className="w-4 h-4" />, color: "text-yellow-500", label: "Pending", className: "status-pending" },
  confirmed: { icon: <CheckCircle className="w-4 h-4" />, color: "text-blue-500", label: "Confirmed", className: "status-confirmed" },
  processing: { icon: <Package className="w-4 h-4" />, color: "text-purple-500", label: "Processing", className: "status-processing" },
  shipped: { icon: <Truck className="w-4 h-4" />, color: "text-indigo-500", label: "Shipped", className: "status-shipped" },
  delivered: { icon: <CheckCircle className="w-4 h-4" />, color: "text-green-500", label: "Delivered", className: "status-delivered" },
  cancelled: { icon: <XCircle className="w-4 h-4" />, color: "text-red-500", label: "Cancelled", className: "status-cancelled" },
};

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { isBanned } = useBanCheck();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiAvatarOpen, setAiAvatarOpen] = useState(false);
  const [aiAvatarPrompt, setAiAvatarPrompt] = useState("");
  const [aiAvatarLoading, setAiAvatarLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'returns' | 'chatbot'>('orders');
  const [cancelOrderId, setCancelOrderId] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancellingReturns, setCancellingReturns] = useState<Record<string, boolean>>({});
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    address: '',
  });
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);
  const [phoneOtpStep, setPhoneOtpStep] = useState<"request" | "verify">("request");
  const [nextPhoneResendAt, setNextPhoneResendAt] = useState<number | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const copyOrderId = async (orderId: string) => {
    const value = orderId.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Order ID copied');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) toast.success('Order ID copied');
        else toast.error('Failed to copy');
      } catch {
        toast.error('Failed to copy');
      }
    }
  };

  const openPhoneVerify = () => {
    setPhoneOtp("");
    setPhoneOtpStep("request");
    setNextPhoneResendAt(null);
    setPhoneVerifyOpen(true);
  };

  const requestPhoneOtp = async (action: "request" | "resend") => {
    if (action === "resend" && nextPhoneResendAt && Date.now() < nextPhoneResendAt) {
      toast.error("Please wait before resending OTP.");
      return;
    }

    const normalized = normalizeIndianMobile(editForm.phone || profile?.phone || "");
    if (!normalized) {
      toast.error("Please enter a valid Indian mobile number.");
      return;
    }

    setPhoneOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-otp", {
        body: { action, phone: `+91${normalized}` },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPhoneOtpStep("verify");
      setNextPhoneResendAt(Date.now() + 30_000);
      toast.success("OTP sent on your phone.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send OTP");
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  const verifyPhoneOtp = async () => {
    const normalized = normalizeIndianMobile(editForm.phone || profile?.phone || "");
    if (!normalized) {
      toast.error("Please enter a valid Indian mobile number.");
      return;
    }
    if (!/^\d{6}$/.test(phoneOtp.trim())) {
      toast.error("Please enter 6 digit OTP.");
      return;
    }

    setPhoneOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-otp", {
        body: { action: "verify", phone: `+91${normalized}`, otp: phoneOtp.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (uid) await loadProfile(uid);

      setPhoneVerifyOpen(false);
      setPhoneOtp("");
      setPhoneOtpStep("request");
      toast.success("Phone verified successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to verify OTP");
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    setUserEmail(session.user.email || '');
    await Promise.all([
      loadProfile(session.user.id),
      loadOrders(session.user.id, session.user.email || ''),
      loadReturns(session.user.id),
    ]);
    setLoading(false);
  };

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }

    if (data) {
      setProfile(data);
      setEditForm({
        full_name: data.full_name || '',
        phone: data.phone || '',
        address: data.address || '',
      });
    } else {
      console.log('No profile found, creating new profile');
      try {
        const { data: newProfile, error: insertError } = await supabase
          .from('customer_profiles')
          .insert({
            user_id: userId,
            full_name: null,
            phone: null,
            address: null,
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        if (newProfile) {
          setProfile(newProfile);
          setEditForm({
            full_name: newProfile.full_name || '',
            phone: newProfile.phone || '',
            address: newProfile.address || '',
          });
        }
      } catch (error) {
        console.error('Error creating profile:', error);
      }
    }
  };

  const loadOrders = async (userId: string, email: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(`user_id.eq.${userId},customer_email.eq.${email}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading orders:', error);
      return;
    }

    const getVariantInfo = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return null;
      const obj = raw as Record<string, unknown>;
      const variant_id = typeof obj.variant_id === 'string' ? obj.variant_id : null;
      const attribute_name = typeof obj.attribute_name === 'string' ? obj.attribute_name : null;
      const value_name = typeof obj.value_name === 'string' ? obj.value_name : null;
      const attribute_value = typeof obj.attribute_value === 'string' ? obj.attribute_value : null;
      const attribute = typeof obj.attribute === 'string' ? obj.attribute : null;
      return { variant_id, attribute_name, value_name, attribute_value, attribute };
    };

    const getVariantText = (raw: unknown) => {
      const vi = getVariantInfo(raw);
      if (!vi) return null;
      const name = vi.attribute_name || vi.attribute;
      const value = vi.value_name || vi.attribute_value;
      if (!name || !value) return null;
      return `${name}: ${value}`;
    };

    const getFirstImageUrl = (raw: unknown): string | null => {
      if (!raw) return null;
      if (Array.isArray(raw)) {
        const url = raw.find((x) => typeof x === 'string' && x.trim().length > 0);
        return typeof url === 'string' ? url : null;
      }
      return null;
    };

    const ordersWithDetails = await Promise.all(
      (data || []).map(async (order) => {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_name, quantity, product_price, product_id, variant_info')
          .eq('order_id', order.id);

        const productIds = Array.from(
          new Set((items || []).map((i) => i.product_id).filter((id) => typeof id === 'string' && id.length > 0))
        ) as string[];

        const variantIds = Array.from(
          new Set(
            (items || [])
              .map((i) => getVariantInfo((i as { variant_info?: unknown }).variant_info)?.variant_id)
              .filter((id): id is string => typeof id === 'string' && id.length > 0)
          )
        );

        const [productsResp, variantsResp] = await Promise.all([
          productIds.length > 0
            ? supabase.from('products').select('id, image_url, images').in('id', productIds)
            : Promise.resolve({ data: [], error: null } as unknown as { data: Array<{ id: string; image_url: string | null; images: unknown }>; error: any }),
          variantIds.length > 0
            ? (supabase.from('product_variants' as any) as any).select('id, image_urls').in('id', variantIds)
            : Promise.resolve({ data: [], error: null } as unknown as { data: Array<{ id: string; image_urls: unknown }>; error: any }),
        ]);

        const productsMap = new Map<string, { image_url: string | null; images: unknown }>();
        (productsResp.data || []).forEach((p) => {
          const row = p as unknown as { id?: unknown; image_url?: unknown; images?: unknown };
          if (typeof row.id !== 'string' || row.id.length === 0) return;
          productsMap.set(row.id, {
            image_url: typeof row.image_url === 'string' ? row.image_url : null,
            images: row.images,
          });
        });

        const variantImageMap = new Map<string, string>();
        (variantsResp.data || []).forEach((v) => {
          const row = v as unknown as { id?: unknown; image_urls?: unknown };
          if (typeof row.id !== 'string' || row.id.length === 0) return;
          const first = getFirstImageUrl(row.image_urls);
          if (first) variantImageMap.set(row.id, first);
        });

        const itemsWithImages = (items || []).map((item) => {
          const vi = getVariantInfo((item as { variant_info?: unknown }).variant_info);
          const variantImage = vi?.variant_id ? variantImageMap.get(vi.variant_id) : null;
          const productEntry = typeof item.product_id === 'string' ? productsMap.get(item.product_id) : undefined;
          const productFallback = productEntry?.image_url || getFirstImageUrl(productEntry?.images);
          return {
            ...item,
            product_image: variantImage || productFallback || undefined,
            variant_text: getVariantText((item as { variant_info?: unknown }).variant_info),
          };
        });
        
        const { data: messages } = await supabase
          .from('order_messages')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });
        
        return { 
          ...order, 
          items: itemsWithImages,
          messages: messages || []
        };
      })
    );

    setOrders(ordersWithDetails);
  };

  const loadReturns = async (userId: string) => {
    try {
      const { data: userOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userId);

      if (ordersError) throw ordersError;

      const orderIds = userOrders.map(order => order.id);
      
      if (orderIds.length === 0) {
        setReturns([]);
        return;
      }
      
      const { data: returnsData, error } = await supabase
        .from('returns')
        .select('*')
        .in('order_id', orderIds)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      const visibleReturns = (returnsData || []).filter((ret) => ret.return_status !== 'cancelled');
      setReturns(visibleReturns);
    } catch (error) {
      console.error('Error loading returns:', error);
      setReturns([]);
    }
  };

  const handleCancelReturn = async (ret: any) => {
    if (!ret?.id || ret.return_status !== 'requested') return;
    setCancellingReturns(prev => ({ ...prev, [ret.id]: true }));
    try {
      const { error: updateError } = await supabase
        .from('returns')
        .update({ return_status: 'cancelled' })
        .eq('id', ret.id)
        .eq('return_status', 'requested');

      if (updateError) throw updateError;

      await supabase
        .from('orders')
        .update({
          return_status: null,
          return_reason: null,
          return_request_date: null,
          return_processed_date: null,
          return_refund_amount: null
        })
        .eq('id', ret.order_id);

      setReturns(prev => prev.filter((item) => item.id !== ret.id));
      setOrders(prev =>
        prev.map(order =>
          order.id === ret.order_id
            ? {
                ...order,
                return_status: null,
                return_reason: null,
                return_request_date: null,
                return_processed_date: null,
                return_refund_amount: null
              }
            : order
        )
      );
      toast.success('Return request cancelled');
    } catch (error) {
      console.error('Error cancelling return:', error);
      toast.error('Failed to cancel return');
    } finally {
      setCancellingReturns(prev => ({ ...prev, [ret.id]: false }));
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cancelling) return;

    const orderId = cancelOrderId.trim().toUpperCase();
    if (!orderId) {
      toast.error('Please enter your order ID');
      return;
    }

    setCancelling(true);
    try {
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!orderData) {
        toast.error('Order not found');
        return;
      }

      const orderOwnerMismatch = orderData.user_id && profile?.user_id && orderData.user_id !== profile.user_id;
      const orderEmailMismatch = orderData.customer_email && userEmail && orderData.customer_email !== userEmail;
      if (orderOwnerMismatch && orderEmailMismatch) {
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

      await supabase
        .from('order_messages')
        .insert({
          order_id: orderData.id,
          message: 'Customer cancelled the order.',
          is_admin: false,
        });

      setOrders(prev =>
        prev.map(order =>
          order.order_id === orderId ? { ...order, status: 'cancelled' } : order
        )
      );
      toast.success('Order cancelled successfully');
      setCancelOrderId('');
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('customer_profiles')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
          address: editForm.address,
        })
        .eq('id', profile.id);

      if (error) throw error;

      const phoneChanged = (profile.phone ?? "") !== editForm.phone;
      setProfile({ ...profile, ...editForm, phone_verified_at: phoneChanged ? null : profile.phone_verified_at });
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleAvatarUpload called');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You must be logged in to upload a photo');
      navigate('/auth');
      return;
    }
    
    if (!e.target.files || !e.target.files[0]) {
      toast.error('Please select an image file');
      return;
    }
    
    if (!profile) {
      toast.error('Profile not loaded. Please wait and try again.');
      return;
    }

    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }
    
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
      toast.error('Only JPG, PNG, GIF, and WebP files are allowed');
      return;
    }
    
    const fileName = `${profile.user_id}.${fileExt}`;

    setUploading(true);
    try {
      try {
        await supabase.storage
          .from('customer-avatars')
          .remove([fileName]);
      } catch (removeError) {
        console.log('No existing file to remove or remove failed:', removeError);
      }
      
      const { data, error: uploadError } = await supabase.storage
        .from('customer-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('customer-avatars')
        .getPublicUrl(fileName, { transform: null });
      
      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate public URL');
      }

      const { error: updateError } = await supabase
        .from('customer_profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: urlData.publicUrl });
      toast.success('Profile photo updated!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('customer_user_id');
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleGenerateAiAvatar = async () => {
    if (aiAvatarLoading) return;

    const prompt = aiAvatarPrompt.trim();
    if (prompt.length < 3) {
      toast.error('Please describe your avatar (at least 3 characters)');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You must be logged in to generate an avatar');
      navigate('/auth');
      return;
    }

    if (!profile) {
      toast.error('Profile not loaded. Please wait and try again.');
      return;
    }

    setAiAvatarLoading(true);
    try {
      const resp = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to generate avatar');
      }

      const svg = data?.svg;
      if (typeof svg !== 'string' || svg.trim().length < 10) {
        throw new Error('Invalid avatar received');
      }

      const fileName = `${profile.user_id}.svg`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });

      const { error: uploadError } = await supabase.storage
        .from('customer-avatars')
        .upload(fileName, blob, {
          upsert: true,
          contentType: 'image/svg+xml',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('customer-avatars')
        .getPublicUrl(fileName, { transform: null });

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate avatar URL');
      }

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('customer_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success('AI avatar updated!');
      setAiAvatarOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to generate avatar');
    } finally {
      setAiAvatarLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <style>{royalStyles}</style>
        <div 
          className="min-h-screen flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
          }}
        >
          <div className="text-center">
            <div className="w-16 h-16 royal-spinner mx-auto mb-4"></div>
            <p className="gold-text text-lg font-medium">Loading your royal experience...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{royalStyles}</style>
      <div 
        className="min-h-screen py-12"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
        }}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            
            {/* Profile Header Card */}
            <div 
              className="royal-card rounded-2xl p-8 mb-8 animate-fade-in relative"
              style={{ overflow: 'visible' }}
            >
              {/* Decorative Crown */}
              <div className="crown-pattern">
                <Crown className="w-32 h-32" />
              </div>
              
              {/* Premium Member Badge */}
              <div className="absolute -top-3 left-8">
                <span className="premium-badge">
                  <Crown className="w-3 h-3" /> Premium Member
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-8 relative z-10">
                {/* Avatar with Gold Ring */}
                <div className="relative group">
                  <div className="avatar-ring">
                    <div 
                      className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center"
                      style={{ background: 'linear-gradient(145deg, #1a1a2e 0%, #2a2a4e 100%)' }}
                    >
                      {profile?.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                            if (fallback) {
                              (fallback as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : (
                        <User className="w-12 h-12 text-amber-400/50" />
                      )}
                      <div 
                        className="avatar-fallback hidden w-full h-full items-center justify-center"
                        style={{ display: 'none' }}
                      >
                        <User className="w-12 h-12 text-amber-400/50" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Camera Upload Overlay */}
                  <label 
                    className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                  >
                    {uploading ? (
                      <div className="w-8 h-8 royal-spinner"></div>
                    ) : (
                      <Camera className="w-8 h-8 text-amber-400" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <h1 
                    className="font-display text-3xl font-bold mb-2"
                    style={{
                      background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {profile?.full_name || 'Royal Customer'}
                  </h1>
                  <p className="text-gray-400 mb-2">{userEmail}</p>
                  {profile?.phone && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-400 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-amber-400/60" /> {profile.phone}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <Shield className="w-3.5 h-3.5 text-amber-400/60" />
                        <span className={profile.phone_verified_at ? "text-green-400" : "text-red-400"}>
                          {profile.phone_verified_at ? "Phone Verified" : "Phone Not Verified"}
                        </span>
                        {!profile.phone_verified_at && (
                          <button
                            type="button"
                            className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                            onClick={openPhoneVerify}
                          >
                            Verify Now
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {profile?.address && (
                    <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-amber-400/60" /> {profile.address}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  {isEditing ? (
                    <>
                      <button
                        className="royal-btn-outline px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                        onClick={() => setIsEditing(false)}
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                      <button
                        className="royal-btn px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                        onClick={handleSaveProfile}
                        disabled={saving}
                      >
                        {saving ? (
                          <div className="w-4 h-4 royal-spinner"></div>
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="royal-btn-outline px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit2 className="w-4 h-4" /> Edit Profile
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-amber-400 border border-amber-400/30 hover:bg-amber-400/10 transition-all"
                        onClick={() => navigate('/')}
                      >
                        <Home className="w-4 h-4" /> Back Home
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-all"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </>
                  )}
                </div>
              </div>

              <Dialog open={phoneVerifyOpen} onOpenChange={setPhoneVerifyOpen}>
                <DialogContent className="royal-dialog border-amber-400/30">
                  <DialogHeader>
                    <DialogTitle className="gold-text text-xl flex items-center gap-2">
                      <Shield className="w-5 h-5 text-amber-400" /> Verify Phone Number
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      OTP sirf Indian number (+91) par jayega. OTP 10 minute ke liye valid rahega.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone_verify_phone" className="text-amber-400/80">Phone Number</Label>
                      <Input
                        id="phone_verify_phone"
                        value={editForm.phone}
                        onChange={(e) => {
                          setEditForm({ ...editForm, phone: e.target.value });
                        }}
                        placeholder="e.g. 9876543210"
                        disabled={phoneOtpLoading || phoneOtpStep === "verify"}
                      />
                      <p className="text-xs text-gray-400">Number change karoge to re-verify karna padega.</p>
                    </div>

                    {phoneOtpStep === "verify" && (
                      <div className="space-y-2">
                        <Label htmlFor="phone_verify_otp" className="text-amber-400/80">OTP</Label>
                        <Input
                          id="phone_verify_otp"
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value)}
                          placeholder="6 digit OTP"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          disabled={phoneOtpLoading}
                        />
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-3">
                    <button
                      type="button"
                      className="royal-btn-outline px-4 py-2 rounded-lg"
                      onClick={() => {
                        setPhoneVerifyOpen(false);
                        setPhoneOtp("");
                        setPhoneOtpStep("request");
                      }}
                      disabled={phoneOtpLoading}
                    >
                      Cancel
                    </button>

                    {phoneOtpStep === "request" ? (
                      <button
                        type="button"
                        className="royal-btn px-4 py-2 rounded-lg flex items-center gap-2"
                        onClick={() => requestPhoneOtp("request")}
                        disabled={phoneOtpLoading}
                      >
                        {phoneOtpLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                          </>
                        ) : (
                          "Send OTP"
                        )}
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="royal-btn-outline px-4 py-2 rounded-lg"
                          onClick={() => requestPhoneOtp("resend")}
                          disabled={phoneOtpLoading}
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          className="royal-btn px-4 py-2 rounded-lg flex items-center gap-2"
                          onClick={verifyPhoneOtp}
                          disabled={phoneOtpLoading}
                        >
                          {phoneOtpLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                            </>
                          ) : (
                            "Verify"
                          )}
                        </button>
                      </div>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit Form */}
              {isEditing && (
                <div 
                  className="mt-8 pt-8 border-t border-amber-400/20 grid gap-6 md:grid-cols-2"
                >
                  <div>
                    <Label htmlFor="edit_name" className="text-amber-400/80 text-sm mb-2 block">Full Name</Label>
                    <input
                      id="edit_name"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      placeholder="Enter your full name"
                      className="royal-input w-full px-4 py-3 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_phone" className="text-amber-400/80 text-sm mb-2 block">Phone Number</Label>
                    <input
                      id="edit_phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="Enter your phone number"
                      className="royal-input w-full px-4 py-3 rounded-lg"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="edit_address" className="text-amber-400/80 text-sm mb-2 block">Address</Label>
                    <textarea
                      id="edit_address"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="Enter your address"
                      className="royal-input w-full px-4 py-3 rounded-lg resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* AI Avatar Dialog */}
              <Dialog open={aiAvatarOpen} onOpenChange={setAiAvatarOpen}>
                <DialogContent className="royal-dialog border-amber-400/30">
                  <DialogHeader>
                    <DialogTitle className="gold-text text-xl flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" /> Generate AI Avatar
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Describe the avatar you want (example: "classic royal gentleman with short hair, blue background").
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
                    <Label htmlFor="ai_avatar_prompt" className="text-amber-400/80">Avatar description</Label>
                    <textarea
                      id="ai_avatar_prompt"
                      value={aiAvatarPrompt}
                      onChange={(e) => setAiAvatarPrompt(e.target.value)}
                      placeholder="Describe your avatar..."
                      rows={4}
                      disabled={aiAvatarLoading}
                      className="royal-input w-full px-4 py-3 rounded-lg resize-none"
                    />
                  </div>

                  <DialogFooter className="gap-3">
                    <button
                      className="royal-btn-outline px-4 py-2 rounded-lg"
                      onClick={() => setAiAvatarOpen(false)}
                      disabled={aiAvatarLoading}
                    >
                      Cancel
                    </button>
                    <button
                      className="royal-btn px-4 py-2 rounded-lg flex items-center gap-2"
                      onClick={handleGenerateAiAvatar}
                      disabled={aiAvatarLoading || aiAvatarPrompt.trim().length < 3}
                    >
                      {aiAvatarLoading ? (
                        <>
                          <div className="w-4 h-4 royal-spinner"></div> Generating
                        </>
                      ) : (
                        'Generate'
                      )}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar Navigation */}
              <div className="lg:w-1/4">
                <div 
                  className="royal-card rounded-xl p-4 sticky top-4"
                >
                  <div className="mb-4 pb-4 border-b border-amber-400/10">
                    <h3 className="text-amber-400/80 text-xs font-semibold uppercase tracking-wider">Navigation</h3>
                  </div>
                  <nav className="flex flex-col space-y-2">
                    <button
                      className={cn(
                        "nav-tab w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-gray-300 font-medium",
                        activeTab === 'orders' && 'active text-amber-400'
                      )}
                      onClick={() => setActiveTab('orders')}
                    >
                      <Package className="w-5 h-5" />
                      <span>Order History</span>
                      {orders.length > 0 && (
                        <span 
                          className="ml-auto text-xs px-2 py-0.5 rounded-full"
                          style={{ 
                            background: 'rgba(212, 175, 55, 0.2)', 
                            color: '#D4AF37' 
                          }}
                        >
                          {orders.length}
                        </span>
                      )}
                    </button>
                    <button
                      className={cn(
                        "nav-tab w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-gray-300 font-medium",
                        activeTab === 'returns' && 'active text-amber-400'
                      )}
                      onClick={() => setActiveTab('returns')}
                    >
                      <Shield className="w-5 h-5" />
                      <span>Return History</span>
                      {returns.length > 0 && (
                        <span 
                          className="ml-auto text-xs px-2 py-0.5 rounded-full"
                          style={{ 
                            background: 'rgba(212, 175, 55, 0.2)', 
                            color: '#D4AF37' 
                          }}
                        >
                          {returns.length}
                        </span>
                      )}
                    </button>
                    <button
                      className={cn(
                        "nav-tab w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-gray-300 font-medium"
                      )}
                      onClick={() => navigate('/wishlist')}
                    >
                      <Heart className="w-5 h-5" />
                      <span>Wishlist</span>
                    </button>
                    <button
                      className={cn(
                        "nav-tab w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-gray-300 font-medium",
                        activeTab === 'chatbot' && 'active text-amber-400'
                      )}
                      onClick={() => setActiveTab('chatbot')}
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>AI Assistant</span>
                    </button>
                  </nav>
                </div>
              </div>

              {/* Content Area */}
              <div className="lg:w-3/4">
                {activeTab === 'orders' && (
                  <div className="animate-fade-in">
                    <div className="section-header rounded-lg">
                      <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-amber-400" />
                        <h2 className="font-display text-2xl font-semibold">Order History</h2>
                      </div>
                    </div>

                    {isBanned ? (
                      <div className="royal-card p-8 text-center border-red-500/30">
                        <h3 className="text-2xl font-bold text-red-500 mb-2">Account Restricted</h3>
                        <p className="text-gray-400">You are banned</p>
                      </div>
                    ) : (
                      <>
                    <div className="royal-card rounded-xl p-6 mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <XCircle className="w-5 h-5 text-red-400" />
                        <div>
                          <h3 className="text-amber-300 font-semibold">Cancel Order</h3>
                          <p className="text-xs text-gray-400">
                            Enter your order ID to cancel. Shipped or delivered orders cannot be cancelled.
                          </p>
                        </div>
                      </div>
                      <form onSubmit={handleCancelOrder} className="flex flex-col md:flex-row gap-3">
                        <Input
                          value={cancelOrderId}
                          onChange={(e) => setCancelOrderId(e.target.value)}
                          placeholder="Enter Order ID (e.g., RYL-XXXXXXXX)"
                          className="royal-input flex-1"
                        />
                        <button
                          type="submit"
                          className="royal-btn px-6 py-3 rounded-lg flex items-center justify-center gap-2"
                          disabled={cancelling}
                        >
                          {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Cancel Order
                        </button>
                      </form>
                    </div>

                    {orders.length === 0 ? (
                      <div 
                        className="royal-card rounded-xl p-12 text-center empty-state"
                      >
                        <div className="float-animation">
                          <Package className="w-20 h-20 text-amber-400/20 mx-auto mb-6" />
                        </div>
                        <h3 className="gold-text text-xl font-semibold mb-2">No Orders Yet</h3>
                        <p className="text-gray-400 mb-6">
                          Begin your royal shopping experience today!
                        </p>
                        <button 
                          className="royal-btn px-6 py-3 rounded-lg inline-flex items-center gap-2"
                          onClick={() => navigate('/products')}
                        >
                          <Crown className="w-5 h-5" /> Browse Collection
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {orders.map((order) => {
                          const status = statusConfig[order.status] || statusConfig.pending;
                          const isExpanded = expandedOrders[order.id] || false;
                          
                          const toggleOrder = (orderId: string) => {
                            setExpandedOrders(prev => ({
                              ...prev,
                              [orderId]: !prev[orderId]
                            }));
                          };
                          
                          return (
                            <div
                              key={order.id}
                              className="order-card rounded-xl cursor-pointer"
                              onClick={() => toggleOrder(order.id)}
                            >
                              {/* Order Header */}
                              <div className="p-6">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <span className="gold-text font-semibold text-lg">
                                          {order.order_id}
                                        </span>

                                        <button
                                          type="button"
                                          className="text-amber-400/60 hover:text-amber-400 transition-colors p-1.5 rounded-md hover:bg-amber-400/10"
                                          onClick={() => copyOrderId(order.order_id)}
                                          aria-label="Copy order id"
                                        >
                                          <Copy className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <span className={`status-badge ${status.className}`}>
                                        {status.icon}
                                        {status.label}
                                      </span>
                                      {order.return_status && (
                                        <span className={cn(
                                          "status-badge",
                                          order.return_status === 'requested' ? 'status-confirmed' :
                                          order.return_status === 'approved' ? 'status-delivered' :
                                          order.return_status === 'rejected' ? 'status-cancelled' :
                                          'status-processing'
                                        )}>
                                          Return: {order.return_status.charAt(0).toUpperCase() + order.return_status.slice(1)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-gray-400 text-sm">
                                      <p>
                                        Ordered: {new Date(order.created_at).toLocaleDateString('en-IN', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric',
                                        })}
                                      </p>
                                      {order.status === 'delivered' && order.updated_at && (
                                        <p className="text-green-400/80 text-xs mt-1">
                                          Delivered {(() => {
                                            const diff = Date.now() - new Date(order.updated_at).getTime();
                                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                            return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
                                          })()}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col md:items-end gap-3">
                                    <div className="order-amount">
                                      ₹{Number(order.total).toFixed(2)}
                                    </div>

                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      
                                      {order.status === 'delivered' && (
                                        <button
                                          className="royal-btn-outline px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            generateInvoice(order as any, order.items as any || [], {});
                                          }}
                                        >
                                          <FileText className="w-3 h-3" /> Invoice
                                        </button>
                                      )}

                                      {order.status === 'delivered' && !order.return_status && (
                                        <ReturnOrderButton 
                                          order={order} 
                                          profile={profile} 
                                          onReturnRequest={() => {
                                            const userId = profile?.user_id || '';
                                            loadOrders(userId, userEmail);
                                            loadReturns(userId);
                                          }} 
                                        />
                                      )}

                                      <button
                                        className="text-amber-400/60 hover:text-amber-400 transition-colors p-2"
                                        onClick={() => toggleOrder(order.id)}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-5 h-5" />
                                        ) : (
                                          <ChevronDown className="w-5 h-5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Order Items Preview */}
                                <div 
                                  className="mt-4 rounded-lg p-4"
                                  style={{ 
                                    background: 'rgba(212, 175, 55, 0.05)',
                                    border: '1px solid rgba(212, 175, 55, 0.1)'
                                  }}
                                >
                                  <div className="text-xs text-amber-400/60 mb-3 uppercase tracking-wider font-semibold">
                                    Order Items
                                  </div>
                                  <div className="space-y-3">
                                    {order.items && order.items.length > 0 ? (
                                      <>
                                        {order.items.slice(0, 2).map((item, idx) => (
                                          <div key={idx} className="flex items-center gap-3">
                                            {item.product_image && (
                                              <div 
                                                className="w-12 h-12 rounded-lg overflow-hidden border border-amber-400/20"
                                                style={{ background: 'rgba(26, 26, 46, 0.8)' }}
                                              >
                                                <img
                                                  src={item.product_image}
                                                  alt={item.product_name}
                                                  className="w-full h-full object-cover"
                                                />
                                              </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <p className="text-gray-200 font-medium truncate">{item.product_name}</p>
                                              <p className="text-gray-400 text-xs">Qty: {item.quantity}</p>
                                              {item.variant_text && (
                                                <p className="text-gray-400 text-xs truncate">{item.variant_text}</p>
                                              )}
                                            </div>
                                            <div className="text-amber-400/80 font-medium">
                                              ₹{Number(item.product_price).toFixed(2)}
                                            </div>
                                          </div>
                                        ))}
                                        {order.items.length > 2 && (
                                          <p className="text-xs text-gray-400 pl-15">
                                            +{order.items.length - 2} more item{order.items.length - 2 === 1 ? '' : 's'}
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-gray-400 text-sm">No items found for this order.</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Expanded Details */}
                              {isExpanded && (
                                <div 
                                  className="px-6 pb-6 pt-0 border-t border-amber-400/10"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    {/* Delivery Address */}
                                    <div 
                                      className="rounded-lg p-5"
                                      style={{ 
                                        background: 'rgba(212, 175, 55, 0.03)',
                                        border: '1px solid rgba(212, 175, 55, 0.15)'
                                      }}
                                    >
                                      <h4 className="text-amber-400/80 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Delivery Address
                                      </h4>
                                      <p className="text-gray-200 font-medium">{order.customer_name}</p>
                                      <p className="text-gray-400 text-sm mt-1">{order.customer_phone}</p>
                                      <p className="text-gray-400 text-sm mt-2">{order.customer_address}</p>
                                    </div>
                                    
                                    {/* Order Summary */}
                                    <div 
                                      className="rounded-lg p-5"
                                      style={{ 
                                        background: 'rgba(212, 175, 55, 0.03)',
                                        border: '1px solid rgba(212, 175, 55, 0.15)'
                                      }}
                                    >
                                      <h4 className="text-amber-400/80 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                                        <Package className="w-4 h-4" /> Order Summary
                                      </h4>
                                      <div className="space-y-3">
                                        {order.items && order.items.map((item, idx) => (
                                          <div key={idx} className="flex items-center gap-3">
                                            {item.product_image && (
                                              <img 
                                                src={item.product_image} 
                                                alt={item.product_name}
                                                className="w-10 h-10 object-cover rounded-md border border-amber-400/20"
                                              />
                                            )}
                                            <div className="flex-1">
                                              <p className="text-gray-200 text-sm font-medium">{item.product_name}</p>
                                              <p className="text-gray-400 text-xs">Qty: {item.quantity}</p>
                                              {item.variant_text && (
                                                <p className="text-gray-400 text-xs">{item.variant_text}</p>
                                              )}
                                            </div>
                                            <div className="text-amber-400/80 text-sm">
                                              ₹{Number(item.product_price).toFixed(2)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div 
                                        className="mt-4 pt-4 border-t border-amber-400/10 flex justify-between items-center"
                                      >
                                        <span className="text-gray-300 font-medium">Total</span>
                                        <span className="gold-text text-lg font-bold">₹{Number(order.total).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Messages from Store */}
                                  {order.messages && order.messages.length > 0 && (
                                    <div 
                                      className="mt-6 pt-6 border-t border-amber-400/10"
                                    >
                                      <h4 className="text-amber-400/80 text-xs uppercase tracking-wider font-semibold mb-4 flex items-center gap-2">
                                        <Star className="w-4 h-4" /> Messages from Store
                                      </h4>
                                      <div className="space-y-3">
                                        {order.messages.map((message, idx) => (
                                          <div 
                                            key={idx} 
                                            className="rounded-lg p-4"
                                            style={{ 
                                              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.05) 100%)',
                                              border: '1px solid rgba(212, 175, 55, 0.2)'
                                            }}
                                          >
                                            <p className="text-gray-200">{message.message}</p>
                                            <p className="text-amber-400/50 text-xs mt-2">
                                              {new Date(message.created_at).toLocaleString('en-IN', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </>
                    )}
                  </div>
                )}

                {activeTab === 'returns' && (
                  <div className="animate-fade-in">
                    <div className="section-header rounded-lg">
                      <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-amber-400" />
                        <h2 className="font-display text-2xl font-semibold">Return History</h2>
                      </div>
                    </div>

                    {returns.length === 0 ? (
                      <div 
                        className="royal-card rounded-xl p-12 text-center empty-state"
                      >
                        <div className="float-animation">
                          <Shield className="w-20 h-20 text-amber-400/20 mx-auto mb-6" />
                        </div>
                        <h3 className="gold-text text-xl font-semibold mb-2">No Returns Yet</h3>
                        <p className="text-gray-400">
                          You haven't initiated any returns yet. We hope you love all your purchases!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {returns.map((ret) => (
                          <div
                            key={ret.id}
                            className="order-card rounded-xl p-6"
                          >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <span className="gold-text font-semibold">
                                    Return for Order: {ret.order_id}
                                  </span>
                                  <span className={cn(
                                    "status-badge",
                                    ret.return_status === 'requested' ? 'status-confirmed' :
                                    ret.return_status === 'approved' ? 'status-delivered' :
                                    ret.return_status === 'rejected' ? 'status-cancelled' :
                                    ret.return_status === 'refunded' ? 'status-delivered' :
                                    'status-pending'
                                  )}>
                                    {ret.return_status.charAt(0).toUpperCase() + ret.return_status.slice(1)}
                                  </span>
                                </div>
                                <p className="text-gray-400 text-sm">
                                  {new Date(ret.requested_at).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </p>
                                <p className="text-gray-300 mt-3">
                                  <span className="text-amber-400/60">Reason:</span> {ret.return_reason}
                                </p>
                                {ret.refund_amount && (
                                  <p className="text-gray-300 mt-1">
                                    <span className="text-amber-400/60">Refund Amount:</span>{' '}
                                    <span className="gold-text font-medium">₹{Number(ret.refund_amount).toFixed(2)}</span>
                                  </p>
                                )}
                                {ret.return_status === 'requested' && (
                                  <div className="mt-4">
                                    <button
                                      className="royal-btn-outline px-3 py-2 rounded-lg text-xs"
                                      onClick={() => handleCancelReturn(ret)}
                                      disabled={!!cancellingReturns[ret.id]}
                                    >
                                      {cancellingReturns[ret.id] ? 'Cancelling...' : 'Cancel Return'}
                                    </button>
                                  </div>
                                )}
                                
                                {orders.find(o => o.id === ret.order_id) && (
                                  <div className="mt-4">
                                    <button
                                      className="royal-btn-outline px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const linkedOrder = orders.find(o => o.id === ret.order_id);
                                        if (linkedOrder) generateInvoice(linkedOrder as any, linkedOrder.items as any || [], {});
                                      }}
                                    >
                                      <FileText className="w-3 h-3" /> View Invoice
                                    </button>
                                  </div>
                                )}

                                {/* Return Images */}
                                {ret.images && ret.images.length > 0 && (
                                  <div className="mt-4">
                                    <p className="text-amber-400/60 text-sm mb-2">Return Images:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {ret.images.slice(0, 4).map((image: string, idx: number) => (
                                        <a 
                                          key={idx}
                                          href={image}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block"
                                        >
                                          <img 
                                            src={image}
                                            alt={`Return image ${idx + 1}`}
                                            className="w-16 h-16 object-cover rounded-lg border border-amber-400/20 hover:border-amber-400/50 transition-colors"
                                          />
                                        </a>
                                      ))}
                                      {ret.images.length > 4 && (
                                        <div 
                                          className="flex items-center justify-center w-16 h-16 rounded-lg text-xs text-amber-400/60"
                                          style={{ 
                                            background: 'rgba(212, 175, 55, 0.1)',
                                            border: '1px solid rgba(212, 175, 55, 0.2)'
                                          }}
                                        >
                                          +{ret.images.length - 4}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'chatbot' && (
                  <div className="animate-fade-in">
                    <div className="section-header rounded-lg">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-amber-400" />
                        <h2 className="font-display text-2xl font-semibold">AI Assistant</h2>
                      </div>
                    </div>
                    
                    <div className="royal-card rounded-xl p-6">
                      <ChatbotComponent />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Chatbot Component with Royal Theme
import { useBanCheck } from "@/hooks/useBanCheck";

const ChatbotComponent = () => {
  const { isBanned } = useBanCheck();
  const greetingMessage = { id: "1", text: isBanned ? "You are banned" : "Hi! I'm your AI assistant. You can talk to me in English, Hindi, ya Hinglish.", sender: "bot" as const, timestamp: new Date() };
  const [messages, setMessages] = useState<Array<{id: string; text: string; sender: 'user' | 'bot'; timestamp: Date; imageUrl?: string; images?: string[]}>>([
    greetingMessage
  ]);
  
  // Effect to update message if ban status changes loaded
  useEffect(() => {
    if (isBanned) {
      setMessages([{ id: "ban-msg", text: "You are banned", sender: "bot", timestamp: new Date() }]);
    }
  }, [isBanned]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; updated_at: string; created_at: string }>>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [pendingConversationTitle, setPendingConversationTitle] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('cp_ai_web_search');
      if (v === '0') return false;
      if (v === '1') return true;
    } catch {}
    return true;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voicePrefixRef = useRef<string>("");
  const [ttsLang, setTtsLang] = useState<"auto" | "en" | "hi">("auto");
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  type GeminiGenerateContentResponse = {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event: any) => {
      const results = event?.results;
      if (!results) return;
      let transcript = "";
      for (let i = 0; i < results.length; i++) {
        transcript += (results[i]?.[0]?.transcript ?? "").toString();
      }
      setInputMessage(`${voicePrefixRef.current}${transcript}`.trimStart());
    };

    recognition.onerror = (event: any) => {
      const code = (event?.error ?? "").toString();
      if (code && code !== "no-speech") {
        toast.error("Voice input failed. Please allow microphone permission.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    const load = () => {
      try {
        const list = synth.getVoices() || [];
        setTtsVoices(list);
      } catch {
        setTtsVoices([]);
      }
    };

    load();
    synth.onvoiceschanged = load;

    return () => {
      try {
        synth.onvoiceschanged = null;
        synth.cancel();
      } catch {}
    };
  }, []);

  const stripForTts = (text: string) => {
    return text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
      .replace(/[#>*_~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const detectUserLanguageHint = (text: string): "en" | "hi" | "hinglish" => {
    const cleaned = (text || "").trim();
    if (!cleaned) return "en";
    if (/[\u0900-\u097F]/.test(cleaned)) return "hi";
    const t = cleaned.toLowerCase();
    const words = [
      "kya",
      "kaise",
      "kyu",
      "nahi",
      "haan",
      "aap",
      "ap",
      "mujhe",
      "chahiye",
      "chaiye",
      "lena",
      "bata",
      "batao",
      "karo",
      "kar",
      "bhai",
      "yaar",
      "mere",
      "meri",
      "tum",
      "main",
      "hai",
      "ho",
    ];
    let hits = 0;
    for (const w of words) {
      const re = new RegExp(`\\b${w}\\b`, "g");
      const m = t.match(re);
      if (m) hits += m.length;
      if (hits >= 2) break;
    }
    return hits >= 2 ? "hinglish" : "en";
  };

  const pickVoice = (lang: string) => {
    const normalized = lang.toLowerCase();
    const matches = ttsVoices.filter((v) => (v.lang || "").toLowerCase().startsWith(normalized));
    if (matches.length === 0) return null;
    const preferred = matches.find((v) => v.default) || matches.find((v) => (v.name || "").toLowerCase().includes("google")) || matches[0];
    return preferred;
  };

  const speakBotMessage = (messageId: string, text: string) => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    const Utterance = (window as any).SpeechSynthesisUtterance;
    if (!synth || !Utterance) {
      toast.error("Voice playback not supported on this browser.");
      return;
    }

    if (speakingMessageId === messageId) {
      try {
        synth.cancel();
      } catch {}
      setSpeakingMessageId(null);
      return;
    }

    const cleaned = stripForTts(text);
    if (!cleaned) return;

    try {
      synth.cancel();
    } catch {}

    const hasHindiScript = /[\u0900-\u097F]/.test(cleaned);
    const lang = ttsLang === "auto" ? (hasHindiScript ? "hi-IN" : "en-IN") : ttsLang === "hi" ? "hi-IN" : "en-IN";
    const utter = new Utterance(cleaned);
    utter.lang = lang;
    const voice = pickVoice(lang);
    if (voice) utter.voice = voice;
    utter.rate = 1;
    utter.pitch = 1;

    utter.onend = () => {
      setSpeakingMessageId(null);
    };
    utter.onerror = () => {
      setSpeakingMessageId(null);
    };

    setSpeakingMessageId(messageId);
    synth.speak(utter);
  };

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return;
      const id = data.user?.id ?? null;
      const email = data.user?.email ?? null;
      setUserId(id);
      setUserEmail(email);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      if (mql.matches) setIsSidebarOpen(false);
    };
    apply();
    const anyMql = mql as unknown as { addEventListener?: any; removeEventListener?: any; addListener?: any; removeListener?: any };
    if (anyMql.addEventListener) anyMql.addEventListener("change", apply);
    else if (anyMql.addListener) anyMql.addListener(apply);
    return () => {
      if (anyMql.removeEventListener) anyMql.removeEventListener("change", apply);
      else if (anyMql.removeListener) anyMql.removeListener(apply);
    };
  }, []);

  useEffect(() => {
    const loadConversations = async () => {
      if (!userId) return;
      setIsLoadingConversations(true);
      try {
        const { data, error } = await (supabase.from("ai_conversations" as any) as any)
          .select("id,title,updated_at,created_at")
          .order("updated_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        const list = (data || []) as Array<{ id: string; title: string; updated_at: string; created_at: string }>;
        setConversations(list);
        if (!activeConversationId && list.length > 0) {
          const first = list[0]?.id;
          if (first) {
            setActiveConversationId(first);
            await loadConversationMessages(first);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load chat history";
        toast.error(msg);
      } finally {
        setIsLoadingConversations(false);
      }
    };
    loadConversations();
  }, [userId]);

  const loadConversationMessages = async (conversationId: string) => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await (supabase.from("ai_messages" as any) as any)
        .select("id,role,content,images,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      const rows = (data || []) as Array<{ id: string; role: "user" | "bot"; content: string; images: unknown; created_at: string }>;
      if (rows.length === 0) {
        setMessages([greetingMessage]);
        return;
      }
      setMessages([
        ...rows.map((r) => {
          const imgs = Array.isArray(r.images) ? r.images.filter((x): x is string => typeof x === "string") : [];
          return {
            id: r.id,
            text: r.content,
            sender: r.role === "user" ? ("user" as const) : ("bot" as const),
            timestamp: new Date(r.created_at),
            images: imgs.length > 0 ? imgs : undefined,
            imageUrl: imgs.length > 0 ? imgs[0] : undefined,
          };
        }),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load chat history";
      toast.error(msg);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const callCustomerProfileAi = async (messagesPayload: unknown, signal?: AbortSignal) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Session expired. Please login again.");
    }

    let accessToken = session.access_token;
    if (typeof session.expires_at === "number" && session.expires_at * 1000 < Date.now() + 60_000) {
      const refreshed = await supabase.auth.refreshSession().catch(() => null);
      accessToken = refreshed?.data?.session?.access_token ?? accessToken;
    }

    // Use fetch directly to support signal
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-profile-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(messagesPayload),
      signal,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI request failed");
    }

    return data;
  };

  const extractGeminiText = (response: unknown) => {
    const r = response as GeminiGenerateContentResponse;
    const text = r?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim() ? text : null;
  };

  const cleanAiText = (text: string) => {
    // No need to strip markdown as we are using ReactMarkdown
    return text.trim();
  };

  const extractProductIdsFromText = (text: string) => {
    const ids: string[] = [];
    const re = /\/product\/([0-9a-fA-F-]{36})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const id = m[1];
      if (typeof id === "string") ids.push(id);
    }
    return Array.from(new Set(ids));
  };

  const getFirstImageUrl = (raw: unknown): string | null => {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      const url = raw.find((x) => typeof x === "string" && x.trim().length > 0);
      return typeof url === "string" ? url : null;
    }
    return null;
  };

  const fetchProductAndVariantImages = async (productIds: string[]) => {
    if (!productIds.length) return new Map<string, string[]>();

    const [productsResp, variantsResp] = await Promise.all([
      supabase.from("products").select("id, image_url, images").in("id", productIds),
      (supabase.from("product_variants" as any) as any)
        .select("product_id, image_urls")
        .in("product_id", productIds),
    ]);

    const map = new Map<string, string[]>();
    const pushUnique = (productId: string, url: string | null) => {
      if (!url) return;
      if (!map.has(productId)) map.set(productId, []);
      const list = map.get(productId)!;
      if (!list.includes(url)) list.push(url);
    };

    (productsResp.data || []).forEach((p) => {
      const row = p as unknown as { id?: unknown; image_url?: unknown; images?: unknown };
      if (typeof row.id !== "string" || row.id.length === 0) return;
      const primary = typeof row.image_url === "string" ? row.image_url : null;
      pushUnique(row.id, primary);
      pushUnique(row.id, getFirstImageUrl(row.images));
    });

    (variantsResp.data || []).forEach((v: any) => {
      const productId = typeof v?.product_id === "string" ? v.product_id : null;
      if (!productId) return;
      const first = getFirstImageUrl(v?.image_urls);
      pushUnique(productId, first);
    });

    return map;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "[Generation stopped by user]",
        sender: 'bot' as const,
        timestamp: new Date()
      }]);
    }
  };

  const ensureConversationId = async (firstUserText: string) => {
    if (activeConversationId) return activeConversationId;
    if (!userId) throw new Error("Please login again.");
    const title = firstUserText.trim() ? firstUserText.trim().slice(0, 60) : "New chat";
    const { data, error } = await (supabase.from("ai_conversations" as any) as any)
      .insert({ user_id: userId, title })
      .select("id,title,updated_at,created_at")
      .single();
    if (error) throw error;
    const conv = data as { id: string; title: string; updated_at: string; created_at: string };
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
    return conv.id;
  };

  const bumpConversationToTop = (conversationId: string) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversationId);
      if (idx < 0) return prev;
      const updated = [...prev];
      const [c] = updated.splice(idx, 1);
      return [c, ...updated];
    });
  };

  const persistMessage = async (params: {
    conversationId: string;
    role: "user" | "bot";
    content: string;
    images?: string[];
  }) => {
    if (!userId) throw new Error("Please login again.");
    const { conversationId, role, content, images } = params;
    const { data, error } = await (supabase.from("ai_messages" as any) as any)
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        images: images && images.length > 0 ? images : [],
      })
      .select("id,created_at")
      .single();
    if (error) throw error;
    return data as { id: string; created_at: string };
  };

  const sendMessageCore = async (params: { text: string; images?: string[]; webSearch?: boolean }) => {
    const rawText = params.text;
    const imgs = params.images ?? [];
    if ((!rawText.trim() && imgs.length === 0) || isLoading) return;

    if (!userId) {
      toast.error("Please login again.");
      return;
    }

    let messageToSend = rawText;
    if (imgs.length > 0) {
      messageToSend = messageToSend + (messageToSend ? " " : "") + `[Attached ${imgs.length} image(s)]`;
    }

    const tempUserId = `u_${Date.now().toString()}`;
    const userMessage = {
      id: tempUserId,
      text: messageToSend,
      sender: "user" as const,
      timestamp: new Date(),
      images: imgs.length > 0 ? [...imgs] : undefined,
      imageUrl: imgs.length > 0 ? imgs[0] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    const useWebSearch = typeof params.webSearch === "boolean" ? params.webSearch : webSearchEnabled;

    try {
      const conversationId = await ensureConversationId(rawText);
      bumpConversationToTop(conversationId);

      const insertedUser = await persistMessage({
        conversationId,
        role: "user",
        content: messageToSend,
        images: imgs,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempUserId ? { ...m, id: insertedUser.id, timestamp: new Date(insertedUser.created_at) } : m))
      );

      const languageHint = detectUserLanguageHint(rawText);

      const apiMessages = [
        {
          role: "system",
          content:
            `You are a helpful, friendly shopping assistant for our store. Keep the tone normal and casual. Keep responses clear and not too long.

Language mode for this request: ${languageHint}
- If language mode is hi: reply in Hindi using Devanagari (हिंदी), not romanized Hindi.
- If language mode is hinglish: reply in Hinglish (Hindi words in Roman + simple English), natural and easy.
- If language mode is en: reply in English.
- If user asks \"English/Hindi/Hinglish\", follow that.

If you see a 'SHOP PRODUCT CATALOG' block in the conversation, you must recommend only from that catalog (do not invent products).

When recommending products:
- Ask 1-2 quick questions if the user didn't mention budget/specs/usage.
- Suggest the best 3 options with short reasons.
- Always mention stock left from the catalog (e.g., \"10 left\").
- If Has variants is Yes, mention which variants/attributes exist (e.g., Color/Size) and give 1-2 example combinations.
- Include product Link(s) exactly as provided.
- If an Image URL is provided for a product, include it as a Markdown image: ![Product](IMAGE_URL)
- If the user asks for a table, format it using standard Markdown tables.`,
          imageUrl: undefined,
        },
        ...messages.map((msg) => ({
          role: msg.sender === "user" ? ("user" as const) : ("assistant" as const),
          content: msg.text,
          images: msg.images || (msg.imageUrl ? [msg.imageUrl] : undefined),
        })),
        { role: "user", content: messageToSend, images: imgs.length > 0 ? imgs : undefined },
      ];

      try {
        localStorage.setItem("cp_ai_web_search", useWebSearch ? "1" : "0");
      } catch {}

      const data = await callCustomerProfileAi(
        {
          messages: apiMessages,
          model: "gemini-3-flash-preview",
          temperature: 0.1,
          web_search: useWebSearch,
        },
        abortControllerRef.current.signal
      );

      const botResponseRaw = extractGeminiText(data) || "Sorry, I couldn't process that. Please try again.";
      const botResponse = cleanAiText(botResponseRaw);

      const recommendedProductIds = extractProductIdsFromText(botResponse);
      const productImagesMap = await fetchProductAndVariantImages(recommendedProductIds);
      const attachedImages = recommendedProductIds.flatMap((id) => (productImagesMap.get(id) ?? []).slice(0, 3));

      const tempBotId = `b_${Date.now().toString()}`;
      const botMessage = {
        id: tempBotId,
        text: botResponse,
        sender: "bot" as const,
        timestamp: new Date(),
        images: attachedImages.length > 0 ? attachedImages : undefined,
        imageUrl: attachedImages.length > 0 ? attachedImages[0] : undefined,
      };

      setMessages((prev) => [...prev, botMessage]);

      const insertedBot = await persistMessage({
        conversationId,
        role: "bot",
        content: botResponse,
        images: attachedImages,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempBotId ? { ...m, id: insertedBot.id, timestamp: new Date(insertedBot.created_at) } : m))
      );
      bumpConversationToTop(conversationId);
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      const msg = error instanceof Error ? error.message : "Unknown error";
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I'm having a problem right now. (${msg})`,
        sender: "bot" as const,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }
    const text = inputMessage;
    const imgs = uploadedImages.length > 0 ? [...uploadedImages] : [];
    setInputMessage("");
    setUploadedImages([]);
    await sendMessageCore({ text, images: imgs });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - uploadedImages.length;
    if (files.length > remainingSlots) {
      toast.error(`You can only upload ${remainingSlots} more image(s). Max 5 images allowed.`);
      // We process only the allowed number of files
    }
    
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages(prev => {
          if (prev.length >= 5) return prev;
          return [...prev, reader.result as string];
        });
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input so same files can be selected again if needed
    e.target.value = '';
  };

  const removeUploadedImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const clearChat = () => {
    setActiveConversationId(null);
    setMessages([greetingMessage]);
    setUploadedImages([]);
  };

  const tellJoke = async () => {
    await sendMessageCore({ text: "Tell me a joke", webSearch: false });
  };

  const openRenameDialog = (convId: string) => {
    const current = conversations.find((c) => c.id === convId)?.title || "New chat";
    setPendingConversationId(convId);
    setPendingConversationTitle(current);
    setRenameDialogOpen(true);
  };

  const submitRename = async () => {
    const convId = pendingConversationId;
    const nextTitle = pendingConversationTitle.trim();
    if (!convId || !nextTitle) return;
    try {
      const { error } = await (supabase.from("ai_conversations" as any) as any).update({ title: nextTitle }).eq("id", convId);
      if (error) throw error;
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: nextTitle } : c)));
      toast.success("Chat renamed");
      setRenameDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to rename chat";
      toast.error(msg);
    }
  };

  const openDeleteDialog = (convId: string) => {
    setPendingConversationId(convId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const convId = pendingConversationId;
    if (!convId) return;
    try {
      const { error } = await (supabase.from("ai_conversations" as any) as any).delete().eq("id", convId);
      if (error) throw error;
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConversationId === convId) {
        const nextId = remaining[0]?.id ?? null;
        setActiveConversationId(nextId);
        if (nextId) {
          await loadConversationMessages(nextId);
        } else {
          setMessages([greetingMessage]);
        }
      }
      toast.success("Chat deleted");
      setDeleteDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete chat";
      toast.error(msg);
    }
  };

  const SidebarContent = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.2)" }}>
        <div className="min-w-0">
          <div className="text-xs text-gray-400">Logged in</div>
          <div className="text-sm text-white truncate">{userEmail ?? "—"}</div>
        </div>
        <button type="button" onClick={clearChat} disabled={isLoading} className="royal-btn-outline px-3 py-1.5 rounded-lg text-xs">
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 royal-scrollbar">
        {isLoadingConversations ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading chats...
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-gray-400 text-sm py-3">No chats yet</div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => {
              const active = c.id === activeConversationId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "w-full flex items-start gap-2 rounded-lg px-3 py-2 transition-colors border",
                    active ? "bg-amber-400/10 border-amber-400/30" : "bg-transparent border-amber-400/10 hover:bg-amber-400/5"
                  )}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      setActiveConversationId(c.id);
                      setIsSidebarOpen(false);
                      await loadConversationMessages(c.id);
                    }}
                    disabled={isLoading}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm text-white truncate">{c.title || "New chat"}</div>
                    <div className="text-[11px] text-gray-400">
                      {new Date(c.updated_at || c.created_at).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenameDialog(c.id);
                    }}
                    disabled={isLoading}
                    className="p-1 rounded-md text-amber-200/70 hover:text-amber-200 hover:bg-amber-400/10"
                    title="Rename"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      openDeleteDialog(c.id);
                    }}
                    disabled={isLoading}
                    className="p-1 rounded-md text-red-300/70 hover:text-red-200 hover:bg-red-500/10"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className="relative flex flex-col md:flex-row h-[560px] min-h-[420px]">
      {isSidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close history"
          />
          <div
            className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] p-4"
            style={{ background: "linear-gradient(145deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-semibold">History</div>
              <button
                type="button"
                className="p-2 rounded-lg text-gray-300 hover:bg-white/5"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {SidebarContent}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "hidden md:flex md:pr-3 md:border-r flex-col transition-all",
          isSidebarCollapsed ? "md:w-0 md:pr-0 md:border-r-0 overflow-hidden" : "md:w-64"
        )}
        style={{ borderColor: "rgba(212, 175, 55, 0.2)" }}
      >
        {isSidebarCollapsed ? null : SidebarContent}
      </div>

      <div className="flex-1 md:pl-4 pt-4 md:pt-0 flex flex-col min-w-0 min-h-0">
        <div
          className="sticky top-0 z-30 flex justify-between items-center pb-4 pt-2 mb-4"
          style={{
            borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
            background: "linear-gradient(145deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div>
            <h3 className="gold-text text-lg font-semibold flex items-center gap-2">
              <button
                type="button"
                className="md:hidden royal-btn-outline h-9 w-9 rounded-lg flex items-center justify-center"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open history"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="hidden md:flex royal-btn-outline h-9 w-9 rounded-lg items-center justify-center"
                onClick={() => setIsSidebarCollapsed((v) => !v)}
                aria-label={isSidebarCollapsed ? "Open history" : "Close history"}
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
              <Sparkles className="w-5 h-5 text-amber-400" /> AI Assistant
            </h3>
            <p className="text-gray-400 text-xs mt-1">English / Hindi / Hinglish</p>
          </div>
          <div className="flex gap-2">
            <Select value={ttsLang} onValueChange={(v) => setTtsLang(v as any)}>
              <SelectTrigger className="royal-btn-outline h-9 px-3 rounded-lg text-xs w-[120px]">
                <SelectValue placeholder="Voice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Voice: Auto</SelectItem>
                <SelectItem value="en">Voice: English</SelectItem>
                <SelectItem value="hi">Voice: Hindi</SelectItem>
              </SelectContent>
            </Select>
            <button
              className="royal-btn-outline px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
              onClick={() => setWebSearchEnabled((v) => !v)}
              disabled={isLoading}
              type="button"
            >
              Web {webSearchEnabled ? "On" : "Off"}
            </button>
            <button className="royal-btn-outline px-3 py-1.5 rounded-lg text-xs flex items-center gap-1" onClick={tellJoke} disabled={isLoading}>
              Joke
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mb-4 space-y-4 pr-2 royal-scrollbar min-w-0 overscroll-contain">
          {isLoadingHistory ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading messages...
            </div>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  message.sender === "user" ? "chat-message-user rounded-br-sm" : "chat-message-bot rounded-bl-sm text-white"
                )}
              >
                <div className="markdown-content break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                </div>

                {message.sender === "bot" ? (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => speakBotMessage(message.id, message.text)}
                      className="royal-btn-outline h-8 w-8 rounded-lg flex items-center justify-center"
                      title={speakingMessageId === message.id ? "Stop voice" : "Play voice"}
                    >
                      {speakingMessageId === message.id ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                ) : null}

                {(message.images && message.images.length > 0) || message.imageUrl ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(message.images || [message.imageUrl]).map(
                      (img, idx) =>
                        img && (
                          <img
                            key={idx}
                            src={img}
                            alt={`Uploaded ${idx + 1}`}
                            className="max-h-32 max-w-xs object-contain rounded border border-amber-400/20"
                          />
                        )
                    )}
                  </div>
                ) : null}

                <div className={cn("text-xs mt-2", message.sender === "user" ? "text-amber-900/60" : "text-gray-400")}>
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start items-center gap-3">
              <div className="chat-message-bot rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-amber-400 rounded-full animate-bounce"></div>
                  <div className="h-2 w-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="h-2 w-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
              <button
                onClick={handleStopGeneration}
                className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                title="Stop generating"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {uploadedImages.length > 0 && (
          <div className="mb-3">
            <span className="text-gray-400 text-sm mb-2 block">Attached ({uploadedImages.length}/5):</span>
            <div className="flex gap-2 overflow-x-auto pb-2 royal-scrollbar">
              {uploadedImages.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img src={img} alt={`Preview ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-amber-400/30" />
                  <button
                    type="button"
                    onClick={() => removeUploadedImage(idx)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 shadow-md"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 flex gap-2 flex-wrap">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={isLoading || isLoadingHistory}
              className="royal-input flex-1 px-4 py-3 rounded-lg min-w-[150px]"
            />
            <button
              type="button"
              disabled={isLoading || uploadedImages.length >= 5 || isLoadingHistory}
              className={`royal-btn-outline h-12 w-12 rounded-lg flex items-center justify-center ${uploadedImages.length >= 5 ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => document.getElementById("chatbot-image-upload")?.click()}
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={isLoading || isLoadingHistory || !(window as any)?.SpeechRecognition && !(window as any)?.webkitSpeechRecognition}
              className="royal-btn-outline h-12 w-12 rounded-lg flex items-center justify-center"
              onClick={() => {
                const recognition = recognitionRef.current;
                if (!recognition) {
                  toast.error("Voice input not supported on this browser.");
                  return;
                }
                if (isListening) {
                  try {
                    recognition.stop();
                  } catch {}
                  setIsListening(false);
                  return;
                }
                voicePrefixRef.current = inputMessage ? `${inputMessage.trim()} ` : "";
                setIsListening(true);
                try {
                  recognition.start();
                } catch {
                  setIsListening(false);
                }
              }}
              title={isListening ? "Stop voice" : "Voice input"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <input
              id="chatbot-image-upload"
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isLoading || uploadedImages.length >= 5 || isLoadingHistory}
            />
          </div>
        <button 
          onClick={handleSendMessage} 
          disabled={(!inputMessage.trim() && uploadedImages.length === 0) || isLoading || isLoadingHistory}
          className="royal-btn px-4 py-3 rounded-lg min-w-[80px] flex items-center justify-center gap-2 flex-shrink-0"
        >
          {isLoading ? (
            <div className="w-5 h-5 royal-spinner"></div>
          ) : (
            <>Send</>
          )}
        </button>
      </div>
    </div>
    </div>
    <Dialog
      open={renameDialogOpen}
      onOpenChange={(open) => {
        setRenameDialogOpen(open);
        if (!open) {
          setPendingConversationId(null);
          setPendingConversationTitle("");
        }
      }}
    >
      <DialogContent className="royal-dialog">
        <DialogHeader>
          <DialogTitle className="text-white">Rename chat</DialogTitle>
          <DialogDescription className="text-gray-400">Set a new title for this chat.</DialogDescription>
        </DialogHeader>
        <Input
          value={pendingConversationTitle}
          onChange={(e) => setPendingConversationTitle(e.target.value)}
          className="royal-input"
          placeholder="Chat title"
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename();
          }}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="royal-btn-outline"
            onClick={() => setRenameDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="royal-btn" onClick={submitRename} disabled={!pendingConversationTitle.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={deleteDialogOpen}
      onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setPendingConversationId(null);
      }}
    >
      <DialogContent className="royal-dialog">
        <DialogHeader>
          <DialogTitle className="text-white">Delete chat</DialogTitle>
          <DialogDescription className="text-gray-400">This will permanently remove all messages in this chat.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="royal-btn-outline"
            onClick={() => setDeleteDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="royal-btn" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

// Return Order Button Component with Royal Theme
const ReturnOrderButton = ({ order, profile, onReturnRequest }: { order: Order, profile: CustomerProfile | null, onReturnRequest: () => void }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendLoading, setOtpResendLoading] = useState(false);
  const [nextResendAt, setNextResendAt] = useState<number | null>(null);
  
  useEffect(() => {
    if (!open) {
      setStep("form");
      setOtp("");
      setNextResendAt(null);
      setShowProfileAlert(false);
      setImageError("");
    }
  }, [open]);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    const newImages = [...images, ...files];
    
    if (newImages.length > 6) {
      setImageError('Maximum 6 images allowed');
      return;
    }
    
    if (newImages.length < 2) {
      setImageError('Minimum 2 images required');
    } else {
      setImageError('');
    }
    
    setImages(newImages);
    
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };
  
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    
    setImages(newImages);
    setImagePreviews(newPreviews);
    
    if (newImages.length < 2) {
      setImageError('Minimum 2 images required');
    } else {
      setImageError('');
    }
  };
  
  const requestReturnOtp = async (action: "request" | "resend") => {
    if (!profile?.full_name || !profile.phone || !profile.address) {
      setShowProfileAlert(true);
      return false;
    }
    
    if (images.length < 2 || images.length > 6) {
      setImageError('Please upload between 2 and 6 images');
      return false;
    }

    // Calculate days since order was delivered (not since order was created)
    const deliveredDate = order.updated_at ? new Date(order.updated_at) : new Date(order.created_at);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate.getTime() - deliveredDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Check if order was delivered more than 7 days ago
    if (diffDays > 7) {
      toast.error("Cannot return order. Order was delivered more than 7 days ago (7-day return window has passed).");
      return false;
    }
    
    try {
      if (action === "request") setOtpLoading(true);
      else setOtpResendLoading(true);

      if (action === "resend" && nextResendAt && Date.now() < nextResendAt) {
        toast.error("Please wait before resending OTP.");
        return false;
      }

      const { data, error } = await supabase.functions.invoke("return-otp", {
        body: { action, order_id: order.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setStep("otp");
      setNextResendAt(Date.now() + 10_000);
      toast.success("OTP sent to your email.");
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Failed to send OTP");
      return false;
    } finally {
      setOtpLoading(false);
      setOtpResendLoading(false);
    }
  };

  const handleRequestReturn = async () => {
    await requestReturnOtp("request");
  };

  const confirmOtpAndSubmitReturn = async () => {
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error("Please enter 6 digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("return-otp", {
        body: { action: "verify", order_id: order.id, otp: otp.trim() },
      });
      if (verifyError) throw verifyError;
      if ((verifyData as any)?.error) throw new Error((verifyData as any).error);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }
      if (typeof sessionData.session.expires_at === "number" && sessionData.session.expires_at * 1000 < Date.now() + 60_000) {
        await supabase.auth.refreshSession().catch(() => null);
      }

      const imageUrls: string[] = [];
      
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const base = file.name
          .replace(/\.[^/.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) || 'image';
        const fileName = `${order.id}/${Date.now()}_${i}_${base}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('return-images')
          .upload(fileName, file, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('return-images')
          .getPublicUrl(fileName);
          
        if (urlData?.publicUrl) {
          imageUrls.push(urlData.publicUrl);
        }
      }
      
      const actualReason = reason === 'Other' ? otherReason : reason;
      
      const { error } = await supabase
        .from('returns')
        .insert({
          order_id: order.id,
          customer_name: profile.full_name,
          customer_phone: profile.phone,
          customer_address: profile.address,
          return_reason: actualReason,
          return_status: 'requested',
          images: imageUrls
        });

      if (error) throw error;

      await supabase
        .from('orders')
        .update({
          return_status: 'requested',
          return_reason: reason,
          return_request_date: new Date().toISOString()
        })
        .eq('id', order.id);

      toast.success('Return request submitted successfully!');
      setOpen(false);
      setReason("");
      setOtherReason("");
      setImages([]);
      setImagePreviews([]);
      setOtp("");
      setStep("form");
      onReturnRequest();
    } catch (error: any) {
      console.error('Error requesting return:', error);
      toast.error(error?.message || 'Failed to submit return request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="royal-btn-outline px-3 py-1.5 rounded-lg text-xs">
            Request Return
          </button>
        </DialogTrigger>
        <DialogContent className="royal-dialog border-amber-400/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gold-text text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" /> Request Return
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Submit a return request for order {order.order_id}
            </DialogDescription>
          </DialogHeader>
          
          {showProfileAlert && (
            <div 
              className="mb-4 p-4 rounded-lg"
              style={{ 
                background: 'rgba(255, 193, 7, 0.1)', 
                border: '1px solid rgba(255, 193, 7, 0.3)' 
              }}
            >
              <p className="text-amber-400 text-sm">
                Please complete your profile details (name, phone, address) before requesting a return.
              </p>
            </div>
          )}

          <div className="space-y-5">
            {step === "form" ? (
              <>
                <div>
                  <Label className="text-amber-400/80 text-sm mb-2 block">Return Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="royal-input">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wrong Size">Wrong Size</SelectItem>
                      <SelectItem value="Damaged Product">Damaged Product</SelectItem>
                      <SelectItem value="Not As Described">Not As Described</SelectItem>
                      <SelectItem value="Changed Mind">Changed Mind</SelectItem>
                      <SelectItem value="Quality Issues">Quality Issues</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {reason === 'Other' && (
                  <div>
                    <Label className="text-amber-400/80 text-sm mb-2 block">Please specify</Label>
                    <textarea
                      placeholder="Enter your reason here..."
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      className="royal-input w-full px-4 py-3 rounded-lg resize-none"
                      rows={3}
                    />
                  </div>
                )}
                
                <div className="mb-4 p-3 rounded-lg border border-amber-400/20 bg-amber-400/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center text-amber-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">Invoice Attached</p>
                      <p className="text-xs text-gray-400">Order invoice will be included automatically</p>
                    </div>
                  </div>
                  <button 
                    className="text-amber-400 text-xs hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      generateInvoice(order as any, order.items as any || [], {});
                    }}
                  >
                    View
                  </button>
                </div>

                <div>
                  <Label className="text-amber-400/80 text-sm mb-2 block">
                    Upload Images (minimum 2, maximum 6)
                  </Label>
                  <div 
                    className="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-amber-400/50"
                    style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}
                    onClick={() => document.getElementById(`return-image-upload-${order.id}`)?.click()}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id={`return-image-upload-${order.id}`}
                    />
                    <Camera className="w-10 h-10 text-amber-400/40 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">
                      Click to upload images or drag and drop
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                  
                  {imageError && (
                    <p className="text-red-400 text-sm mt-2">{imageError}</p>
                  )}
                  
                  {imagePreviews.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={preview} 
                            alt={`Preview ${index + 1}`} 
                            className="w-full h-20 object-cover rounded-lg border border-amber-400/20"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-gray-500 text-xs mt-2">
                    {images.length}/6 images uploaded
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-300">
                  Please enter the 6-digit OTP sent to your email to confirm the return.
                </div>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  pattern="\\d*"
                  maxLength={6}
                  className="royal-input"
                  placeholder="Enter OTP"
                />
                <div className="flex gap-2">
                  <button
                    className="royal-btn-outline px-3 py-2 rounded-lg text-xs"
                    onClick={() => requestReturnOtp("resend")}
                    disabled={otpResendLoading || (nextResendAt !== null && Date.now() < nextResendAt)}
                  >
                    {otpResendLoading ? "Resending..." : "Resend OTP"}
                  </button>
                  <button
                    className="royal-btn-outline px-3 py-2 rounded-lg text-xs"
                    onClick={() => setStep("form")}
                    disabled={loading}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-3 mt-6">
            <button 
              className="royal-btn-outline px-4 py-2 rounded-lg"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button 
              className="royal-btn px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={step === "form" ? handleRequestReturn : confirmOtpAndSubmitReturn} 
              disabled={loading || otpLoading}
            >
              {loading ? <div className="w-4 h-4 royal-spinner"></div> : null}
              {step === "form" ? (otpLoading ? "Sending OTP..." : "Submit Return") : "Confirm OTP & Submit"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
