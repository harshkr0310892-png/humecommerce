import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, LogOut, Loader2, RefreshCw, Package, Tag, ShoppingBag, Upload, Edit2, Trash2, X, TrendingUp, Calendar, DollarSign, BarChart3, MessageCircle, Send, Menu, Star, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AttributesManager } from "@/components/admin/AttributesManager";
import { DeliveryBoysManager } from "@/components/admin/DeliveryBoysManager";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductVariantsEditor } from "@/components/admin/ProductVariantsEditor";
import { PhotoViewerModal } from "@/components/PhotoViewerModal";
import { generateInvoice } from "@/utils/invoiceGenerator";
interface Seller {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_banned: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock_status: string;
  created_at: string;
  seller_name?: string | null;
  discount_percentage?: number | null;
  images?: string[] | null;
  stock_quantity?: number | null;
  category_id?: string | null;
  cash_on_delivery?: boolean;
  features?: { feature: string }[] | null;
  detailed_description?: string | null;
  height?: string | null;
  width?: string | null;
  weight?: string | null;
  brand?: string | null;
  brand_logo_url?: string | null;
  seller_description?: string | null;
  gst_percentage?: number | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  parent_id?: string | null;
}

interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  description: string;
  reviewer_name: string | null;
  reviewer_avatar_url: string | null;
  created_at: string;
  product_review_images?: { image_url: string }[];
}

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
  customer_email: string | null;
  status: string;
  payment_method: string | null;
  total: number;
  created_at: string;
  updated_at: string;
  delivery_boy_id: string | null;
  return_status?: string | null;
  return_reason?: string | null;
  return_request_date?: string | null;
  return_processed_date?: string | null;
  return_refund_amount?: number | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
}

interface OrderMessage {
  id: string;
  order_id: string;
  message: string;
  is_admin: boolean;
  is_delivery_boy?: boolean;
  created_at: string;
}

interface ReturnOrder {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_email?: string | null;
  return_reason: string;
  return_status: string;
  requested_at: string;
  processed_at: string | null;
  refund_amount: number | null;
  admin_notes: string | null;
  images: string[] | null;
  order_details?: {
    order_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    customer_email?: string | null;
    status: string;
    total: number;
    created_at: string;
  };
  returned_items?: {
    order_item_id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    image_url: string | null;
    variant_id?: string | null;
    variant_label?: string | null;
  }[];
}

