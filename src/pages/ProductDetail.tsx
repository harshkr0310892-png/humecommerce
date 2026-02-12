import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, ArrowLeft, Minus, Plus, Crown, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Share2, X, ZoomIn, Heart, Truck, BadgeCheck, ShieldCheck, RotateCcw, Star, ImagePlus, Trash2, Edit2 } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VariantSelector } from "@/components/products/VariantSelector";

interface SelectedVariant {
  id: string;
  price: number;
  stock_quantity: number;
  is_available: boolean;
  attribute_name: string;
  value_name: string;
  image_urls?: string[];
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState('description');
  const [isTabAnimating, setIsTabAnimating] = useState(false);
  const [tabAnimKey, setTabAnimKey] = useState(0);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [sellerExpanded, setSellerExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [sellerVisible, setSellerVisible] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const { addItem: addToWishlist, isInWishlist, removeItem: removeFromWishlist, clearNewItemFlag } = useWishlistStore();
  
  const isWishlisted = isInWishlist(id || "");
  const urlParams = useRef<URLSearchParams | null>(null);
  urlParams.current = new URLSearchParams(location.search);
  const initialVariantId = (urlParams.current.get("variant") || urlParams.current.get("variantId") || "").trim() || null;

  // Clear animation flag after initial render
  useEffect(() => {
    if (isWishlisted) {
      // Set a timeout to clear the animation flag
      const timer = setTimeout(() => {
        clearNewItemFlag(id || "");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isWishlisted, id, clearNewItemFlag]);

  // Check scroll position for tabs
  const checkScrollPosition = () => {
    if (tabsRef.current) {
      setCanScrollLeft(tabsRef.current.scrollLeft > 0);
      setCanScrollRight(
        tabsRef.current.scrollLeft < tabsRef.current.scrollWidth - tabsRef.current.clientWidth
      );
    }
  };

  // Scroll tabs left or right
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      if (direction === 'left') {
        tabsRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        tabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  // Check scroll position on mount and when tabs change
  useEffect(() => {
    checkScrollPosition();
    window.addEventListener('resize', checkScrollPosition);
    return () => window.removeEventListener('resize', checkScrollPosition);
  }, []);

  // Re-trigger animation when tab changes
  useEffect(() => {
    setTabAnimKey((k) => k + 1);
  }, [activeTab]);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: reviews, isLoading: reviewsLoading, refetch: refetchReviews } = useQuery({
    queryKey: ['product-reviews', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews' as any)
        .select('id, product_id, user_id, rating, description, reviewer_name, reviewer_avatar_url, created_at, product_review_images(image_url)')
        .eq('product_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const reviewsCount = reviews?.length || 0;
  const reviewsAverage = reviewsCount
    ? (reviews || []).reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviewsCount
    : 0;
  const ratingCounts = [1, 2, 3, 4, 5].reduce((acc, v) => {
    acc[v] = (reviews || []).filter((r) => Number(r.rating) === v).length;
    return acc;
  }, {} as Record<number, number>);

  const [activeReviewFilter, setActiveReviewFilter] = useState<number | null>(null);
  const filteredReviews = activeReviewFilter
    ? (reviews || []).filter((r) => Number(r.rating) === activeReviewFilter)
    : (reviews || []);

  const [reviewSessionUserId, setReviewSessionUserId] = useState<string | null>(null);
  const [reviewProfile, setReviewProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewDescription, setReviewDescription] = useState<string>('');
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [editingMyReview, setEditingMyReview] = useState(false);
  const [editRating, setEditRating] = useState<number>(0);
  const [editDescription, setEditDescription] = useState<string>('');
  const [editExistingImages, setEditExistingImages] = useState<{ url: string; remove: boolean }[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);
  const [updatingReview, setUpdatingReview] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setReviewSessionUserId(userId);
      if (!userId) {
        setReviewProfile(null);
        return;
      }
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', userId)
        .maybeSingle();
      setReviewProfile(profile || null);
    };
    load();
  }, []);

  useEffect(() => {
    let next: string[] = [];
    setReviewPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      next = reviewFiles.map((f) => URL.createObjectURL(f));
      return next;
    });
    return () => {
      next.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [reviewFiles]);

  const myExistingReview = reviewSessionUserId
    ? (reviews || []).find((r) => r.user_id === reviewSessionUserId)
    : null;

  useEffect(() => {
    if (!myExistingReview) {
      setEditingMyReview(false);
      setEditRating(0);
      setEditDescription('');
      setEditExistingImages([]);
      setEditNewFiles([]);
      return;
    }
    setEditRating(Number(myExistingReview.rating) || 0);
    setEditDescription(String(myExistingReview.description || ''));
    const imgs = Array.isArray(myExistingReview.product_review_images)
      ? myExistingReview.product_review_images.map((x: any) => ({ url: x.image_url as string, remove: false }))
      : [];
    setEditExistingImages(imgs);
  }, [myExistingReview]);

  useEffect(() => {
    let next: string[] = [];
    setEditNewPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      next = editNewFiles.map((f) => URL.createObjectURL(f));
      return next;
    });
    return () => {
      next.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [editNewFiles]);

  const getStoragePathFromPublicUrl = (url: string) => {
    const marker = '/storage/v1/object/public/product-review-images/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const renderStars = (value: number, size = 16) => {
    const full = Math.round(value * 10) / 10;
    const filledCount = Math.floor(full);
    const hasHalf = full - filledCount >= 0.5;
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const idx = i + 1;
          const isFilled = idx <= filledCount;
          const isHalf = !isFilled && hasHalf && idx === filledCount + 1;
          return (
            <span key={i} className="relative inline-flex" style={{ width: size, height: size }}>
              <Star className={cn('h-full w-full text-amber-400/60', (isFilled || isHalf) && 'text-amber-400')} />
              {(isFilled || isHalf) && (
                <Star
                  className={cn('absolute inset-0 h-full w-full text-amber-400 fill-amber-400', isHalf && 'overflow-hidden')}
                  style={isHalf ? ({ clipPath: 'inset(0 50% 0 0)' } as any) : undefined}
                />
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const onPickReviewImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const next = [...reviewFiles, ...incoming].slice(0, 6);
    setReviewFiles(next);
  };

  const removeReviewImage = (index: number) => {
    setReviewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onPickEditReviewImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const existingCount = editExistingImages.filter((x) => !x.remove).length;
    const allowed = Math.max(0, 6 - existingCount);
    const nextNew = [...editNewFiles, ...incoming].slice(0, allowed);
    setEditNewFiles(nextNew);
  };

  const removeEditNewImage = (index: number) => {
    setEditNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleRemoveExistingImage = (url: string) => {
    setEditExistingImages((prev) => prev.map((x) => (x.url === url ? { ...x, remove: !x.remove } : x)));
  };

  const deleteMyReview = async () => {
    if (!myExistingReview) return;
    setUpdatingReview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please login');
        window.location.href = '/auth';
        return;
      }
      if (myExistingReview.user_id !== session.user.id) {
        toast.error('Not allowed');
        return;
      }

      const urls: string[] = Array.isArray(myExistingReview.product_review_images)
        ? myExistingReview.product_review_images.map((x: any) => x.image_url as string)
        : [];
      const paths = urls.map(getStoragePathFromPublicUrl).filter(Boolean) as string[];
      if (paths.length) {
        await supabase.storage.from('product-review-images').remove(paths);
      }

      await supabase.from('product_review_images' as any).delete().eq('review_id', myExistingReview.id);
      const { error: delErr } = await supabase.from('product_reviews' as any).delete().eq('id', myExistingReview.id);
      if (delErr) throw delErr;

      toast.success('Review deleted');
      setEditingMyReview(false);
      setEditNewFiles([]);
      await refetchReviews();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete review');
    } finally {
      setUpdatingReview(false);
    }
  };

  const updateMyReview = async () => {
    if (!myExistingReview) return;
    setUpdatingReview(true);
    const newlyUploadedPaths: string[] = [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please login');
        window.location.href = '/auth';
        return;
      }
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!profile) {
        toast.error('Please create your profile first');
        window.location.href = '/profile';
        return;
      }

      if (!editRating || editRating < 1 || editRating > 5) {
        toast.error('Please select a rating');
        return;
      }
      if (!editDescription.trim()) {
        toast.error('Please write a description');
        return;
      }

      const remainingExisting = editExistingImages.filter((x) => !x.remove).length;
      const totalAfter = remainingExisting + editNewFiles.length;
      if (totalAfter < 1) {
        toast.error('Please keep or upload at least 1 image');
        return;
      }

      const { error: upErr } = await supabase
        .from('product_reviews' as any)
        .update({
          rating: editRating,
          description: editDescription.trim(),
          reviewer_name: profile.full_name,
          reviewer_avatar_url: profile.avatar_url,
        })
        .eq('id', myExistingReview.id);
      if (upErr) throw upErr;

      const removedUrls = editExistingImages.filter((x) => x.remove).map((x) => x.url);
      if (removedUrls.length) {
        await supabase
          .from('product_review_images' as any)
          .delete()
          .eq('review_id', myExistingReview.id)
          .in('image_url', removedUrls);
        const removedPaths = removedUrls.map(getStoragePathFromPublicUrl).filter(Boolean) as string[];
        if (removedPaths.length) {
          await supabase.storage.from('product-review-images').remove(removedPaths);
        }
      }

      const newUrls: string[] = [];
      for (const file of editNewFiles) {
        const ext = file.name.split('.').pop() || 'jpg';
        const rand = (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const path = `${myExistingReview.id}/${rand}.${ext}`;
        const { error: uploadError } = await supabase
          .storage
          .from('product-review-images')
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        newlyUploadedPaths.push(path);
        const { data: publicData } = supabase.storage.from('product-review-images').getPublicUrl(path);
        if (publicData?.publicUrl) newUrls.push(publicData.publicUrl);
      }

      if (newUrls.length) {
        const { error: imagesInsertError } = await supabase
          .from('product_review_images' as any)
          .insert(newUrls.map((u) => ({ review_id: myExistingReview.id, image_url: u })));
        if (imagesInsertError) throw imagesInsertError;
      }

      toast.success('Review updated');
      setEditingMyReview(false);
      setEditNewFiles([]);
      await refetchReviews();
    } catch (e: any) {
      if (newlyUploadedPaths.length) {
        await supabase.storage.from('product-review-images').remove(newlyUploadedPaths);
      }
      toast.error(e?.message || 'Failed to update review');
    } finally {
      setUpdatingReview(false);
    }
  };

  const submitReview = async () => {
    if (!id) return;
    setSubmittingReview(true);
    let createdReviewId: string | null = null;
    const uploadedPaths: string[] = [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please login to write a review');
        window.location.href = '/auth';
        return;
      }

      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!profile) {
        toast.error('Please create your profile first');
        window.location.href = '/profile';
        return;
      }

      if (myExistingReview) {
        toast.error('You already reviewed this product');
        return;
      }

      if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
        toast.error('Please select a rating');
        return;
      }

      if (!reviewDescription.trim()) {
        toast.error('Please write a description');
        return;
      }

      if (reviewFiles.length < 1) {
        toast.error('Please upload at least 1 image');
        return;
      }

      const { data: inserted, error: insertError } = await (supabase
        .from('product_reviews' as any) as any)
        .insert({
          product_id: id,
          user_id: session.user.id,
          rating: reviewRating,
          description: reviewDescription.trim(),
          reviewer_name: profile.full_name,
          reviewer_avatar_url: profile.avatar_url,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      createdReviewId = (inserted as any)?.id;
      if (!createdReviewId) throw new Error("Failed to create review");

      const imageUrls: string[] = [];
      for (const file of reviewFiles) {
        const ext = file.name.split('.').pop() || 'jpg';
        const rand = (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const path = `${createdReviewId}/${rand}.${ext}`;
        const { error: uploadError } = await supabase
          .storage
          .from('product-review-images')
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        const { data: publicData } = supabase.storage.from('product-review-images').getPublicUrl(path);
        if (publicData?.publicUrl) imageUrls.push(publicData.publicUrl);
      }

      const { error: imagesInsertError } = await supabase
        .from('product_review_images' as any)
        .insert(imageUrls.map((u) => ({ review_id: createdReviewId, image_url: u })));
      if (imagesInsertError) throw imagesInsertError;

      toast.success('Review submitted');
      setReviewRating(0);
      setReviewDescription('');
      setReviewFiles([]);
      setActiveReviewFilter(null);
      await refetchReviews();
      reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e: any) {
      if (uploadedPaths.length) {
        await supabase.storage.from('product-review-images').remove(uploadedPaths);
      }
      if (createdReviewId) {
        await supabase.from('product_review_images' as any).delete().eq('review_id', createdReviewId);
        await supabase.from('product_reviews' as any).delete().eq('id', createdReviewId);
      }
      toast.error(e?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Check if product has variants
  const { data: productVariants } = useQuery({
    queryKey: ['product-variants-count', id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('product_variants' as any) as any)
        .select('id')
        .eq('product_id', id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Parse features from product data
  const productFeatures = product?.features 
    ? Array.isArray(product.features) 
      ? product.features.map((f: any) => typeof f === 'string' ? f : f.feature || '')
      : []
    : [];

  // Get height, width, and weight from product data
  const height = (product as any)?.height || null;
  const width = (product as any)?.width || null;
  const weight = (product as any)?.weight || null;

  // Get brand and seller from product data
  const brand = (product as any)?.brand || null;
  const brand_logo_url = (product as any)?.brand_logo_url || null;
  const seller_name = (product as any)?.seller_name || null;
  const seller_description = (product as any)?.seller_description || null;
  const sellerShortDesc = seller_description && seller_description.length > 180 && !descriptionExpanded 
    ? seller_description.slice(0, 180) + "…" 
    : seller_description;

  useEffect(() => {
    if (seller_name) {
      const t = setTimeout(() => setSellerVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, [seller_name]);

  const handleVariantChange = (variant: any, attributeName: string, valueName: string) => {
    if (variant) {
      setSelectedVariant({
        id: variant.id,
        price: variant.price,
        stock_quantity: variant.stock_quantity,
        is_available: variant.is_available,
        attribute_name: attributeName,
        value_name: valueName,
        image_urls: Array.isArray(variant.image_urls) ? variant.image_urls : [],
      });
    } else {
      setSelectedVariant(null);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please login to add items to cart');
      // Navigate to auth page
      window.location.href = '/auth';
      return;
    }
    
    // Check if product has variants but no variant is selected
    if (productVariants && productVariants.length > 0 && !selectedVariant) {
      toast.error('Please select product attributes (size, color, etc.) before adding to cart');
      return;
    }
    
    const displayImage = allImages.length > 0 ? allImages[0] : null;
    const finalPrice = selectedVariant ? selectedVariant.price : Number(product.price);
    
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: product.id,
        product_id: product.id,
        name: product.name,
        price: finalPrice,
        discount_percentage: selectedVariant ? 0 : (product.discount_percentage || 0),
        image_url: displayImage,
        stock_quantity: selectedVariant ? selectedVariant.stock_quantity : (product as any).stock_quantity ?? null,
        variant_info: selectedVariant ? {
          variant_id: selectedVariant.id,
          attribute_name: selectedVariant.attribute_name,
          attribute_value: selectedVariant.value_name,
        } : undefined,
        cash_on_delivery: (product as any).cash_on_delivery || false,
      });
    }
    toast.success(`Added ${quantity} ${product.name}${selectedVariant ? ` (${selectedVariant.value_name})` : ''} to cart!`);
  };

  const handleToggleWishlist = async () => {
    if (!product) return;
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please login to add items to wishlist');
      // Navigate to auth page
      window.location.href = '/auth';
      return;
    }
    
    // Check if product has variants but no variant is selected (only when adding to wishlist)
    if (productVariants && productVariants.length > 0 && !selectedVariant && !isWishlisted) {
      toast.error('Please select product attributes (size, color, etc.) before adding to wishlist');
      return;
    }
    
    const displayImage = allImages.length > 0 ? allImages[0] : null;
    const finalPrice = selectedVariant ? selectedVariant.price : Number(product.price);
    
    if (isWishlisted) {
      removeFromWishlist(id || "");
      toast.success(`${product.name} removed from wishlist`);
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: finalPrice,
        discount_percentage: selectedVariant ? 0 : (product.discount_percentage || 0),
        image_url: displayImage,
        variant_info: selectedVariant ? {
          variant_id: selectedVariant.id,
          attribute_name: selectedVariant.attribute_name,
          attribute_value: selectedVariant.value_name,
        } : undefined,
        cash_on_delivery: (product as any).cash_on_delivery || false,
      });
      toast.success(`${product.name} added to wishlist!`);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    
    const productUrl = `${window.location.origin}/product/${id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out this amazing product: ${product.name}`,
          url: productUrl,
        });
      } catch (err) {
        console.log('Error sharing:', err);
        copyToClipboard(productUrl);
      }
    } else {
      copyToClipboard(productUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy link');
    });
  };

  const actualPrice = selectedVariant ? selectedVariant.price : Number(product?.price || 0);
  const discountedPrice = selectedVariant ? actualPrice : actualPrice * (1 - (product?.discount_percentage || 0) / 100);
  const isSoldOut = selectedVariant 
    ? (!selectedVariant.is_available || selectedVariant.stock_quantity === 0)
    : product?.stock_status === 'sold_out';
  const isLowStock = selectedVariant 
    ? (selectedVariant.stock_quantity > 0 && selectedVariant.stock_quantity <= 10)
    : (Number(product?.stock_quantity || 0) > 0 && Number(product?.stock_quantity || 0) <= 10 && product?.stock_status !== 'sold_out');
  const stockQuantity = selectedVariant ? selectedVariant.stock_quantity : (product?.stock_quantity || 0);

  // Get all images - combine images array with legacy image_url and variant images
  const allImages = (() => {
    // If a variant is selected and has images, use those
    if (selectedVariant && selectedVariant.image_urls && selectedVariant.image_urls.length > 0) {
      return selectedVariant.image_urls;
    }
    
    // Otherwise use product images
    return product?.images && product.images.length > 0 
      ? product.images 
      : (product?.image_url ? [product.image_url] : []);
  })();

  useEffect(() => {
    if (!product) return;
    if (!isWishlisted) return;
    if (!selectedVariant) return;
    const displayImage = allImages.length > 0 ? allImages[0] : null;
    addToWishlist({
      id: product.id,
      name: product.name,
      price: selectedVariant.price,
      discount_percentage: 0,
      image_url: displayImage,
      variant_info: {
        variant_id: selectedVariant.id,
        attribute_name: selectedVariant.attribute_name,
        attribute_value: selectedVariant.value_name,
      },
      cash_on_delivery: (product as any).cash_on_delivery || false,
    });
  }, [addToWishlist, allImages, isWishlisted, product, selectedVariant]);

  const nextImage = () => {
    if (!allImages.length) return;
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    if (!allImages.length) return;
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const getStockDisplay = () => {
    if (isSoldOut) return "Out of Stock";
    if (stockQuantity > 0 && stockQuantity <= 10) return `Only ${stockQuantity} left!`;
    if (stockQuantity > 0) return `${stockQuantity} in stock`;
    return "In Stock";
  };

  // Estimated delivery: today to 6 days later
  const deliveryStart = new Date();
  const deliveryEnd = new Date(deliveryStart);
  deliveryEnd.setDate(deliveryStart.getDate() + 6);
  const formatEst = (d: Date) => d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  // Fullscreen functions
  const openFullscreen = () => {
    setIsFullscreen(true);
    setZoomLevel(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setZoomLevel(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  // Zoom functions for fullscreen
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 1));
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - zoomPosition.x,
      y: e.clientY - zoomPosition.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setZoomPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  };

  // Pan functions for keyboard navigation when zoomed
  const panLeft = () => {
    if (zoomLevel > 1) {
      setZoomPosition(prev => ({ ...prev, x: prev.x + 50 }));
    }
  };

  const panRight = () => {
    if (zoomLevel > 1) {
      setZoomPosition(prev => ({ ...prev, x: prev.x - 50 }));
    }
  };

  const panUp = () => {
    if (zoomLevel > 1) {
      setZoomPosition(prev => ({ ...prev, y: prev.y + 50 }));
    }
  };

  const panDown = () => {
    if (zoomLevel > 1) {
      setZoomPosition(prev => ({ ...prev, y: prev.y - 50 }));
    }
  };

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreen) {
        if (e.key === 'Escape') {
          closeFullscreen();
        } else if (e.key === 'ArrowLeft') {
          if (e.shiftKey) {
            panLeft();
          } else {
            prevImage();
          }
        } else if (e.key === 'ArrowRight') {
          if (e.shiftKey) {
            panRight();
          } else {
            nextImage();
          }
        } else if (e.key === 'ArrowUp') {
          panUp();
        } else if (e.key === 'ArrowDown') {
          panDown();
        } else if (e.key === '+' || e.key === '=') {
          handleZoomIn();
        } else if (e.key === '-' || e.key === '_') {
          handleZoomOut();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, zoomLevel, currentImageIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isFullscreen && zoomLevel <= 1) {
      // For fullscreen navigation
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
    } else if (!isFullscreen) {
      // For main image gallery navigation
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
    } else {
      // For zoomed image panning
      if (e.touches.length === 1) {
        handleMouseDown(e.touches[0] as unknown as React.MouseEvent);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isFullscreen && zoomLevel <= 1) {
      // Scrolling is prevented by CSS when in fullscreen
      return;
    } else if (!isFullscreen) {
      // Allow normal touch scrolling for main gallery
      return;
    } else {
      // For zoomed image panning or pinch zoom
      if (e.touches.length === 1) {
        handleMouseMove(e.touches[0] as unknown as React.MouseEvent);
      } else if (e.touches.length === 2 && isFullscreen) {
        // Pinch zoom functionality
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (touchStart.x !== 0) {
          const scale = currentDistance / touchStart.x;
          const newZoomLevel = Math.min(Math.max(zoomLevel * scale, 1), 3);
          setZoomLevel(newZoomLevel);
        }
        
        setTouchStart({
          x: currentDistance,
          y: 0
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isFullscreen && zoomLevel <= 1) {
      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      };
      
      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = touchEnd.y - touchStart.y;
      
      // Minimum swipe distance
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          // Swipe right - previous image
          prevImage();
        } else {
          // Swipe left - next image
          nextImage();
        }
      }
    } else if (!isFullscreen) {
      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      };
      
      const deltaX = touchEnd.x - touchStart.x;
      
      // Minimum swipe distance
      if (Math.abs(deltaX) > 50 && allImages.length > 1) {
        if (deltaX > 0) {
          // Swipe right - previous image
          prevImage();
        } else {
          // Swipe left - next image
          nextImage();
        }
      }
    } else {
      // For zoomed image panning
      handleMouseUp();
    }
    
    // Reset touch start position
    setTouchStart({ x: 0, y: 0 });
  };

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    setIsTabAnimating(true);
    
    // Update the active tab index
    let tabIndex = 0;
    if (tab === 'description') tabIndex = 0;
    else if (tab === 'features') tabIndex = 1;
    else if (tab === 'dimensions') tabIndex = 2;
    setActiveTabIndex(tabIndex);
    
    // Start exit animation
    setTimeout(() => {
      setActiveTab(tab);
      // Start enter animation
      setTimeout(() => {
        setIsTabAnimating(false);
      }, 100);
    }, 100);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-2 gap-12">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-6">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!product || error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <Crown className="w-20 h-20 text-primary/30 mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-8">The product you're looking for doesn't exist.</p>
          <Link to="/products">
            <Button variant="royal">Browse Products</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Back Button */}
        <Link 
          to="/products" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Collection
        </Link>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Image Gallery with Fullscreen */}
          <div className="space-y-4 animate-fade-in">
            {/* Main Image with Click to Fullscreen */}
            <div 
              className="relative aspect-square rounded-2xl overflow-hidden bg-card border border-border/50"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {allImages.length > 0 ? (
                <>
                  <div 
                    className="w-full h-full cursor-pointer"
                    onClick={openFullscreen}
                  >
                    <img 
                      src={allImages[currentImageIndex]} 
                      alt={`${product.name} - Image ${currentImageIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                      <ZoomIn className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  {/* Navigation Arrows */}
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); prevImage(); }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors z-10"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); nextImage(); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors z-10"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-secondary">
                  <Crown className="w-32 h-32 text-muted-foreground/20" />
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {(product.discount_percentage || 0) > 0 && (
                  <span className="px-4 py-2 rounded-full text-sm font-bold gradient-gold text-white shadow-lg">
                    -{product.discount_percentage}% OFF
                  </span>
                )}
                {isSoldOut && (
                  <span className="px-4 py-2 rounded-full text-sm font-bold bg-destructive text-destructive-foreground">
                    Sold Out
                  </span>
                )}
                {isLowStock && !isSoldOut && (
                  <span className="px-4 py-2 rounded-full text-sm font-bold bg-yellow-500 text-yellow-950">
                    Low Stock
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.slice(0, 3).map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={cn(
                      "w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                      currentImageIndex === index 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-transparent hover:border-border"
                    )}
                  >
                    <img 
                      src={img} 
                      alt={`${product.name} thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                {allImages.length > 3 && (
                  <div className="w-20 h-20 rounded-lg flex items-center justify-center bg-muted border-2 border-dashed border-border flex-shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      +{allImages.length - 3} more
                    </span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Details */}
          <div className="flex flex-col animate-fade-in stagger-2">
            <div className="flex justify-between items-start">
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
                {product.name}
              </h1>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleToggleWishlist}
                  className={cn(
                    isWishlisted && "bg-primary text-primary-foreground hover:bg-primary/90",
                    "border-red-500 hover:border-red-500 hover:bg-red-500 hover:text-white"
                  )}
                  style={{ borderColor: 'red' }}
                >
                  <Heart className={cn("w-5 h-5", isWishlisted && "fill-current")} />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleShare}
                  className="ml-2"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex items-center gap-3 mb-4 w-fit"
            >
              {renderStars(reviewsAverage, 16)}
              <span className="text-sm text-muted-foreground">
                {reviewsCount ? (
                  <>
                    <span className="font-medium text-foreground">{reviewsAverage.toFixed(1)}</span> • {reviewsCount} review{reviewsCount === 1 ? '' : 's'}
                  </>
                ) : (
                  'No reviews yet'
                )}
              </span>
            </button>

            {(brand || seller_name) && (
              <div className="mt-2 mb-6 space-y-2">
                {brand && (
                  <div className="flex items-center gap-2">
                    {brand_logo_url && (
                      <img
                        src={brand_logo_url}
                        alt={brand}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-border shadow-sm"
                      />
                    )}
                    <span className="text-lg md:text-xl font-display text-foreground">
                      <span className="font-semibold">Brand:</span> {brand}
                    </span>
                  </div>
                )}
                </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-4 mb-6">
              {selectedVariant ? (
                <span className="font-display text-3xl font-bold text-primary">
                  ₹{selectedVariant.price.toFixed(2)}
                </span>
              ) : (product.discount_percentage || 0) > 0 ? (
                <>
                  <span className="font-display text-3xl font-bold text-primary">
                    ₹{discountedPrice.toFixed(2)}
                  </span>
                  <span className="text-xl text-muted-foreground line-through">
                    ₹{Number(product.price).toFixed(2)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                    Save ₹{(Number(product.price) - discountedPrice).toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="font-display text-3xl font-bold text-primary">
                  ₹{Number(product.price).toFixed(2)}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isSoldOut ? "bg-destructive" : isLowStock ? "bg-yellow-500" : "bg-green-500"
              )} />
              <span className={cn(
                "text-sm font-medium",
                isSoldOut ? "text-destructive" : isLowStock ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
              )}>
                {getStockDisplay()}
              </span>
            </div>

            {/* Estimated Delivery */}
            <div className="flex items-center gap-3 mt-1 mb-8 text-muted-foreground">
              <Truck className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              <span className="text-base md:text-lg font-display">
                Estimated delivery: <span className="font-medium text-foreground">{formatEst(deliveryStart)}</span> – <span className="font-medium text-foreground">{formatEst(deliveryEnd)}</span>
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {product.description}
              </p>
            )}
            
                        
            {/* Variant Selector */}
            <div className="mb-6">
              <VariantSelector 
                productId={product.id}
                basePrice={Number(product.price)}
                onVariantChange={handleVariantChange}
                initialVariantId={initialVariantId}
                onInvalidInitialVariant={() => {
                  toast.error("This option is unavailable now.");
                  navigate(`/product/${product.id}`, { replace: true });
                }}
              />
            </div>

            {/* Quantity Selector */}
            {!isSoldOut && (
              <div className="flex items-center gap-4 mb-8">
                <span className="text-sm font-medium text-foreground">Quantity:</span>
                <div className="flex items-center border border-border rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 hover:bg-muted transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-6 py-3 font-display text-lg font-semibold">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(stockQuantity || 99, quantity + 1))}
                    className="p-3 hover:bg-muted transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {stockQuantity > 0 && (
                  <span className="text-sm text-muted-foreground">
                    (Max: {stockQuantity})
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button
                variant="royal"
                size="xl"
                className="he"
                onClick={handleAddToCart}
                disabled={isSoldOut}
              >
                <ShoppingBag className="w-5 h-5 mr-2" />
                {isSoldOut ? 'Out of Stock' : 'Add to Cart'}
              </Button>
              <Button
                variant={isWishlisted ? "default" : "outline"}
                size="xl"
                className="hey border-red-500 hover:bg-red-500 hover:text-white"
                onClick={handleToggleWishlist}
              >
                <Heart className={cn("w-5 h-5 mr-2", isWishlisted && "fill-current animate-pulse")} />
                {isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}
              </Button>
            </div>

            {/* Product Details Tabs */}
            {(product.detailed_description || productFeatures.length > 0 || height || width || weight || brand || seller_name) && (
              <div className="mb-6">
                {/* Selected Variant Info */}
                {selectedVariant && (
                  <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary" />
                      <span className="font-medium">
                        {selectedVariant.attribute_name}: {selectedVariant.value_name}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="relative mb-6">
                {/* Left Scroll Arrow */}
                {canScrollLeft && (
                  <button
                    onClick={() => scrollTabs('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-background border border-border shadow-md hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gold" />
                  </button>
                )}
                
                {/* Right Scroll Arrow */}
                {canScrollRight && (
                  <button
                    onClick={() => scrollTabs('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-background border border-border shadow-md hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gold" />
                  </button>
                )}
                
                <div 
                  ref={tabsRef}
                  onScroll={checkScrollPosition}
                  className="relative flex border-b border-border overflow-x-auto gold-scrollbar scrollbar-hide max-md:overflow-x-scroll max-md:scrollbar-green"
                >
                  {/* Animated indicator line */}
                  <div 
                    className="absolute bottom-0 h-0.5 transition-all duration-300 ease-in-out"
                    style={{
                      width: product.detailed_description && productFeatures.length > 0 && (height || width || weight) ? 'calc(100% / 3)' : product.detailed_description && productFeatures.length > 0 ? 'calc(100% / 2)' : '100%',
                      left: activeTabIndex * (100 / (product.detailed_description && productFeatures.length > 0 && (height || width || weight) ? 3 : product.detailed_description && productFeatures.length > 0 ? 2 : 1)) + '%',
                      backgroundColor: '#60a5fa', // Blue color (mix of blue and light blue)
                      transitionProperty: 'left, width',
                    }}
                  />
                  <div className="flex flex-1 min-w-0 gap-4 md:gap-6 relative z-10">
                    {product.detailed_description && (
                      <button
                        className={cn(
                          "px-3 py-3 text-sm font-medium transition-colors flex-1 min-w-0 text-center flex-grow relative z-20",
                          activeTab === 'description' 
                            ? "text-primary" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleTabChange('description')}
                      >
                        <span className="truncate">Description</span>
                      </button>
                    )}
                    
                    {productFeatures.length > 0 && (
                      <button
                        className={cn(
                          "px-3 py-3 text-sm font-medium transition-colors flex-1 min-w-0 text-center flex-grow relative z-20",
                          activeTab === 'features' 
                            ? "text-primary" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleTabChange('features')}
                      >
                        <span className="truncate">Features</span>
                      </button>
                    )}
                    
                    {(height || width || weight) && (
                      <button
                        className={cn(
                          "px-3 py-3 text-sm font-medium transition-colors flex-1 min-w-0 text-center flex-grow relative z-20",
                          activeTab === 'dimensions' 
                            ? "text-primary" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleTabChange('dimensions')}
                      >
                        <span className="truncate">Dimensions</span>
                      </button>
                    )}

                    
                                      </div>
                </div>
              </div>
              
                <div className="mt-4">
                  <div className="overflow-hidden">
                    <div 
                      className={cn(
                        'transition-all duration-300 ease-in-out',
                        isTabAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
                      )}
                    >
                      {activeTab === 'description' && product.detailed_description && (
                        <div className="animate-fade-in-up">
                          <p className="text-muted-foreground leading-relaxed">
                            {product.detailed_description}
                          </p>
                        </div>
                      )}
                                        
                      {activeTab === 'features' && productFeatures.length > 0 && (
                        <div className="animate-fade-in-up">
                          <ul className="space-y-2">
                            {productFeatures.map((feature: string, index: number) => (
                              <li 
                                key={index} 
                                className="flex items-start gap-2 animate-fade-in-up"
                                style={{ animationDelay: `${index * 50}ms` }}
                              >
                                <BadgeCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <span className="text-muted-foreground">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                                        
                      {activeTab === 'dimensions' && (height || width || weight) && (
                        <div className="grid grid-cols-3 gap-4 animate-fade-in-up">
                          {height && (
                            <div className="animate-fade-in-up">
                              <h4 className="font-medium text-foreground mb-1">Height</h4>
                              <p className="text-muted-foreground">{height}</p>
                            </div>
                          )}
                          {width && (
                            <div className="animate-fade-in-up">
                              <h4 className="font-medium text-foreground mb-1">Width</h4>
                              <p className="text-muted-foreground">{width}</p>
                            </div>
                          )}
                          {weight && (
                            <div className="animate-fade-in-up">
                              <h4 className="font-medium text-foreground mb-1">Weight</h4>
                              <p className="text-muted-foreground">{weight}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="mt-10 pt-8 border-t border-border/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <span className="text-lg md:text-xl font-display">Premium Quality</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <span className="text-lg md:text-xl font-display">Secure Checkout</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <RotateCcw className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <span className="text-lg md:text-xl font-display">7-Day Return</span>
                </div>
              </div>
              {seller_name && (
                <div className="mt-6 md:mt-8 rounded-xl border bg-card border-border">
                  <button
                    className="w-full p-4 md:p-6 text-left rounded-xl transition-all duration-300 hover:bg-[hsl(159.92deg,52.26%,28.54%,0.1)] hover:shadow-md"
                    onClick={() => setSellerExpanded((v) => !v)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[hsl(159.92deg,52.26%,28.54%)] flex items-center justify-center shadow-sm">
                          <BadgeCheck className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                          <h4 className="font-display text-lg md:text-xl font-semibold text-foreground">Seller</h4>
                          <p className="text-sm md:text-base mt-1 text-muted-foreground">
                            <span className="text-muted-foreground font-medium">Verified • </span>
                            <span className="text-foreground font-medium">{seller_name}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {brand && (
                          <div className="flex-shrink-0 flex items-center justify-center">
                            {brand_logo_url ? (
                              <img
                                src={brand_logo_url}
                                alt={brand}
                                className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover border border-border"
                              />
                            ) : (
                              <div className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground font-medium text-xs md:text-sm">
                                {brand}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex-shrink-0 ml-2">
                          {sellerExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  <div 
                    className="transition-all duration-500 ease-out overflow-hidden"
                    style={{
                      maxHeight: sellerExpanded ? '500px' : '0',
                      opacity: sellerExpanded ? '1' : '0'
                    }}
                  >
                    <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-border">
                      {seller_description && (
                        <div className="mb-4">
                          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                            {sellerShortDesc}
                          </p>
                          {seller_description.length > 180 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDescriptionExpanded(prev => !prev); }}
                              className="mt-2 text-[hsl(159.92deg,52.26%,28.54%)] font-medium hover:underline text-sm flex items-center gap-1 transition-all duration-300"
                            >
                              <span className="transition-all duration-300 transform overflow-hidden">
                                {descriptionExpanded ? "Show less" : "Read more"}
                              </span>
                              <span className="transition-transform duration-300 transform ml-1">
                                {descriptionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="text-muted-foreground text-xs sm:text-sm">Quality Assured</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="text-muted-foreground text-xs sm:text-sm">Secure Checkout</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <RotateCcw className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="text-muted-foreground text-xs sm:text-sm">7-Day Return</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={reviewsRef} className="mt-10">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-bold">Reviews</h2>
                    <div className="mt-2 flex items-center gap-3">
                      {renderStars(reviewsAverage, 18)}
                      <span className="text-sm text-muted-foreground">
                        {reviewsCount ? (
                          <>
                            <span className="font-medium text-foreground">{reviewsAverage.toFixed(1)}</span> out of 5 • {reviewsCount} review{reviewsCount === 1 ? '' : 's'}
                          </>
                        ) : (
                          'No reviews yet'
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:w-[340px] bg-card rounded-xl border border-border/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium">Rating breakdown</div>
                      {activeReviewFilter && (
                        <Button variant="ghost" size="sm" onClick={() => setActiveReviewFilter(null)}>
                          Clear
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingCounts[star] || 0;
                        const pct = reviewsCount ? Math.round((count / reviewsCount) * 100) : 0;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => {
                              setActiveReviewFilter(star);
                              setTimeout(() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                            }}
                            className={cn(
                              'w-full flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/40 transition-colors',
                              activeReviewFilter === star && 'bg-muted/40'
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
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-card rounded-xl border border-border/50 p-5">
                    <h3 className="font-display text-lg font-semibold mb-4">Write a review</h3>

                    {!reviewSessionUserId ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Login required to post a review.</p>
                        <Button variant="royal" onClick={() => (window.location.href = '/auth')}>
                          Login to review
                        </Button>
                      </div>
                    ) : !reviewProfile ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Create your customer profile to post a review.</p>
                        <Button variant="royal" onClick={() => (window.location.href = '/profile')}>
                          Go to profile
                        </Button>
                      </div>
                    ) : myExistingReview ? (
                      <div className="space-y-5">
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-muted-foreground">You posted a review for this product.</div>
                          {!editingMyReview ? (
                            <>
                              <Button variant="royalOutline" size="sm" onClick={() => setEditingMyReview(true)}>Edit</Button>
                              <Button variant="destructive" size="sm" onClick={deleteMyReview} disabled={updatingReview}>Delete</Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => setEditingMyReview(false)}>Cancel</Button>
                          )}
                        </div>

                        {!editingMyReview ? (
                          <Button
                            variant="royalOutline"
                            onClick={() => {
                              setActiveReviewFilter(null);
                              setTimeout(() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                            }}
                          >
                            View your review
                          </Button>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm">Your rating</Label>
                              <div className="mt-2 flex items-center gap-2">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const star = i + 1;
                                  const active = editRating >= star;
                                  return (
                                    <button key={star} type="button" onClick={() => setEditRating(star)} className="p-1">
                                      <Star className={cn('w-6 h-6', active ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/50')} />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm">Description</Label>
                              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="mt-2 min-h-[110px]" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Images (keep/remove, add new up to 6)</Label>
                                <span className="text-xs text-muted-foreground">{editExistingImages.filter((x) => !x.remove).length + editNewFiles.length}/6</span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {editExistingImages.map((x) => (
                                  <div key={x.url} className={cn('relative w-20 h-20 rounded-lg overflow-hidden border bg-muted', x.remove && 'opacity-60')}>
                                    <img src={x.url} alt="Existing" className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => toggleRemoveExistingImage(x.url)} className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Toggle remove">
                                      {x.remove ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                  </div>
                                ))}
                                {editNewPreviews.map((src, idx) => (
                                  <div key={src} className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                                    <img src={src} alt={`New ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => removeEditNewImage(idx)} className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Remove new">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                {editExistingImages.filter((x) => !x.remove).length + editNewFiles.length < 6 && (
                                  <label className="w-20 h-20 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                                    <ImagePlus className="w-5 h-5" />
                                    <span className="text-[10px] mt-1">Add</span>
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickEditReviewImages(e.target.files)} />
                                  </label>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="royal" onClick={updateMyReview} disabled={updatingReview}>Save changes</Button>
                              <Button variant="ghost" onClick={() => setEditingMyReview(false)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div>
                          <Label className="text-sm">Your rating</Label>
                          <div className="mt-2 flex items-center gap-2">
                            {Array.from({ length: 5 }).map((_, i) => {
                              const star = i + 1;
                              const active = reviewRating >= star;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setReviewRating(star)}
                                  className="p-1"
                                  aria-label={`Rate ${star} star`}
                                >
                                  <Star className={cn('w-6 h-6', active ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/50')} />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm">Description</Label>
                          <Textarea
                            value={reviewDescription}
                            onChange={(e) => setReviewDescription(e.target.value)}
                            placeholder="Share your experience..."
                            className="mt-2 min-h-[110px]"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Images (1–6)</Label>
                            <span className="text-xs text-muted-foreground">{reviewFiles.length}/6</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {reviewPreviews.map((src, idx) => (
                              <div key={src} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                                <img src={src} alt={`Review image ${idx + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeReviewImage(idx)}
                                  className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                                  aria-label="Remove image"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}

                            {reviewFiles.length < 6 && (
                              <label className="w-20 h-20 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                                <ImagePlus className="w-5 h-5" />
                                <span className="text-[10px] mt-1">Add</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => onPickReviewImages(e.target.files)}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        <Button variant="royal" onClick={submitReview} disabled={submittingReview}>
                          {submittingReview ? 'Submitting...' : 'Submit review'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="bg-card rounded-xl border border-border/50 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-semibold">All reviews</h3>
                      {activeReviewFilter && (
                        <div className="text-sm text-muted-foreground">Filtered: {activeReviewFilter}★</div>
                      )}
                    </div>

                    {reviewsLoading ? (
                      <div className="py-10 text-center">
                        <Skeleton className="h-6 w-40 mx-auto" />
                        <div className="mt-4 space-y-3">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      </div>
                    ) : filteredReviews.length ? (
                      <div className="space-y-4">
                        {filteredReviews.map((r) => (
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

                                  {reviewSessionUserId && r.user_id === reviewSessionUserId && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                          setEditingMyReview(true);
                                          setTimeout(() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                                        }}
                                        aria-label="Edit review"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={deleteMyReview}
                                        disabled={updatingReview}
                                        aria-label="Delete review"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{r.description}</p>

                                {Array.isArray(r.product_review_images) && r.product_review_images.length > 0 && (
                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    {r.product_review_images.slice(0, 6).map((img: any, idx: number) => (
                                      <a
                                        key={`${r.id}_${idx}`}
                                        href={img.image_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="aspect-square rounded-md overflow-hidden border border-border bg-muted"
                                      >
                                        <img src={img.image_url} alt="Review" className="w-full h-full object-cover" />
                                      </a>
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
                        <Crown className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          {activeReviewFilter ? 'No reviews for this rating yet.' : 'No reviews yet. Be the first to review!'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {isFullscreen && (
        <div 
          ref={fullscreenRef}
          className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-4"
          onClick={closeFullscreen}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none' }}
        >
          <button 
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={closeFullscreen}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <div className="absolute top-4 left-4 flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full bg-white/10 hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
              disabled={zoomLevel >= 3}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full bg-white/10 hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
              disabled={zoomLevel <= 1}
            >
              <Crown className="w-4 h-4 transform rotate-180" />
            </Button>
          </div>
          
          <div
            className={cn(
              "max-w-full max-h-full cursor-grab",
              isDragging && "cursor-grabbing"
            )}
            onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e); }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{
              transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.2s ease"
            }}
          >
            <img 
              src={allImages[currentImageIndex]} 
              alt={`${product.name} - Fullscreen`}
              className="max-w-full max-h-[80vh] object-contain select-none"
              draggable={false}
            />
          </div>
          
          {allImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <span className="flex items-center text-white text-sm px-3 bg-black/30 rounded-full">
                {currentImageIndex + 1} / {allImages.length}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