export default function SellerDashboard() {
  const navigate = useNavigate();
  const [isSellerLoggedIn, setIsSellerLoggedIn] = useState(false);
  const [sellerEmail, setSellerEmail] = useState<string | null>(() => sessionStorage.getItem("seller_email"));
  const [sellerName, setSellerName] = useState<string | null>(() => sessionStorage.getItem("seller_name"));
  const [sellerId, setSellerId] = useState<string | null>(() => sessionStorage.getItem("seller_id"));
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  type TabValue =
    | "products"
    | "attributes"
    | "orders"
    | "customer-history"
    | "sales"
    | "delivery-boys"
    | "return-orders"
    | "reviews"
    | "categories";
  const [activeTab, setActiveTab] = useState<TabValue>("products");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brandLogoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingBrandLogo, setUploadingBrandLogo] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [hasVariantImages, setHasVariantImages] = useState(false);
  // Photo viewer modal state
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [orderItems, setOrderItems] = useState<
    Record<
      string,
      {
        id: string;
        order_id: string;
        product_id: string;
        quantity: number;
        product_name?: string;
        product_price?: number;
        variant_info?: any | null;
      }[]
    >
  >({});
  const [orderVariantImageById, setOrderVariantImageById] = useState<Record<string, string>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderMessages, setOrderMessages] = useState<Record<string, OrderMessage[]>>({});
  const [newSellerMessage, setNewSellerMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Order cancellation state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelOrderIdInput, setCancelOrderIdInput] = useState("");

  const parseVariantInfoValue = (value: any): any | null => {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (typeof value === "object") return value;
    return null;
  };

  const extractVariantIdValue = (variantInfo: any): string | null => {
    const v = parseVariantInfoValue(variantInfo);
    if (!v) return null;
    const id = (v as any).variant_id;
    return id ? String(id) : null;
  };

  const buildVariantLabelValue = (variantInfo: any): string | null => {
    const v = parseVariantInfoValue(variantInfo);
    if (!v) return null;
    const name = (v as any).attribute_name || (v as any).attribute;
    const value = (v as any).attribute_value || (v as any).value_name || (v as any).value;
    if (!name || !value) return null;
    return `${String(name)}: ${String(value)}`;
  };

  useEffect(() => {
    const loadVariantImages = async () => {
      const ids = Array.from(
        new Set(
          Object.values(orderItems)
            .flat()
            .map((it) => extractVariantIdValue(it.variant_info))
            .filter(Boolean),
        ),
      ) as string[];
      if (ids.length === 0) {
        setOrderVariantImageById({});
        return;
      }
      const { data, error } = await (supabase as any)
        .from("product_variants")
        .select("id, image_urls")
        .in("id", ids);
      if (error) return;
      const next: Record<string, string> = {};
      (data || []).forEach((v: any) => {
        const raw = v.image_urls;
        const urls = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? (() => {
                try {
                  const parsed = JSON.parse(raw);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })()
            : [];
        const first = urls.find(Boolean);
        if (first) next[String(v.id)] = String(first);
      });
      setOrderVariantImageById(next);
    };
    loadVariantImages();
  }, [orderItems]);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    detailed_description: "",
    price: "",
    discount_percentage: "0",
    stock_status: "in_stock",
    stock_quantity: "0",
    category_id: "",
    main_category_id: "",
    cash_on_delivery: false,
    features: [{ feature: "" }] as { feature: string }[],
    height: "",
    width: "",
    weight: "",
    brand: "",
    brand_logo_url: "",
    seller_name: "",
    seller_description: "",
    gst_percentage: "",
  });

  // State for sales year selection
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Fetch messages for selected order and subscribe to realtime inserts
  useEffect(() => {
    if (!selectedOrder) return;
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", selectedOrder.id)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Error fetching messages:", error);
        toast.error("Failed to fetch messages");
        return;
      }
      if (data) {
        setOrderMessages(prev => ({ ...prev, [selectedOrder.id]: data as OrderMessage[] }));
      }
    };
    fetchMessages();
    const channel = supabase
      .channel(`order_messages:${selectedOrder.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "order_messages",
        filter: `order_id=eq.${selectedOrder.id}`,
      }, (payload) => {
        setOrderMessages(prev => {
          const current = prev[selectedOrder.id] || [];
          const exists = current.some(m => m.id === (payload.new as any).id);
          if (exists) return prev;
          const updated = [...current, payload.new as OrderMessage].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return { ...prev, [selectedOrder.id]: updated };
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedOrder]);

  const sendSellerMessage = async () => {
    if (!newSellerMessage.trim() || !selectedOrder) return;
    
    // Check if order is cancelled
    if (selectedOrder.status === 'cancelled') {
      toast.error("Cannot send message for a cancelled order");
      return;
    }

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from("order_messages")
        .insert({
          order_id: selectedOrder.id,
          message: newSellerMessage.trim(),
          is_admin: true,
          is_delivery_boy: false,
        });
      if (error) throw error;
      const { data, error: fetchError } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", selectedOrder.id)
        .order("created_at", { ascending: true });
      if (fetchError) {
        console.error("Error refreshing messages:", fetchError);
      } else if (data) {
        setOrderMessages(prev => ({ ...prev, [selectedOrder.id]: data as OrderMessage[] }));
      }
      setNewSellerMessage("");
      toast.success("Message sent!");
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast.error(err?.message || "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const syncAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const auto = params.get("auto");
      const autoId = params.get("id");
      const autoEmailRaw = params.get("e") || params.get("email");
      const autoEmail = (autoEmailRaw || "").trim();

      if (auto === "1" && autoId && autoEmail) {
        try {
          const { data, error } = await (supabase as any)
            .from("sellers")
            .select("id, name, email, is_active, is_banned")
            .eq("id", autoId)
            .ilike("email", autoEmail)
            .maybeSingle();
          if (error) throw error;
          if (!data) {
            toast.error("Invalid auto-login link");
            navigate("/seller/login", { replace: true });
            return;
          }
          if (!(data as any).is_active) {
            toast.error("Seller is inactive");
            navigate("/seller/login", { replace: true });
            return;
          }
          if ((data as any).is_banned) {
            toast.error("Seller is banned");
            navigate("/seller/login", { replace: true });
            return;
          }
          sessionStorage.setItem("seller_logged_in", "true");
          sessionStorage.setItem("seller_email", (data as any).email);
          sessionStorage.setItem("seller_name", (data as any).name);
          sessionStorage.setItem("seller_id", (data as any).id);
          setSellerEmail((data as any).email);
          setSellerName((data as any).name);
          setSellerId((data as any).id);
          setIsSellerLoggedIn(true);
          setHasAuthSession(false);
          setAuthChecked(true);
          navigate("/seller", { replace: true });
          return;
        } catch (e) {
          console.error("Seller auto-login error:", e);
          toast.error("Failed to auto-login");
          navigate("/seller/login", { replace: true });
          return;
        }
      }

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            url.searchParams.delete("code");
            window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
          }
        } else if (window.location.hash && window.location.hash.includes("access_token")) {
          const fn = (supabase.auth as any).getSessionFromUrl;
          if (typeof fn === "function") {
            await fn({ storeSession: true });
            window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
          }
        }
      } catch (e) {
        console.error("Auth redirect handling error:", e);
      }

      const { data } = await supabase.auth.getSession();
      const session = data?.session || null;
      if (!mounted) return;

      const authed = !!session;
      setHasAuthSession(authed);
      setAuthChecked(true);

      const storedLoggedIn = sessionStorage.getItem("seller_logged_in") === "true";
      const storedEmail = sessionStorage.getItem("seller_email");
      const storedName = sessionStorage.getItem("seller_name");
      const storedId = sessionStorage.getItem("seller_id");

      if (storedLoggedIn && storedEmail) {
        setSellerEmail(storedEmail);
        setSellerName(storedName);
        setSellerId(storedId);
        setIsSellerLoggedIn(true);
        return;
      }

      if (!authed) {
        sessionStorage.removeItem("seller_logged_in");
        sessionStorage.removeItem("seller_email");
        sessionStorage.removeItem("seller_name");
        sessionStorage.removeItem("seller_id");
        setIsSellerLoggedIn(false);
        setSellerEmail(null);
        setSellerName(null);
        setSellerId(null);
        navigate("/seller/login");
        return;
      }

      const email = session?.user?.email || null;
      if (email) {
        sessionStorage.setItem("seller_logged_in", "true");
        sessionStorage.setItem("seller_email", email);
        setSellerEmail(email);
        setIsSellerLoggedIn(true);
      }
    };

    syncAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const authed = !!session;
      setHasAuthSession(authed);
      setAuthChecked(true);
      if (!authed) {
        const storedLoggedIn = sessionStorage.getItem("seller_logged_in") === "true";
        const storedEmail = sessionStorage.getItem("seller_email");
        if (storedLoggedIn && storedEmail) return;
        sessionStorage.removeItem("seller_logged_in");
        sessionStorage.removeItem("seller_email");
        sessionStorage.removeItem("seller_name");
        sessionStorage.removeItem("seller_id");
        setIsSellerLoggedIn(false);
        setSellerEmail(null);
        setSellerName(null);
        setSellerId(null);
        navigate("/seller/login");
        return;
      }
      const storedLoggedIn = sessionStorage.getItem("seller_logged_in") === "true";
      const storedEmail = sessionStorage.getItem("seller_email");
      if (storedLoggedIn && storedEmail) return;
      const email = session?.user?.email || null;
      if (email) {
        sessionStorage.setItem("seller_logged_in", "true");
        sessionStorage.setItem("seller_email", email);
        setSellerEmail(email);
        setIsSellerLoggedIn(true);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("seller_logged_in");
    sessionStorage.removeItem("seller_email");
    sessionStorage.removeItem("seller_name");
    sessionStorage.removeItem("seller_id");
    setIsSellerLoggedIn(false);
    setSellerEmail(null);
    setSellerName(null);
    setSellerId(null);
    setHasAuthSession(false);
    navigate("/seller/login");
  }, [navigate]);

  const { data: seller, isLoading: sellerLoading } = useQuery({
    queryKey: ["seller", sellerEmail],
    queryFn: async () => {
      if (!sellerEmail) return null as Seller | null;
      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .ilike("email", sellerEmail.trim())
        .maybeSingle();
      if (error) throw error;
      return data as Seller | null;
    },
    enabled: !!sellerEmail,
  });

  useEffect(() => {
    if (!authChecked) return;
    if (!sellerEmail) return;
    if (sellerLoading) return;
    if (!seller) {
      sessionStorage.removeItem("seller_logged_in");
      sessionStorage.removeItem("seller_email");
      sessionStorage.removeItem("seller_name");
      sessionStorage.removeItem("seller_id");
      setIsSellerLoggedIn(false);
      setSellerEmail(null);
      setSellerName(null);
      setSellerId(null);
      toast.error("Access denied");
      navigate("/seller/login", { replace: true });
    }
  }, [authChecked, sellerEmail, sellerLoading, seller, navigate]);

  useEffect(() => {
    if (seller?.id) {
      if (sessionStorage.getItem("seller_id") !== seller.id) {
        sessionStorage.setItem("seller_id", seller.id);
        setSellerId(seller.id);
      }
      if (seller.name && sessionStorage.getItem("seller_name") !== seller.name) {
        sessionStorage.setItem("seller_name", seller.name);
        setSellerName(seller.name);
      }
    }
  }, [seller]);

  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["seller-products", seller?.id || sellerId],
    queryFn: async () => {
      const id = seller?.id || sellerId;
      if (!id) return [];
      const { data, error } = await (supabase as any)
        .from("products")
        .select("*")
        .eq("seller_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Product[];
    },
    enabled: !!(seller?.id || sellerId),
  });

  const sellerProductIds = (products || []).map((p) => p.id);

  const { data: productReviewSummaries, refetch: refetchProductReviewSummaries } = useQuery({
    queryKey: ['seller-product-review-summaries', seller?.id || sellerId, sellerProductIds.join(',')],
    queryFn: async () => {
      if (!sellerProductIds.length) return {} as Record<string, { avg_rating: number; review_count: number }>;
      const { data, error } = await supabase
        .from('product_review_summary' as any)
        .select('product_id, avg_rating, review_count')
        .in('product_id', sellerProductIds);
      if (error) throw error;
      return (data || []).reduce((acc: Record<string, { avg_rating: number; review_count: number }>, row: any) => {
        acc[row.product_id] = { avg_rating: Number(row.avg_rating || 0), review_count: Number(row.review_count || 0) };
        return acc;
      }, {} as Record<string, { avg_rating: number; review_count: number }>);
    },
    enabled: !!(seller?.id || sellerId),
    staleTime: 60 * 1000,
  });

  const [selectedReviewProductId, setSelectedReviewProductId] = useState<string | null>(null);
  const [selectedReviewStars, setSelectedReviewStars] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab !== 'reviews') return;
    if (selectedReviewProductId) return;
    if (products && products.length > 0) setSelectedReviewProductId(products[0].id);
  }, [activeTab, products, selectedReviewProductId]);

  const selectedReviewProduct = (products || []).find((p) => p.id === selectedReviewProductId) || null;
  const selectedReviewProductImageUrl = selectedReviewProduct?.images?.[0] || selectedReviewProduct?.image_url || null;

  const { data: selectedProductReviews, isLoading: selectedReviewsLoading, refetch: refetchSelectedProductReviews } = useQuery({
    queryKey: ['seller-product-reviews', selectedReviewProductId],
    queryFn: async () => {
      if (!selectedReviewProductId) return [] as ProductReview[];
      const { data, error } = await (supabase as any)
        .from('product_reviews' as any)
        .select('id, product_id, user_id, rating, description, reviewer_name, reviewer_avatar_url, created_at, product_review_images(image_url)')
        .eq('product_id', selectedReviewProductId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ProductReview[]) || [];
    },
    enabled: activeTab === 'reviews' && !!selectedReviewProductId,
  });

  const selectedReviews = selectedProductReviews || [];
  const selectedReviewsCount = selectedReviews.length;
  const selectedAvgRating = selectedReviewsCount
    ? selectedReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / selectedReviewsCount
    : 0;
  const selectedRatingCounts = [1, 2, 3, 4, 5].reduce((acc, v) => {
    acc[v] = selectedReviews.filter((r) => Number(r.rating) === v).length;
    return acc;
  }, {} as Record<number, number>);
  const filteredSelectedReviews = selectedReviewStars
    ? selectedReviews.filter((r) => Number(r.rating) === selectedReviewStars)
    : selectedReviews;

  const renderStars = (value: number, size = 16) => {
    const rounded = Math.round(value * 10) / 10;
    const fullCount = Math.floor(rounded);
    const hasHalf = rounded - fullCount >= 0.5;
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const idx = i + 1;
          const isFull = idx <= fullCount;
          const isHalf = !isFull && hasHalf && idx === fullCount + 1;
          return (
            <span key={idx} className="relative inline-flex" style={{ width: size, height: size }}>
              <Star className="h-full w-full text-amber-400/40" />
              {(isFull || isHalf) && (
                <Star
                  className="absolute inset-0 h-full w-full text-amber-400 fill-amber-400"
                  style={isHalf ? ({ clipPath: 'inset(0 50% 0 0)' } as any) : undefined}
                />
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .is("seller_id", null)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as Category[]) || [];
    },
  });

  // Seller-created category values (child categories where seller_id = this seller)
  const { data: sellerCategoryValues, refetch: refetchSellerCategoryValues } = useQuery({
    queryKey: ["seller-category-values", seller?.id || sellerId],
    queryFn: async () => {
      const id = seller?.id || sellerId;
      if (!id) return [] as Category[];
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("seller_id", id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as Category[]) || [];
    },
    enabled: !!(seller?.id || sellerId),
  });

  const valuesByParent = (sellerCategoryValues || []).reduce((acc: Record<string, Category[]>, v) => {
    const parent = v.parent_id || "";
    if (!acc[parent]) acc[parent] = [];
    acc[parent].push(v);
    return acc;
  }, {} as Record<string, Category[]>);

  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<Category | null>(null);
  const [valueForm, setValueForm] = useState({ name: "", description: "", parent_id: "" });

  const addValueMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; parent_id: string }) => {
      const activeSellerId = seller?.id || sellerId;
      if (!activeSellerId) throw new Error("Seller not detected");
      const data = {
        name: payload.name,
        description: payload.description || null,
        parent_id: payload.parent_id,
        seller_id: activeSellerId,
        sort_order: 0,
        is_active: true,
      };
      const { error } = await (supabase as any).from("categories").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSellerCategoryValues && refetchSellerCategoryValues();
      refetchCategories && refetchCategories();
      toast.success("Value added");
      setValueDialogOpen(false);
      setValueForm({ name: "", description: "", parent_id: "" });
      setEditingValue(null);
    },
    onError: () => toast.error("Failed to add value"),
  });

  const updateValueMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; description?: string }) => {
      const activeSellerId = seller?.id || sellerId;
      if (!activeSellerId) throw new Error("Seller not detected");
      const data = { name: payload.name, description: payload.description || null };
      const { error } = await (supabase as any).from("categories").update(data).eq("id", payload.id).eq("seller_id", activeSellerId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSellerCategoryValues && refetchSellerCategoryValues();
      toast.success("Value updated");
      setValueDialogOpen(false);
      setEditingValue(null);
    },
    onError: () => toast.error("Failed to update value"),
  });

  const deleteValueMutation = useMutation({
    mutationFn: async (id: string) => {
      const activeSellerId = seller?.id || sellerId;
      if (!activeSellerId) throw new Error("Seller not detected");
      const { error } = await (supabase as any).from("categories").delete().eq("id", id).eq("seller_id", activeSellerId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSellerCategoryValues && refetchSellerCategoryValues();
      toast.success("Value deleted");
    },
    onError: () => toast.error("Failed to delete value"),
  });

  // Sellers can view admin categories and add/edit/delete their own "values" (child categories) under them.

  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["seller-orders", seller?.id || sellerId],
    queryFn: async () => {
      const id = seller?.id || sellerId;
      if (!id) return [] as Order[];

      // IMPORTANT:
      // Primary path: use order_items.seller_id snapshot (survives product deletion).
      // Fallback path: for older/new rows where seller_id is NULL, derive via join to products.
      // This keeps seller dashboard working even if seller_id wasn't captured in cart/checkout.

      const orderIdsSet = new Set<string>();

      // (A) Snapshot-based lookup - using product_id instead of seller_id
      const { data: snapshotItems, error: snapshotError } = await (supabase as any)
        .from("order_items")
        .select("order_id")
        .in('product_id', (products || []).map(p => p.id));
      if (snapshotError) throw snapshotError;
      (snapshotItems || []).forEach((it: any) => orderIdsSet.add(it.order_id as string));

      // (B) Fallback join-based lookup (works only while products still exist)
      const { data: joinItems, error: joinError } = await (supabase as any)
        .from("order_items")
        .select("order_id, products!inner(seller_id)")
        .eq("products.seller_id", id);
      if (joinError) throw joinError;
      (joinItems || []).forEach((it: any) => orderIdsSet.add(it.order_id as string));

      const orderIds = Array.from(orderIdsSet);
      if (orderIds.length === 0) return [] as Order[];

      const { data: filteredOrders, error: ordersError } = await (supabase as any)
        .from("orders")
        .select("*")
        .in("id", orderIds)
        .eq("seller_deleted", false)
        .order("created_at", { ascending: false });
      if (ordersError) throw ordersError;

      return (filteredOrders || []) as unknown as Order[];
    },
    enabled: !!(seller?.id || sellerId),
  });

  // Order filters
  const [orderFilter, setOrderFilter] = useState<
    | "all"
    | "this_month"
    | "by_month"
    | "week_1"
    | "week_2"
    | "week_3"
    | "week_4"
    | "last_7"
    | "custom"
  >("all");
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0,7)); // YYYY-MM
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [customerHistoryEmail, setCustomerHistoryEmail] = useState<string>("");
  const [customerHistoryPhone, setCustomerHistoryPhone] = useState<string>("");
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [customerHistoryOrders, setCustomerHistoryOrders] = useState<any[]>([]);
  const [customerHistoryReturnRequests, setCustomerHistoryReturnRequests] = useState<any[]>([]);
  const [customerHistorySearched, setCustomerHistorySearched] = useState(false);

  const computeRange = (filterType: string) => {
    const now = new Date();
    if (!orders || orders.length === 0) return null;
    if (filterType === "all") return null;
    if (filterType === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    if (filterType === "by_month") {
      const [y, m] = (filterMonth || now.toISOString().slice(0,7)).split("-").map(Number);
      const start = new Date(y, (m || now.getMonth()+1) - 1, 1);
      const end = new Date(y, (m || now.getMonth()+1), 0, 23, 59, 59, 999);
      return { start, end };
    }
    if (filterType.startsWith("week_")) {
      const week = Number(filterType.split("_")[1].slice(0)) || 1;
      // determine current month
      const year = now.getFullYear();
      const month = now.getMonth();
      const startDay = (week - 1) * 7 + 1;
      const start = new Date(year, month, startDay);
      const end = new Date(year, month, startDay + 6, 23, 59, 59, 999);
      // clamp to month
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      if (end > monthEnd) end.setTime(monthEnd.getTime());
      return { start, end };
    }
    if (filterType === "last_7") {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      return { start, end };
    }
    if (filterType === "custom") {
      if (!customFrom || !customTo) return null;
      const start = new Date(customFrom);
      const end = new Date(customTo);
      end.setHours(23,59,59,999);
      return { start, end };
    }
    return null;
  };

  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [] as Order[];
    const range = computeRange(orderFilter);
    if (!range) return orders;
    return orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= range.start && d <= range.end;
    });
  }, [orders, orderFilter, filterMonth, customFrom, customTo]);

  const customerHistorySummary = useMemo(() => {
    const totalOrders = customerHistoryOrders.length;
    const statusCounts = customerHistoryOrders.reduce((acc: Record<string, number>, o: any) => {
      const key = String(o.status || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const totalReturnRequests = customerHistoryReturnRequests.length;
    const uniqueReturnOrders = new Set(customerHistoryReturnRequests.map((r: any) => String(r.order_id))).size;
    return { totalOrders, statusCounts, totalReturnRequests, uniqueReturnOrders };
  }, [customerHistoryOrders, customerHistoryReturnRequests]);

  const searchCustomerOrderHistory = async () => {
    const email = customerHistoryEmail.trim().toLowerCase();
    const rawPhone = customerHistoryPhone.trim();

    if (!email && !rawPhone) {
      toast.error("Email ya phone number daalo");
      return;
    }

    const phoneDigits = rawPhone.replace(/\D/g, "");
    const phoneVariants = Array.from(
      new Set(
        [
          rawPhone,
          phoneDigits,
          phoneDigits.length === 10 ? `+91${phoneDigits}` : null,
          phoneDigits.length === 10 ? `91${phoneDigits}` : null,
          phoneDigits.length === 12 && phoneDigits.startsWith("91") ? `+${phoneDigits}` : null,
        ].filter(Boolean) as string[],
      ),
    );

    setCustomerHistoryLoading(true);
    try {
      const baseOrdersQuery = () =>
        (supabase as any)
          .from("orders")
          .select("id, order_id, customer_name, customer_phone, customer_email, status, total, created_at")
          .order("created_at", { ascending: false });

      const byOrderId = new Map<string, any>();

      if (email) {
        const { data: emailOrders, error: emailError } = await baseOrdersQuery().ilike("customer_email", `%${email}%`);
        if (emailError) throw emailError;
        (emailOrders || []).forEach((o: any) => byOrderId.set(String(o.id), o));
      }

      if (phoneVariants.length > 0) {
        const { data: phoneOrders, error: phoneError } = await baseOrdersQuery().in("customer_phone", phoneVariants);
        if (phoneError) throw phoneError;
        (phoneOrders || []).forEach((o: any) => byOrderId.set(String(o.id), o));
      }

      if (phoneDigits.length > 0) {
        const { data: phoneLikeOrders, error: phoneLikeError } = await baseOrdersQuery().ilike("customer_phone", `%${phoneDigits}%`);
        if (phoneLikeError) throw phoneLikeError;
        (phoneLikeOrders || []).forEach((o: any) => byOrderId.set(String(o.id), o));
      }

      const matchedOrders = Array.from(byOrderId.values());
      const matchedIds = matchedOrders.map((o) => String(o.id)).filter(Boolean);

      const { data: returnsData, error: returnsError } = matchedIds.length
        ? await (supabase as any)
            .from("returns")
            .select("order_id, return_status, requested_at")
            .in("order_id", matchedIds)
            .neq("return_status", "cancelled")
            .order("requested_at", { ascending: false })
        : ({ data: [] as any[], error: null } as any);
      if (returnsError) throw returnsError;

      const latestReturnByOrderId = new Map<string, any>();
      (returnsData || []).forEach((r: any) => {
        const oid = String(r.order_id);
        if (!latestReturnByOrderId.has(oid)) latestReturnByOrderId.set(oid, r);
      });

      let sellerOrderItems: any[] = [];
      if (matchedIds.length > 0) {
        const { data: allItems, error: allItemsError } = await (supabase as any)
          .from("order_items")
          .select("id, order_id, product_id, quantity, product_name, product_price, variant_info")
          .in("order_id", matchedIds);
        if (allItemsError) throw allItemsError;
        sellerOrderItems = (allItems || []) as any[];
      }

      const productIds = Array.from(new Set(sellerOrderItems.map((it) => it.product_id).filter(Boolean))) as string[];
      const { data: productRows, error: productRowsError } = productIds.length
        ? await (supabase as any).from("products").select("id, name, image_url, images").in("id", productIds)
        : ({ data: [] as any[], error: null } as any);
      if (productRowsError) throw productRowsError;

      const productById = new Map<string, any>();
      (productRows || []).forEach((p: any) => productById.set(String(p.id), p));

      const productImageFor = (pid: string): string | null => {
        const p = productById.get(pid);
        const first = Array.isArray(p?.images) ? p.images.find(Boolean) : null;
        return (first as any) || p?.image_url || null;
      };

      const variantIds = Array.from(
        new Set(
          sellerOrderItems
            .map((it) => extractVariantIdValue(it.variant_info))
            .filter(Boolean),
        ),
      ) as string[];

      const variantImageById = new Map<string, string>();
      if (variantIds.length > 0) {
        const { data: variantsData, error: variantsError } = await (supabase as any)
          .from("product_variants")
          .select("id, image_urls")
          .in("id", variantIds);
        if (variantsError) throw variantsError;

        (variantsData || []).forEach((v: any) => {
          const raw = v.image_urls;
          const urls = Array.isArray(raw)
            ? raw
            : typeof raw === "string"
              ? (() => {
                  try {
                    const parsed = JSON.parse(raw);
                    return Array.isArray(parsed) ? parsed : [];
                  } catch {
                    return [];
                  }
                })()
              : [];
          const first = urls.find(Boolean);
          if (first) variantImageById.set(String(v.id), String(first));
        });
      }

      const itemsByOrderId = new Map<string, any[]>();
      sellerOrderItems.forEach((it: any) => {
        const oid = String(it.order_id);
        if (!itemsByOrderId.has(oid)) itemsByOrderId.set(oid, []);
        itemsByOrderId.get(oid)!.push(it);
      });

      const enrichedOrders = matchedOrders.map((o: any) => {
        const orderId = String(o.id);
        const its = (itemsByOrderId.get(orderId) || []).map((it: any) => {
          const pid = String(it.product_id);
          const variantId = extractVariantIdValue(it.variant_info);
          const variantImage = variantId ? variantImageById.get(variantId) || null : null;
          const baseImage = productImageFor(pid);
          return {
            id: String(it.id),
            product_id: pid,
            product_name: String(it.product_name || productById.get(pid)?.name || "Product"),
            quantity: Number(it.quantity || 0),
            image_url: variantImage || baseImage,
            variant_id: variantId,
            variant_label: buildVariantLabelValue(it.variant_info),
          };
        });
        return {
          ...o,
          _latest_return: latestReturnByOrderId.get(orderId) || null,
          _items: its,
        };
      });

      setCustomerHistoryOrders(enrichedOrders);
      setCustomerHistoryReturnRequests((returnsData || []) as any[]);
      setCustomerHistorySearched(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Customer order history load nahi ho paaya");
    } finally {
      setCustomerHistoryLoading(false);
    }
  };

  const { data: deliveryBoys } = useQuery({
    queryKey: ["seller-delivery-boys", seller?.id || sellerId],
    queryFn: async () => {
      const id = seller?.id || sellerId;
      if (!id) return [] as any[];
      const { data, error } = await supabase
        .from("delivery_boys" as any)
        .select("*")
        .eq("seller_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!(seller?.id || sellerId),
  });

  // Fetch return orders for seller's products
  const { data: returnOrders, isLoading: returnOrdersLoading, refetch: refetchReturnOrders } = useQuery({
    queryKey: ["seller-return-orders", seller?.id || sellerId],
    queryFn: async () => {
      const id = seller?.id || sellerId;
      if (!id) return [] as ReturnOrder[];

      const { data: joinItems, error: joinError } = await (supabase as any)
        .from("order_items")
        .select("order_id, products!inner(seller_id)")
        .eq("products.seller_id", id);
      if (joinError) throw joinError;

      const orderIds = Array.from(
        new Set((joinItems || []).map((it: any) => it.order_id).filter(Boolean)),
      ) as string[];
      if (orderIds.length === 0) return [] as ReturnOrder[];

      const { data: returns, error: returnsError } = await (supabase as any)
        .from("returns")
        .select("*")
        .in("order_id", orderIds)
        .neq("return_status", "cancelled")
        .order("requested_at", { ascending: false });
      if (returnsError) throw returnsError;

      const returnRows = (returns || []) as any[];
      if (returnRows.length === 0) return [] as ReturnOrder[];

      const returnOrderIds = Array.from(new Set(returnRows.map((r) => r.order_id).filter(Boolean))) as string[];
      const { data: ordersData, error: ordersError } = await (supabase as any)
        .from("orders")
        .select("id, order_id, customer_name, customer_phone, customer_address, customer_email, status, total, created_at")
        .in("id", returnOrderIds);
      if (ordersError) throw ordersError;

      const orderById = new Map<string, any>();
      (ordersData || []).forEach((o: any) => orderById.set(o.id as string, o));

      const parseVariantInfo = (value: any): any | null => {
        if (!value) return null;
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        }
        if (typeof value === "object") return value;
        return null;
      };

      const extractVariantId = (variantInfo: any): string | null => {
        const v = parseVariantInfo(variantInfo);
        if (!v) return null;
        const id = (v as any).variant_id;
        return id ? String(id) : null;
      };

      const buildVariantLabel = (variantInfo: any): string | null => {
        const v = parseVariantInfo(variantInfo);
        if (!v) return null;
        const name = (v as any).attribute_name || (v as any).attribute;
        const value = (v as any).attribute_value || (v as any).value_name || (v as any).value;
        if (!name || !value) return null;
        return `${String(name)}: ${String(value)}`;
      };

      let sellerOrderItems: any[] = [];
      const { data: snapshotItems, error: snapshotError } = await (supabase as any)
        .from("order_items")
        .select("id, order_id, product_id, quantity, product_name, product_price, variant_info, seller_id")
        .in("order_id", returnOrderIds)
        .eq("seller_id", id);
      if (!snapshotError) {
        sellerOrderItems = (snapshotItems || []) as any[];
        const { data: joinOrderItems, error: joinOrderItemsError } = await (supabase as any)
          .from("order_items")
          .select("id, order_id, product_id, quantity, product_name, product_price, variant_info, products!inner(seller_id)")
          .in("order_id", returnOrderIds)
          .eq("products.seller_id", id);
        if (joinOrderItemsError) throw joinOrderItemsError;
        const byId = new Map<string, any>();
        sellerOrderItems.forEach((it) => byId.set(String(it.id), it));
        (joinOrderItems || []).forEach((it: any) => {
          const key = String(it.id);
          if (!byId.has(key)) byId.set(key, it);
        });
        sellerOrderItems = Array.from(byId.values());
      } else {
        const { data: joinOrderItems, error: joinOrderItemsError } = await (supabase as any)
          .from("order_items")
          .select("id, order_id, product_id, quantity, product_name, product_price, variant_info, products!inner(seller_id)")
          .in("order_id", returnOrderIds)
          .eq("products.seller_id", id);
        if (joinOrderItemsError) throw joinOrderItemsError;
        sellerOrderItems = (joinOrderItems || []) as any[];
      }

      const productIds = Array.from(new Set(sellerOrderItems.map((it) => it.product_id).filter(Boolean))) as string[];
      const { data: productRows, error: productRowsError } = productIds.length
        ? await (supabase as any).from("products").select("id, name, image_url, images").in("id", productIds)
        : ({ data: [] as any[], error: null } as any);
      if (productRowsError) throw productRowsError;

      const productById = new Map<string, any>();
      (productRows || []).forEach((p: any) => productById.set(String(p.id), p));

      const productImageFor = (pid: string): string | null => {
        const p = productById.get(pid);
        const first = Array.isArray(p?.images) ? p.images.find(Boolean) : null;
        return (first as any) || p?.image_url || null;
      };

      const variantIds = Array.from(
        new Set(
          sellerOrderItems
            .map((it) => extractVariantId(it.variant_info))
            .filter(Boolean),
        ),
      ) as string[];

      const variantImageById = new Map<string, string>();
      if (variantIds.length > 0) {
        const { data: variantsData, error: variantsError } = await (supabase as any)
          .from("product_variants")
          .select("id, image_urls")
          .in("id", variantIds);
        if (variantsError) throw variantsError;

        (variantsData || []).forEach((v: any) => {
          const raw = v.image_urls;
          const urls = Array.isArray(raw)
            ? raw
            : typeof raw === "string"
              ? (() => {
                  try {
                    const parsed = JSON.parse(raw);
                    return Array.isArray(parsed) ? parsed : [];
                  } catch {
                    return [];
                  }
                })()
              : [];
          const first = urls.find(Boolean);
          if (first) variantImageById.set(String(v.id), String(first));
        });
      }

      const itemsByOrderId = new Map<string, any[]>();
      sellerOrderItems.forEach((it: any) => {
        const oid = String(it.order_id);
        if (!itemsByOrderId.has(oid)) itemsByOrderId.set(oid, []);
        itemsByOrderId.get(oid)!.push(it);
      });

      const resolveReturnImageUrl = (raw: string): string => {
        const value = String(raw || "").trim();
        if (!value) return value;
        if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
        const withoutBucketPrefix = value.startsWith("return-images/")
          ? value.slice("return-images/".length)
          : value;
        const { data } = supabase.storage.from("return-images").getPublicUrl(withoutBucketPrefix);
        return data.publicUrl || value;
      };

      const normalizeImages = (value: any): string[] | null => {
        if (!value) return null;
        if (Array.isArray(value)) return value.filter(Boolean).map((v) => resolveReturnImageUrl(String(v)));
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
              ? parsed.filter(Boolean).map((v: any) => resolveReturnImageUrl(String(v)))
              : null;
          } catch {
            return null;
          }
        }
        return null;
      };

      return returnRows.map((ret: any) => {
        const order = orderById.get(ret.order_id as string);
        const orderDetails = order
          ? {
              order_id: order.order_id,
              customer_name: order.customer_name,
              customer_phone: order.customer_phone,
              customer_address: order.customer_address,
              customer_email: order.customer_email ?? null,
              status: order.status,
              total: Number(order.total || 0),
              created_at: order.created_at,
            }
          : {
              order_id: ret.order_id,
              customer_name: ret.customer_name,
              customer_phone: ret.customer_phone,
              customer_address: ret.customer_address,
              customer_email: null,
              status: "N/A",
              total: 0,
              created_at: ret.requested_at,
            };

        const returnItems = (itemsByOrderId.get(String(ret.order_id)) || []).map((it: any) => {
          const pid = String(it.product_id);
          const variantId = extractVariantId(it.variant_info);
          const variantImage = variantId ? variantImageById.get(variantId) || null : null;
          const baseImage = productImageFor(pid);
          return {
            order_item_id: String(it.id),
            product_id: pid,
            product_name: String(it.product_name || productById.get(pid)?.name || "Product"),
            quantity: Number(it.quantity || 0),
            image_url: variantImage || baseImage,
            variant_id: variantId,
            variant_label: buildVariantLabel(it.variant_info),
          };
        });

        return {
          ...ret,
          images: normalizeImages(ret.images),
          customer_name: orderDetails.customer_name,
          customer_phone: orderDetails.customer_phone,
          customer_address: orderDetails.customer_address,
          customer_email: orderDetails.customer_email ?? null,
          order_details: orderDetails,
          returned_items: returnItems,
        };
      }) as unknown as ReturnOrder[];
    },
    enabled: !!(seller?.id || sellerId),
  });

  useEffect(() => {
    if (!orders || orders.length === 0) {
      setOrderItems({});
      return;
    }
    const loadItems = async () => {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orders.map(o => o.id));
      if (data) {
        const byOrder: Record<string, any[]> = {};
        data.forEach(item => {
          const pid = (item as any).product_id as string;
          const product = (products || []).find(p => p.id === pid);
          if (!product) return;
          const entry = {
            id: (item as any).id as string,
            order_id: (item as any).order_id as string,
            product_id: pid,
            quantity: (item as any).quantity as number,
            product_name: product.name,
            product_price: Number(product.price),
            variant_info: (item as any).variant_info as any,
          };
          const oid = (item as any).order_id as string;
          if (!byOrder[oid]) byOrder[oid] = [];
          byOrder[oid].push(entry);
        });
        setOrderItems(byOrder);
      }
    };
    loadItems();
  }, [orders, products]);

  const getProductById = (id: string) => {
    return (products || []).find(p => p.id === id);
  };

  const addFeature = () => {
    setProductForm({
      ...productForm,
      features: [...productForm.features, { feature: "" }],
    });
  };
  const removeFeature = (index: number) => {
    const newFeatures = [...productForm.features];
    newFeatures.splice(index, 1);
    setProductForm({
      ...productForm,
      features: newFeatures,
    });
  };
  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...productForm.features];
    newFeatures[index] = { feature: value };
    setProductForm({
      ...productForm,
      features: newFeatures,
    });
  };

  useEffect(() => {
    if (seller && (!seller.is_active || seller.is_banned)) {
      toast.error("Access restricted");
      handleLogout();
    }
  }, [seller, handleLogout]);

  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      detailed_description: "",
      price: "",
      discount_percentage: "0",
      stock_status: "in_stock",
      stock_quantity: "0",
      category_id: "",
      main_category_id: "",
      cash_on_delivery: false,
      features: [{ feature: "" }],
      height: "",
      width: "",
      weight: "",
      brand: "",
      brand_logo_url: "",
      seller_name: seller?.name || sellerName || "",
      seller_description: "",
      gst_percentage: "",
    });
    setProductImages([]);
    setHasVariantImages(false);
    setEditingProduct(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    (async () => {
      let mainCatId = "";
      if (product.category_id) {
        const adminCat = (categories || []).find(c => c.id === product.category_id);
        if (adminCat) mainCatId = product.category_id;
        else {
          const localVal = (sellerCategoryValues || []).find(c => c.id === product.category_id);
          if (localVal) mainCatId = localVal.parent_id || "";
          else {
            try {
              const { data: catData } = await supabase.from("categories").select("parent_id").eq("id", product.category_id).maybeSingle();
              if (catData && (catData as any).parent_id) mainCatId = (catData as any).parent_id;
            } catch (e) {
              // ignore
            }
          }
        }
      }
      setProductForm({
      name: product.name || "",
      description: product.description || "",
      detailed_description: product.detailed_description || "",
      price: String(product.price ?? ""),
      discount_percentage: String(product.discount_percentage ?? "0"),
      stock_status: product.stock_status || "in_stock",
      stock_quantity: String(product.stock_quantity ?? "0"),
      category_id: product.category_id || "",
      main_category_id: mainCatId,
      cash_on_delivery: Boolean(product.cash_on_delivery),
      features: Array.isArray(product.features) ? product.features : [{ feature: "" }],
      height: product.height || "",
      width: product.width || "",
      weight: product.weight || "",
      brand: product.brand || "",
      brand_logo_url: product.brand_logo_url || "",
      seller_name: seller?.name || sellerName || "",
      seller_description: product.seller_description || "",
      gst_percentage: product.gst_percentage != null ? String(product.gst_percentage) : "",
      });
    })();
    setProductImages(product.images || (product.image_url ? [product.image_url] : []));
    setHasVariantImages(false);
    setProductDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = 8 - productImages.length;
    if (files.length > remainingSlots) {
      toast.error(`You can only upload ${remainingSlots} more image(s)`);
      return;
    }
    setUploadingImages(true);
    const newImages: string[] = [];
    try {
      for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
        newImages.push(publicUrl);
      }
      setProductImages([...productImages, ...newImages]);
      toast.success("Images uploaded successfully!");
    } catch {
      toast.error("Failed to upload images");
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setProductImages(productImages.filter((_, i) => i !== index));
  };

  const handleBrandLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingBrandLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `brand-logo-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setProductForm({ ...productForm, brand_logo_url: publicUrl });
      toast.success("Brand logo uploaded successfully!");
    } catch {
      toast.error("Failed to upload brand logo");
    } finally {
      setUploadingBrandLogo(false);
      if (brandLogoInputRef.current) brandLogoInputRef.current.value = "";
    }
  };

  const productMutation = useMutation({
    mutationFn: async (product: typeof productForm & { id?: string }) => {
      const activeSellerId = seller?.id || sellerId;
      const activeSellerName = seller?.name || sellerName;

      if (!activeSellerId || !activeSellerName) throw new Error("Seller not detected");
      const rawQty = parseInt(product.stock_quantity) || 0;
      const normalizedStockStatus = rawQty <= 0
        ? "sold_out"
        : product.stock_status === "sold_out"
          ? "sold_out"
          : "in_stock";
      const data = {
        name: product.name,
        description: product.description || null,
        price: parseFloat(product.price),
        discount_percentage: parseInt(product.discount_percentage) || 0,
        image_url: productImages[0] || null,
        images: productImages,
        stock_status: normalizedStockStatus,
        stock_quantity: rawQty,
        category_id: product.category_id || product.main_category_id || null,
        cash_on_delivery: Boolean(product.cash_on_delivery),
        features: product.features,
        detailed_description: product.detailed_description || null,
        dimensions: product.height || product.width || product.weight
          ? `${product.height || ""} x ${product.width || ""} x ${product.weight || ""}`.replace(/x\\s*x/g, "x").replace(/^\\s*x\\s*|\\s*x\\s*$/g, "") || null
          : null,
        height: product.height || null,
        width: product.width || null,
        weight: product.weight || null,
        brand: product.brand || null,
        brand_logo_url: product.brand_logo_url || null,
        seller_name: activeSellerName,
        seller_description: product.seller_description || null,
        gst_percentage: product.gst_percentage ? parseFloat(product.gst_percentage) : null,
        seller_id: activeSellerId,
      };
      if (product.id) {
        const { error } = await supabase.from("products").update(data).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const activeSellerId = seller?.id || sellerId;
      queryClient.invalidateQueries({ queryKey: ["seller-products", activeSellerId] });
      toast.success(editingProduct ? "Product updated!" : "Product added!");
      resetProductForm();
      setProductDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error saving product:", error);
      toast.error(`Failed to save product: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders", seller?.id || sellerId] });
      toast.success("Order status updated!");
    },
    onError: (error) => {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
    },
  });

  const updateOrderDeliveryBoyMutation = useMutation({
    mutationFn: async ({ id, delivery_boy_id }: { id: string; delivery_boy_id: string | null }) => {
      const { error } = await supabase.from("orders" as any).update({ delivery_boy_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders", seller?.id || sellerId] });
      toast.success("Delivery boy assignment updated!");
    },
    onError: (error) => {
      console.error("Error updating delivery boy assignment:", error);
      toast.error("Failed to update delivery boy assignment");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("orders")
        .update({ seller_deleted: true, seller_deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders", seller?.id || sellerId] });
      toast.success("Order removed from your list");
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("Failed to remove order");
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const activeSellerId = seller?.id || sellerId;
      if (!activeSellerId) throw new Error("Seller not detected");
      const { error } = await (supabase as any).from("products").delete().eq("id", id).eq("seller_id", activeSellerId);
      if (error) throw error;
    },
    onSuccess: () => {
      const activeSellerId = seller?.id || sellerId;
      queryClient.invalidateQueries({ queryKey: ["seller-products", activeSellerId] });
      toast.success("Product deleted!");
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast.error(`Failed to delete product: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
  });

  const handleStatusChange = (order: Order, newStatus: string) => {
    if (order.status === 'cancelled') {
      toast.error("Cannot modify status of a cancelled order");
      return;
    }
    
    if (newStatus === 'cancelled') {
      setOrderToCancel(order);
      setCancelOrderIdInput("");
      setCancelDialogOpen(true);
      return;
    }
    
    updateOrderMutation.mutate({ id: order.id, status: newStatus });
  };

  const confirmCancellation = () => {
    if (!orderToCancel) return;
    
    if (cancelOrderIdInput !== orderToCancel.order_id) {
      toast.error("Order ID does not match");
      return;
    }
    
    updateOrderMutation.mutate({ id: orderToCancel.id, status: 'cancelled' });
    setCancelDialogOpen(false);
    setOrderToCancel(null);
    setCancelOrderIdInput("");
  };

  if (!isSellerLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-8 h-8 text-primary" />
            <span className="font-display text-xl font-bold gradient-gold-text">
              Seller Dashboard
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm mr-4">
              {sellerName}
            </span>
            <Button variant="royalOutline" size="sm" onClick={handleLogout} className="px-2 py-1 text-sm">
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as TabValue)}>
          {/* Mobile sidebar */}
          <div className="sm:hidden mb-4">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="royalOutline" size="sm" className="w-full justify-start">
                  <Menu className="w-4 h-4 mr-2" />
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="p-4 border-b border-border/50">
                  <SheetTitle>Seller Menu</SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <div className="grid gap-2">
                    <Button
                      variant={activeTab === "products" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("products"); setMobileMenuOpen(false); }}
                    >
                      <Package className="w-4 h-4 mr-2" /> Products
                    </Button>
                    <Button
                      variant={activeTab === "attributes" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("attributes"); setMobileMenuOpen(false); }}
                    >
                      <Tag className="w-4 h-4 mr-2" /> Attributes
                    </Button>
                    <Button
                      variant={activeTab === "orders" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("orders"); setMobileMenuOpen(false); }}
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" /> Orders
                    </Button>
                    <Button
                      variant={activeTab === "customer-history" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("customer-history"); setMobileMenuOpen(false); }}
                    >
                      <Calendar className="w-4 h-4 mr-2" /> Customer History
                    </Button>
                    <Button
                      variant={activeTab === "sales" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("sales"); setMobileMenuOpen(false); }}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" /> Sales
                    </Button>
                    <Button
                      variant={activeTab === "reviews" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("reviews"); setMobileMenuOpen(false); }}
                    >
                      <Star className="w-4 h-4 mr-2" /> Reviews
                    </Button>
                    <Button
                      variant={activeTab === "delivery-boys" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("delivery-boys"); setMobileMenuOpen(false); }}
                    >
                      <Package className="w-4 h-4 mr-2" /> Delivery Boys
                    </Button>
                    <Button
                      variant={activeTab === "return-orders" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("return-orders"); setMobileMenuOpen(false); }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Return Orders
                    </Button>
                    <Button
                      variant={activeTab === "categories" ? "royal" : "ghost"}
                      className="justify-start"
                      onClick={() => { setActiveTab("categories"); setMobileMenuOpen(false); }}
                    >
                      <Tag className="w-4 h-4 mr-2" /> Categories
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop tabs */}
          <TabsList className="hidden sm:flex w-max min-w-full sm:min-w-max gap-2 sm:flex-row sm:items-center mb-6">
            <TabsTrigger value="products" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <Package className="w-4 h-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="attributes" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <Tag className="w-4 h-4" />
              Attributes
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <ShoppingBag className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="customer-history" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <Calendar className="w-4 h-4" />
              Customer History
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <TrendingUp className="w-4 h-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <Star className="w-4 h-4" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="delivery-boys" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <Package className="w-4 h-4" />
              Delivery Boys
            </TabsTrigger>
            <TabsTrigger value="return-orders" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <RefreshCw className="w-4 h-4" />
              Return Orders
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2 whitespace-nowrap w-full justify-start sm:w-auto sm:justify-center">
              <Tag className="w-4 h-4" />
              Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Your Products</h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => refetchProducts()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Dialog
                  open={productDialogOpen}
                  onOpenChange={(open) => {
                    setProductDialogOpen(open);
                    if (!open) resetProductForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="royal">Add Product</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="font-display">
                        {editingProduct ? "Edit Product" : "Add New Product"}
                      </DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        productMutation.mutate({
                          ...productForm,
                          id: editingProduct?.id,
                        });
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                          id="name"
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          placeholder="Enter product name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={productForm.description}
                          onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                          placeholder="Enter product description"
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="detailed_description">Detailed Description</Label>
                        <Textarea
                          id="detailed_description"
                          value={productForm.detailed_description}
                          onChange={(e) => setProductForm({ ...productForm, detailed_description: e.target.value })}
                          placeholder="Enter detailed product description"
                          className="mt-1"
                          rows={4}
                        />
                      </div>
                      <div>
                        <Label>Features</Label>
                        <div className="space-y-2 mt-1">
                          {productForm.features.map((feature, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={feature.feature}
                                onChange={(e) => updateFeature(index, e.target.value)}
                                placeholder="Enter a feature"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeFeature(index)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" onClick={addFeature} className="w-full">
                            <X className="w-4 h-4 mr-2" />
                            Add Feature
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brand">Brand</Label>
                        <Input
                          id="brand"
                          value={productForm.brand}
                          onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                          placeholder="e.g., Nike, Apple, Samsung"
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="brand_logo">Brand Logo</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => brandLogoInputRef.current?.click()}
                            disabled={uploadingBrandLogo}
                            className="w-full"
                          >
                            {uploadingBrandLogo ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Choose Brand Logo
                              </>
                            )}
                          </Button>
                          {productForm.brand_logo_url && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setProductForm({ ...productForm, brand_logo_url: "" })}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {productForm.brand_logo_url && (
                          <div className="mt-2 flex items-center gap-2">
                            <img
                              src={productForm.brand_logo_url}
                              alt="Brand Logo"
                              className="w-12 h-12 rounded-full object-cover border border-border"
                            />
                            <span className="text-xs text-muted-foreground">Logo uploaded</span>
                          </div>
                        )}
                        <input
                          ref={brandLogoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBrandLogoUpload}
                          className="hidden"
                          id="brand_logo"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="height">Height</Label>
                          <Input
                            id="height"
                            value={productForm.height}
                            onChange={(e) => setProductForm({ ...productForm, height: e.target.value })}
                            placeholder="e.g., 10 cm"
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="width">Width</Label>
                          <Input
                            id="width"
                            value={productForm.width}
                            onChange={(e) => setProductForm({ ...productForm, width: e.target.value })}
                            placeholder="e.g., 5 cm"
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="weight">Weight</Label>
                          <Input
                            id="weight"
                            value={productForm.weight}
                            onChange={(e) => setProductForm({ ...productForm, weight: e.target.value })}
                            placeholder="e.g., 2 kg"
                            className="mt-1 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="seller_description">Seller Description</Label>
                        <Textarea
                          id="seller_description"
                          value={productForm.seller_description}
                          onChange={(e) => setProductForm({ ...productForm, seller_description: e.target.value })}
                          placeholder="Tell us about the seller"
                          className="mt-1 text-sm min-h-[80px]"
                        />
                      </div>
                      <div>
                        <Label htmlFor="gst_percentage">GST (%)</Label>
                        <Input
                          id="gst_percentage"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={productForm.gst_percentage}
                          onChange={(e) => setProductForm({ ...productForm, gst_percentage: e.target.value })}
                          placeholder="e.g., 18"
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="price">Price (₹) *</Label>
                          <Input
                            id="price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.price}
                            onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                            placeholder="0.00"
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="discount">Discount (%)</Label>
                          <Input
                            id="discount"
                            type="number"
                            min="0"
                            max="100"
                            value={productForm.discount_percentage}
                            onChange={(e) => setProductForm({ ...productForm, discount_percentage: e.target.value })}
                            placeholder="0"
                            className="mt-1 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="stock_status">Stock Status</Label>
                          <Select
                            value={productForm.stock_status}
                            onValueChange={(value) => setProductForm({ ...productForm, stock_status: value })}
                          >
                            <SelectTrigger className="mt-1 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in_stock">In Stock</SelectItem>
                              <SelectItem value="low_stock">Low Stock</SelectItem>
                              <SelectItem value="sold_out">Out of Stock</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="stock_quantity">Stock Quantity</Label>
                          <Input
                            id="stock_quantity"
                            type="number"
                            min="0"
                            value={productForm.stock_quantity}
                            onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                            placeholder="0"
                            className="mt-1 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <div>
                          <Label>Main Category (admin)</Label>
                          <Select
                            value={productForm.main_category_id}
                            onValueChange={(value) => setProductForm({ ...productForm, main_category_id: value, category_id: "" })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select main category" />
                            </SelectTrigger>
                            <SelectContent>
                              {(categories || []).map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Label className="mt-3">Your Category (value)</Label>
                          <Select
                            value={productForm.category_id || (productForm.main_category_id || "")}
                            onValueChange={(value) => {
                              if (value === "use-main") {
                                setProductForm({ ...productForm, category_id: productForm.main_category_id || "" });
                              } else {
                                setProductForm({ ...productForm, category_id: value });
                              }
                            }}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select your category (or use main)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="use-main">Use main category</SelectItem>
                              {((sellerCategoryValues || []).filter((v: any) => v.parent_id === productForm.main_category_id)).map((val: any) => (
                                <SelectItem key={val.id} value={val.id}>{val.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <Switch
                          checked={productForm.cash_on_delivery}
                          onCheckedChange={(checked) =>
                            setProductForm({ ...productForm, cash_on_delivery: Boolean(checked) })
                          }
                        />
                        <Label>Enable Cash on Delivery</Label>
                      </div>
                      {!hasVariantImages && (
                        <div>
                          <Label>Product Images (Max 8)</Label>
                          <div className="mt-2 space-y-3">
                            {productImages.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {productImages.map((url, index) => (
                                  <div key={index} className="relative aspect-square">
                                    <img
                                      src={url}
                                      alt={`Product ${index + 1}`}
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeImage(index)}
                                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {productImages.length < 8 && (
                              <div>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleImageUpload}
                                  className="hidden"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full text-sm"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={uploadingImages}
                                >
                                  {uploadingImages ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                  )}
                                  Upload Images ({productImages.length}/8)
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {editingProduct && (
                        <ProductVariantsEditor
                          productId={editingProduct.id}
                          basePrice={parseFloat(productForm.price) || 0}
                          onVariantImagesStatusChange={setHasVariantImages}
                          sellerId={seller?.id || sellerId || undefined}
                        />
                      )}
                      <Button type="submit" variant="royal" className="w-full">
                        {editingProduct ? "Update Product" : "Add Product"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {productsLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
            ) : products && products.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {product.images?.[0] || product.image_url ? (
                        <img
                          src={product.images?.[0] || product.image_url || ""}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold truncate">{product.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="font-medium">₹{Number(product.price).toFixed(2)}</span>
                        {product.discount_percentage && product.discount_percentage > 0 && (
                          <span className="text-green-600">-{product.discount_percentage}%</span>
                        )}
                        {(() => {
                          const qty = Number(product.stock_quantity || 0);
                          const soldOut = product.stock_status === "sold_out" || qty <= 0;
                          const lowStock = !soldOut && qty > 0 && qty <= 10;
                          return (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs",
                            soldOut && "bg-red-500/10 text-red-600",
                            lowStock && "bg-yellow-500/10 text-yellow-600",
                            !soldOut && !lowStock && "bg-green-500/10 text-green-600"
                          )}
                        >
                          {(product.stock_quantity || 0)} left
                        </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteProductMutation.mutate(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border/50">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No products yet. Add your first product!</p>
              </div>
            )}
          </TabsContent>

          {/* Categories tab removed for sellers. Admin manages categories; sellers select from admin categories when adding products. */}

          <TabsContent value="attributes" className="space-y-6">
            <AttributesManager sellerId={sellerId || undefined} />
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">Sales Analytics</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">View Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const selected = Number(e.target.value);
                    const currentYear = new Date().getFullYear();
                    if (selected <= currentYear) {
                      setSelectedYear(selected);
                    } else {
                      toast.error(`Cannot select year ${selected}. Future years are not allowed.`);
                    }
                  }}
                  className="px-3 py-1 border rounded-md bg-card text-sm"
                >
                  {(() => {
                    // Get all years with sales data and include current year
                    const currentYear = new Date().getFullYear();
                    const availableYears = new Set<number>([currentYear]);
                    
                    if (orders && orders.length > 0) {
                      orders.forEach(order => {
                        if (order.status !== 'cancelled') {
                          const orderYear = new Date(order.created_at).getFullYear();
                          availableYears.add(orderYear);
                        }
                      });
                    }
                    
                    // Convert to sorted array in descending order
                    const sortedYears = Array.from(availableYears).sort((a, b) => b - a);
                    
                    return sortedYears.map(year => (
                      <option key={year} value={year}>
                        {year}
                        {year === currentYear && " (Current)"}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">This Month ({selectedYear})</span>
                </div>
                <p className="text-3xl font-bold">
                  ₹{orders?.filter(o => {
                    const orderDate = new Date(o.created_at);
                    const now = new Date();
                    return orderDate.getMonth() === now.getMonth() && 
                           orderDate.getFullYear() === selectedYear &&
                           o.status !== 'cancelled';
                  }).reduce((sum, o) => sum + Number(o.total), 0).toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {orders?.filter(o => {
                    const orderDate = new Date(o.created_at);
                    const now = new Date();
                    return orderDate.getMonth() === now.getMonth() && 
                           orderDate.getFullYear() === selectedYear &&
                           o.status !== 'cancelled';
                  }).length || 0} orders
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">Year {selectedYear}</span>
                </div>
                <p className="text-3xl font-bold">
                  ₹{orders?.filter(o => {
                    const orderDate = new Date(o.created_at);
                    return orderDate.getFullYear() === selectedYear &&
                           o.status !== 'cancelled';
                  }).reduce((sum, o) => sum + Number(o.total), 0).toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {orders?.filter(o => {
                    const orderDate = new Date(o.created_at);
                    return orderDate.getFullYear() === selectedYear &&
                           o.status !== 'cancelled';
                  }).length || 0} orders
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">All Time</span>
                </div>
                <p className="text-3xl font-bold">
                  ₹{orders?.filter(o => o.status !== 'cancelled')
                    .reduce((sum, o) => sum + Number(o.total), 0).toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {orders?.filter(o => o.status !== 'cancelled').length || 0} total orders
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">Avg Order</span>
                </div>
                <p className="text-3xl font-bold">
                  ₹{orders && orders.filter(o => o.status !== 'cancelled').length > 0
                    ? Math.round(orders.filter(o => o.status !== 'cancelled')
                        .reduce((sum, o) => sum + Number(o.total), 0) / 
                        orders.filter(o => o.status !== 'cancelled').length).toLocaleString()
                    : 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">per order</p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border/50 p-6">
              <h3 className="font-display text-lg font-bold mb-4">Monthly Sales ({selectedYear})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthName = new Date(selectedYear, i).toLocaleString('default', { month: 'short' });
                  const monthSales = orders?.filter(o => {
                    const orderDate = new Date(o.created_at);
                    return orderDate.getMonth() === i && 
                           orderDate.getFullYear() === selectedYear &&
                           o.status !== 'cancelled';
                  }).reduce((sum, o) => sum + Number(o.total), 0) || 0;
                  const monthOrders = orders?.filter(o => {
                    const orderDate = new Date(o.created_at);
                    return orderDate.getMonth() === i && 
                           orderDate.getFullYear() === selectedYear &&
                           o.status !== 'cancelled';
                  }).length || 0;
                  const isCurrentMonth = i === new Date().getMonth() && selectedYear === new Date().getFullYear();
                  
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "p-4 rounded-lg border",
                        isCurrentMonth ? "border-primary bg-primary/5" : "border-border/50"
                      )}
                    >
                      <p className={cn(
                        "text-sm font-medium mb-1",
                        isCurrentMonth ? "text-primary" : "text-muted-foreground"
                      )}>
                        {monthName}
                      </p>
                      <p className="text-xl font-bold">₹{monthSales.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{monthOrders} orders</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border/50 p-6">
              <h3 className="font-display text-lg font-bold mb-4">Yearly Sales Comparison</h3>
              <div className="space-y-4">
                {(() => {
                  const yearlyData = orders?.reduce((acc, order) => {
                    if (order.status === 'cancelled') return acc;
                    const year = new Date(order.created_at).getFullYear();
                    if (!acc[year]) {
                      acc[year] = { total: 0, count: 0 };
                    }
                    acc[year].total += Number(order.total);
                    acc[year].count += 1;
                    return acc;
                  }, {} as Record<number, { total: number; count: number }>) || {};
                  
                  const years = Object.keys(yearlyData).sort((a, b) => Number(b) - Number(a));
                  const maxTotal = Math.max(...Object.values(yearlyData).map(y => y.total), 1);
                  
                  if (years.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        No sales data available yet
                      </div>
                    );
                  }
                  
                  return years.map(year => {
                    const data = yearlyData[Number(year)];
                    const percentage = (data.total / maxTotal) * 100;
                    const isBestYear = data.total === maxTotal && years.length > 1;
                    const isSelectedYear = Number(year) === selectedYear;
                    
                    return (
                      <div key={year} className="space-y-2">
                        <div className="flex justify_between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{year}</span>
                            {isBestYear && (
                              <span className="px-2 py-0.5 text-xs rounded-full gradient-gold text-primary-foreground">
                                Best Year
                              </span>
                            )}
                            {isSelectedYear && !isBestYear && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                                Selected
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-bold">₹{data.total.toLocaleString()}</span>
                            <span className="text-sm text-muted-foreground ml-2">({data.count} orders)</span>
                          </div>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isBestYear ? "gradient-gold" : isSelectedYear ? "bg-primary" : "bg-primary/60"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Product Reviews</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  refetchProductReviewSummaries();
                  refetchSelectedProductReviews();
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {!products || products.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border/50">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Add products to see reviews.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display">Select Product</CardTitle>
                    <CardDescription>Choose a product to see its reviews</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedReviewProductId || ''}
                      onValueChange={(v) => {
                        setSelectedReviewProductId(v);
                        setSelectedReviewStars(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        {selectedReviewProduct ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-md overflow-hidden border border-border bg-muted flex-shrink-0">
                              {selectedReviewProductImageUrl ? (
                                <img
                                  src={selectedReviewProductImageUrl}
                                  alt={selectedReviewProduct.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                  Img
                                </div>
                              )}
                            </div>
                            <span className="truncate">{selectedReviewProduct.name}</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Select product" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-md overflow-hidden border border-border bg-muted flex-shrink-0">
                                {(p.images?.[0] || p.image_url) ? (
                                  <img
                                    src={(p.images?.[0] || p.image_url) as string}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                    Img
                                  </div>
                                )}
                              </div>
                              <span className="truncate">{p.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedReviewProduct && (
                      <div className="mt-4 rounded-lg border border-border/50 bg-[hsl(159.92deg,52.26%,28.54%,0.12)] px-3 py-2 flex items-center gap-2">
                        <div className="w-9 h-9 rounded-md overflow-hidden border border-border bg-background flex-shrink-0">
                          {selectedReviewProductImageUrl ? (
                            <img
                              src={selectedReviewProductImageUrl}
                              alt={selectedReviewProduct.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                              Img
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">Selected product</div>
                          <div className="font-medium truncate">{selectedReviewProduct.name}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedReviewProduct && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <Card className="md:col-span-1">
                      <CardHeader>
                        <CardTitle className="font-display text-lg">Summary</CardTitle>
                        <CardDescription>{selectedReviewProduct.name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3">
                          {renderStars(
                            productReviewSummaries?.[selectedReviewProduct.id]?.avg_rating ?? selectedAvgRating,
                            18
                          )}
                          <div>
                            <div className="text-sm text-muted-foreground">Average</div>
                            <div className="text-xl font-bold">
                              {(productReviewSummaries?.[selectedReviewProduct.id]?.avg_rating ?? selectedAvgRating).toFixed(1)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 text-sm text-muted-foreground">
                          Total reviews: {productReviewSummaries?.[selectedReviewProduct.id]?.review_count ?? selectedReviewsCount}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <CardTitle className="font-display text-lg">Rating Breakdown</CardTitle>
                            <CardDescription>Click a rating to filter</CardDescription>
                          </div>
                          {selectedReviewStars && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedReviewStars(null)}>
                              Clear
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {[5, 4, 3, 2, 1].map((star) => {
                            const count = selectedRatingCounts[star] || 0;
                            const pct = selectedReviewsCount ? Math.round((count / selectedReviewsCount) * 100) : 0;
                            return (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setSelectedReviewStars(star)}
                                className={cn(
                                  'w-full flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/40 transition-colors',
                                  selectedReviewStars === star && 'bg-muted/40'
                                )}
                              >
                                <div className="flex items-center gap-1 w-14">
                                  <span className="text-sm font-medium">{star}</span>
                                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                </div>
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="w-10 text-right text-sm text-muted-foreground">{count}</div>
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-lg">Reviews</CardTitle>
                      {selectedReviewStars && (
                        <div className="text-sm text-muted-foreground">Filtered: {selectedReviewStars}★</div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedReviewsLoading ? (
                      <div className="text-center py-10">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                      </div>
                    ) : filteredSelectedReviews.length ? (
                      <div className="space-y-4">
                        {filteredSelectedReviews.map((r) => (
                          <div key={r.id} className="rounded-lg border border-border/50 p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted flex-shrink-0">
                                {r.reviewer_avatar_url ? (
                                  <img src={r.reviewer_avatar_url} alt={r.reviewer_name || 'User'} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">User</div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{r.reviewer_name || 'Customer'}</div>
                                    <div className="mt-1 flex items-center gap-2">
                                      {renderStars(Number(r.rating) || 0, 14)}
                                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{r.description}</p>

                                {Array.isArray(r.product_review_images) && r.product_review_images.length > 0 && (
                                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {r.product_review_images.slice(0, 6).map((img, idx) => (
                                      <button
                                        key={`${r.id}_${idx}`}
                                        type="button"
                                        className="aspect-square rounded-md overflow-hidden border border-border bg-muted"
                                        onClick={() => {
                                          const photos = (r.product_review_images || []).map((x) => x.image_url);
                                          setPhotoViewerPhotos(photos);
                                          setPhotoViewerIndex(idx);
                                          setPhotoViewerOpen(true);
                                        }}
                                      >
                                        <img src={img.image_url} alt="Review" className="w-full h-full object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          {selectedReviewStars ? 'No reviews for this rating yet.' : 'No reviews for this product yet.'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="customer-history" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">Customer Order History</h2>
                <p className="text-sm text-muted-foreground">Email/phone se customer ka order history dekho.</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>See Customer Order History</CardTitle>
                <CardDescription>
                  Customer ka email/phone daal ke poora order history dekho (sab sellers ka).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      value={customerHistoryEmail}
                      onChange={(e) => setCustomerHistoryEmail(e.target.value)}
                      placeholder="customer@email.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input
                      value={customerHistoryPhone}
                      onChange={(e) => setCustomerHistoryPhone(e.target.value)}
                      placeholder="+91XXXXXXXXXX"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      variant="royal"
                      onClick={() => searchCustomerOrderHistory()}
                      disabled={customerHistoryLoading}
                      className="w-full"
                    >
                      {customerHistoryLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        "Search"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setCustomerHistoryEmail("");
                        setCustomerHistoryPhone("");
                        setCustomerHistoryOrders([]);
                        setCustomerHistoryReturnRequests([]);
                        setCustomerHistorySearched(false);
                      }}
                      disabled={customerHistoryLoading}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {customerHistorySearched && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg border border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Total Orders</p>
                        <p className="font-display text-xl font-bold">{customerHistorySummary.totalOrders}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Delivered</p>
                        <p className="font-display text-xl font-bold">{customerHistorySummary.statusCounts["delivered"] || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Cancelled</p>
                        <p className="font-display text-xl font-bold">{customerHistorySummary.statusCounts["cancelled"] || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Return Requests</p>
                        <p className="font-display text-xl font-bold">
                          {customerHistorySummary.totalReturnRequests}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {customerHistorySummary.uniqueReturnOrders} orders
                        </p>
                      </div>
                    </div>

                    {customerHistoryOrders.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Is email/phone ke saath koi order nahi mila.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customerHistoryOrders.map((o: any) => (
                          <div key={o.id} className="p-3 rounded-lg border border-border bg-card">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="text-sm text-muted-foreground">Order ID</div>
                                <div className="font-semibold">{o.order_id}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(o.created_at).toLocaleString()}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-foreground">
                                  Status: {String(o.status || "N/A")}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-foreground">
                                  Total: ₹{Number(o.total || 0).toFixed(2)}
                                </span>
                                {o._latest_return && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-foreground">
                                    Return: {String(o._latest_return.return_status || "N/A")}
                                  </span>
                                )}
                              </div>
                            </div>
                            {Array.isArray(o._items) && o._items.length > 0 && (
                              <div className="mt-3 p-3 bg-muted/20 rounded-lg">
                                <div className="space-y-2">
                                  {o._items.map((it: any) => (
                                    <div key={it.id} className="flex items-center gap-3">
                                      <div className="w-12 h-12 rounded-md border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                                        {it.image_url ? (
                                          <img src={it.image_url} alt={it.product_name} className="w-full h-full object-cover" />
                                        ) : (
                                          <Package className="w-5 h-5 text-muted-foreground/60" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground truncate">{it.product_name}</p>
                                        {it.variant_label && <p className="text-xs text-muted-foreground">{it.variant_label}</p>}
                                        <p className="text-xs text-muted-foreground">Qty: {it.quantity}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold">Your Orders</h2>
                <Button variant="ghost" size="icon" onClick={() => refetchOrders()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Filter:</label>
                <select
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value as any)}
                  className="px-2 py-1 border rounded-md bg-card text-sm"
                >
                  <option value="all">All</option>
                  <option value="this_month">This Month</option>
                  <option value="by_month">By Month</option>
                  <option value="week_1">Week 1 (1-7)</option>
                  <option value="week_2">Week 2 (8-14)</option>
                  <option value="week_3">Week 3 (15-21)</option>
                  <option value="week_4">Week 4 (22-31)</option>
                  <option value="last_7">Last 7 Days</option>
                  <option value="custom">Custom Range</option>
                </select>

                {orderFilter === "by_month" && (
                  <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
                )}

                {orderFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                    <span className="text-sm">to</span>
                    <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
            {ordersLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
            ) : filteredOrders && filteredOrders.length > 0 ? (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const items = orderItems[order.id] || [];
                  return (
                    <div key={order.id} className="p-4 bg-card rounded-xl border border-border/50">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm" style={{color: 'hsl(0deg 0% 0%)'}}>Order ID</p>
                          <p className="font-display text-xl font-bold" style={{color: 'hsl(0deg 0% 0%)'}}>{order.order_id}</p>
                          <div className="mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
                              {order.payment_method === "online" ? "Online Payment" : "Cash on Delivery"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total</p>
                          <p className="font-display text-lg font-bold">₹{Number(order.total).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="mb-3 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium mb-2" style={{color: 'hsl(0deg 0% 0%)'}}>Products Ordered:</p>
                        <div className="space-y-2">
                          {items.map((item) => {
                            const product = getProductById(item.product_id);
                            const variantId = extractVariantIdValue(item.variant_info);
                            const variantImageUrl = variantId ? orderVariantImageById[variantId] : null;
                            const variantLabel = buildVariantLabelValue(item.variant_info);
                            const imageUrl = variantImageUrl || product?.images?.[0] || product?.image_url;
                            return (
                              <div key={item.id} className="flex gap-2 items-start">
                                {imageUrl ? (
                                  <img src={imageUrl} alt={item.product_name || ""} className="w-12 h-12 object-cover rounded-lg" />
                                ) : (
                                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                                    <Package className="w-5 h-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-base truncate">{item.product_name}</p>
                                  {variantLabel && <p className="text-sm">{variantLabel}</p>}
                                  {product?.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                                  )}
                                  <p className="text-sm text-muted-foreground">
                                    ₹{Number(item.product_price ?? product?.price ?? 0).toFixed(2)} × {item.quantity}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-3 mb-3">
                        <div>
                          <p className="text-sm" style={{color: 'hsl(0deg 0% 0%)'}}>Customer</p>
                          <p className="font-semibold text-base" style={{color: 'hsl(0deg 0% 0%)'}}>{order.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Address Details</p>
                          <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                            <p className="text-sm" style={{color: 'hsl(0deg 0% 0%)'}}>{order.customer_address}</p>
                            {order.customer_state && (
                              <p className="text-sm" style={{color: 'hsl(0deg 0% 0%)'}}>
                                <span className="font-medium">State:</span> {order.customer_state}
                                {order.customer_pincode && ` | Pincode: ${order.customer_pincode}`}
                              </p>
                            )}
                            {(order.customer_landmark1 || order.customer_landmark2 || order.customer_landmark3) && (
                              <div className="text-sm" style={{color: 'hsl(0deg 0% 0%)'}}>
                                <p className="font-medium" style={{color: 'hsl(0deg 0% 0%)'}}>Landmarks:</p>
                                {order.customer_landmark1 && <p style={{color: 'hsl(0deg 0% 0%)'}}>• {order.customer_landmark1}</p>}
                                {order.customer_landmark2 && <p style={{color: 'hsl(0deg 0% 0%)'}}>• {order.customer_landmark2}</p>}
                                {order.customer_landmark3 && <p style={{color: 'hsl(0deg 0% 0%)'}}>• {order.customer_landmark3}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/50">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Status</p>
                              <Select
                                value={order.status}
                                onValueChange={(value) => handleStatusChange(order, value)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="packed">Packed</SelectItem>
                                  <SelectItem value="shipped">Shipped</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Delivery Boy</p>
                              <Select
                                value={order.delivery_boy_id || ""}
                                onValueChange={(value) =>
                                  updateOrderDeliveryBoyMutation.mutate({ id: order.id, delivery_boy_id: value === "none" ? null : value })
                                }
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Unassigned" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {deliveryBoys?.map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.username || d.name || d.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  <MessageCircle className="w-4 h-4 mr-2" />
                                  Message
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Messages - {order.order_id}</DialogTitle>
                                  <DialogDescription>
                                    Send and receive messages related to order {order.order_id}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="h-60 overflow-y-auto space-y-3 bg-muted/30 rounded-lg p-4">
                                    {orderMessages[order.id] && orderMessages[order.id].length > 0 ? (
                                      orderMessages[order.id].map((msg) => (
                                        <div key={msg.id} className={cn("flex", (msg.is_admin || msg.is_delivery_boy) ? "justify-end" : "justify-start")}>
                                          <div className={cn(
                                            "max-w-[80%] px-4 py-2 rounded-2xl text-sm",
                                            (msg.is_admin || msg.is_delivery_boy)
                                              ? "bg-primary text-primary-foreground rounded-br-md"
                                              : "bg-muted rounded-bl-md"
                                          )}>
                                            <p>{msg.message}</p>
                                            <p className="text-xs opacity-70 mt-1">
                                              {new Date(msg.created_at).toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-center text-muted-foreground text-sm py-8">No messages yet</p>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Textarea
                                      value={newSellerMessage}
                                      onChange={(e) => setNewSellerMessage(e.target.value)}
                                      placeholder="Send update to customer..."
                                      className="min-h-[60px] resize-none"
                                    />
                                    <Button
                                      variant="royal"
                                      onClick={sendSellerMessage}
                                      disabled={sendingMessage || !newSellerMessage.trim()}
                                    >
                                      {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {(order.status === "delivered" || order.status === "cancelled") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteOrderMutation.mutate(order.id)}
                                disabled={deleteOrderMutation.isPending}
                                title="Delete order"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleString()}
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border/50">
                <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No orders found for this seller.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="delivery-boys" className="space-y-6">
            <DeliveryBoysManager sellerId={sellerId || undefined} />
          </TabsContent>
          <TabsContent value="return-orders" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold">Return Requests</h2>
                <Button variant="ghost" size="icon" onClick={() => refetchReturnOrders()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
                {/* Test button for photo viewer */}

              </div>
            </div>
            {returnOrdersLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
            ) : returnOrders && returnOrders.length > 0 ? (
              <div className="space-y-4">
                {returnOrders.map((returnOrder) => (
                  <div key={returnOrder.id} className="p-4 bg-card rounded-xl border border-border/50">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Return ID</p>
                        <p className="font-display text-xl font-bold text-foreground">{returnOrder.id.substring(0, 8)}...</p>
                        <p className="text-sm text-muted-foreground mt-2">Order ID</p>
                        <p className="font-medium text-sm text-foreground">
                          {returnOrder.order_details?.order_id
                            ? returnOrder.order_details.order_id
                            : `${returnOrder.order_id.substring(0, 8)}...`}
                        </p>
                        <div className="mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-foreground">
                            {returnOrder.return_status === 'requested' ? 'Pending Review' : returnOrder.return_status.charAt(0).toUpperCase() + returnOrder.return_status.slice(1)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Request Date</p>
                        <p className="font-display text-lg font-bold">{new Date(returnOrder.requested_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="mb-3 p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium mb-2 text-foreground">Return Reason:</p>
                      <p className="text-base">{returnOrder.return_reason}</p>
                      {returnOrder.return_reason.toLowerCase() === 'other' && returnOrder.admin_notes && (
                        <div className="mt-2 p-2 bg-background rounded border border-border">
                          <p className="text-sm font-medium text-muted-foreground">Please specify:</p>
                          <p className="text-sm">{returnOrder.admin_notes}</p>
                        </div>
                      )}
                    </div>

                    {returnOrder.returned_items && returnOrder.returned_items.length > 0 && (
                      <div className="mb-3 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium mb-2 text-foreground">Returned Product{returnOrder.returned_items.length !== 1 ? "s" : ""}:</p>
                        <div className="space-y-2">
                          {returnOrder.returned_items.map((it) => (
                            <div key={it.order_item_id} className="flex items-center gap-3 bg-background rounded-lg border border-border p-2">
                              <div className="w-16 h-16 rounded-md border border-border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                                {it.image_url ? (
                                  <img src={it.image_url} alt={it.product_name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-6 h-6 text-muted-foreground/60" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">{it.product_name}</p>
                                {it.variant_label && <p className="text-xs text-muted-foreground">{it.variant_label}</p>}
                                <p className="text-xs text-muted-foreground">Qty: {it.quantity}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Images Section */}
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const orderForInvoice: Order = {
                            id: returnOrder.order_details?.order_id || returnOrder.order_id,
                            order_id: returnOrder.order_details?.order_id || returnOrder.order_id,
                            customer_name: returnOrder.customer_name,
                            customer_phone: returnOrder.customer_phone,
                            customer_address: returnOrder.customer_address,
                            customer_email: returnOrder.customer_email || undefined,
                            status: returnOrder.order_details?.status || 'unknown',
                            payment_method: null,
                            total: returnOrder.order_details?.total || 0,
                            created_at: returnOrder.order_details?.created_at || returnOrder.requested_at,
                            updated_at: returnOrder.requested_at,
                            customer_state: null,
                            customer_pincode: null,
                            customer_landmark1: null,
                            customer_landmark2: null,
                            customer_landmark3: null,
                            delivery_boy_id: null,
                          };
                          const orderItemsForInvoice: OrderItem[] = (returnOrder.returned_items || []).map((item) => ({
                            id: item.order_item_id,
                            order_id: returnOrder.order_id,
                            product_id: item.product_id,
                            quantity: item.quantity,
                          }));
                          const productsMap: Record<string, Product> = {};
                          (returnOrder.returned_items || []).forEach((item) => {
                            productsMap[item.product_id] = {
                              id: item.product_id,
                              name: item.product_name,
                              description: null,
                              price: 0,
                              image_url: item.image_url,
                              stock_status: 'in_stock',
                              created_at: new Date().toISOString(),
                            };
                          });
                          generateInvoice(orderForInvoice, orderItemsForInvoice, productsMap);
                        }}
                      >
                        📄 View Invoice
                      </Button>
                    </div>
                    {returnOrder.images && returnOrder.images.length > 0 && (
                      <div className="mb-3 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium mb-2 text-foreground">Return Images:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {returnOrder.images.map((imageUrl, index) => (
                            <button
                              key={index}
                              type="button"
                              className="relative group w-full text-left"
                              onClick={() => {
                                setPhotoViewerPhotos(returnOrder.images);
                                setPhotoViewerIndex(index);
                                setPhotoViewerOpen(true);
                              }}
                            >
                              <img
                                src={imageUrl}
                                alt={`Return image ${index + 1}`}
                                className="w-full h-24 object-cover rounded-md border border-border cursor-pointer hover:opacity-90 transition-opacity"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-black/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs font-medium">Click to view</span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {returnOrder.images.length} image{returnOrder.images.length !== 1 ? 's' : ''} attached
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-3 mb-3">
                      <div>
                        <p className="text-sm text-foreground">Customer Details</p>
                        <p className="font-semibold text-base">{returnOrder.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{returnOrder.customer_phone}</p>
                        {returnOrder.customer_email && (
                          <p className="text-sm text-muted-foreground">{returnOrder.customer_email}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Address</p>
                        <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                          <p className="text-sm">{returnOrder.customer_address}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/50">
                      <div className="text-sm text-muted-foreground">
                        Requested: {new Date(returnOrder.requested_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border/50">
                <RefreshCw className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No return requests found.</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="categories" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">Product Categories</h2>
                <p className="text-sm text-muted-foreground">Admin-created categories (read-only)</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => refetchCategories && refetchCategories()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {(!categories || categories.length === 0) ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border/50">
                <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No categories available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {categories.map((category) => (
                  <div key={category.id} className="p-4 bg-card rounded-xl border border-border/50">
                    <div className="flex items-start gap-4">
                      {Boolean((category as any).image_url) && (
                        <img src={(category as any).image_url} alt={category.name} className="w-20 h-20 object-cover rounded-lg" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{category.name}</h3>
                            {category.description && <p className="text-sm text-muted-foreground line-clamp-2">{category.description}</p>}
                            <p className="text-xs text-muted-foreground mt-1">Order: {category.sort_order} {category.is_active ? '✓' : '✗'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Dialog open={valueDialogOpen && valueForm.parent_id === category.id && !editingValue} onOpenChange={(open) => { if (!open) { setValueDialogOpen(false); setValueForm({ name: "", description: "", parent_id: "" }); } }}>
                              <DialogTrigger asChild>
                                <Button variant="royal" size="sm" onClick={() => { setValueForm({ name: "", description: "", parent_id: category.id }); setEditingValue(null); setValueDialogOpen(true); }}>
                                  Add Value
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Add Value under {category.name}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                  <div>
                                    <Label>Name *</Label>
                                    <Input value={valueForm.name} onChange={(e) => setValueForm({ ...valueForm, name: e.target.value })} className="mt-1" />
                                  </div>
                                  <div>
                                    <Label>Description</Label>
                                    <Textarea value={valueForm.description} onChange={(e) => setValueForm({ ...valueForm, description: e.target.value })} className="mt-1" rows={3} />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button variant="royal" onClick={() => addValueMutation.mutate({ name: valueForm.name, description: valueForm.description, parent_id: category.id })} disabled={!valueForm.name || addValueMutation.isPending}>
                                      {addValueMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button variant="ghost" onClick={() => { setValueDialogOpen(false); setValueForm({ name: "", description: "", parent_id: "" }); }}>Cancel</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>

                        {/* Values list */}
                        <div className="mt-4">
                          <Label className="text-sm">Values</Label>
                          <div className="mt-2 space-y-2">
                            {(valuesByParent[category.id] || []).length === 0 ? (
                              <div className="text-sm text-muted-foreground">No values added by you</div>
                            ) : (
                              (valuesByParent[category.id] || []).map((val) => (
                                <div key={val.id} className="flex items-center justify-between gap-3 p-2 bg-background rounded">
                                  <div>
                                    <div className="text-sm font-medium">{val.name}</div>
                                    {val.description && <div className="text-xs text-muted-foreground">{val.description}</div>}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => { setEditingValue(val); setValueForm({ name: val.name, description: val.description || "", parent_id: val.parent_id || "" }); setValueDialogOpen(true); }}>
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteValueMutation.mutate(val.id)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Edit dialog for value */}
                    <Dialog open={valueDialogOpen && !!editingValue} onOpenChange={(open) => { if (!open) { setValueDialogOpen(false); setEditingValue(null); setValueForm({ name: "", description: "", parent_id: "" }); } }}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Value</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label>Name *</Label>
                            <Input value={valueForm.name} onChange={(e) => setValueForm({ ...valueForm, name: e.target.value })} className="mt-1" />
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Textarea value={valueForm.description} onChange={(e) => setValueForm({ ...valueForm, description: e.target.value })} className="mt-1" rows={3} />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="royal" onClick={() => editingValue && updateValueMutation.mutate({ id: editingValue.id, name: valueForm.name, description: valueForm.description })} disabled={!valueForm.name || updateValueMutation.isPending}>
                              {updateValueMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button variant="ghost" onClick={() => { setValueDialogOpen(false); setEditingValue(null); setValueForm({ name: "", description: "", parent_id: "" }); }}>Cancel</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
                  </Tabs>
      </main>
      
      {/* Photo Viewer Modal */}
      {photoViewerOpen && (
        <PhotoViewerModal
          photoUrls={photoViewerPhotos}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerOpen(false)}
        />
      )}

      {/* Cancellation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Cancellation</DialogTitle>
            <DialogDescription>
              To cancel this order, please enter the Order ID: <strong>{orderToCancel?.order_id}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Order ID</Label>
              <Input
                value={cancelOrderIdInput}
                onChange={(e) => setCancelOrderIdInput(e.target.value)}
                placeholder="Enter Order ID to confirm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmCancellation} disabled={!cancelOrderIdInput}>
                Confirm Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
