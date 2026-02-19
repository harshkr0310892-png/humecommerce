import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { useWishlistStore } from "@/store/wishlistStore";
import { X, ShoppingCart, Crown } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { toast } from "sonner";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Wishlist() {
  const { items, removeItem, clearNewItemFlag } = useWishlistStore();
  const addItemToCart = useCartStore((state) => state.addItem);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const newItemRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const [unavailable, setUnavailable] = useState<Record<string, { product: boolean; option: boolean }>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, loading } = useCustomerAuth();
  
  // Items per page - 8 items per page
  const itemsPerPage = 8;

  useEffect(() => {
    if (loading) return;
    if (isLoggedIn) return;

    const redirectTo = `${location.pathname}${location.search}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
  }, [isLoggedIn, loading, location.pathname, location.search, navigate]);
  
  // Get current page from URL params or default to 1
  useEffect(() => {
    const page = searchParams.get('page');
    setCurrentPage(page ? parseInt(page, 10) : 1);
  }, [searchParams]);

  // Clear animation flags after initial render
  useEffect(() => {
    items.forEach(item => {
      if (item.isNewlyAdded) {
        // Set a timeout to clear the flag after animation
        setTimeout(() => {
          clearNewItemFlag(item.id);
        }, 2000);
      }
    });
  }, [items, clearNewItemFlag]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  useEffect(() => {
    if (items.length === 0) {
      setUnavailable({});
      return;
    }
    let active = true;
    (async () => {
      const productIds = Array.from(new Set(items.map((i) => i.id)));
      const variantIds = Array.from(
        new Set(
          items
            .map((i) => i.variant_info?.variant_id)
            .filter(Boolean) as string[]
        )
      );

      const next: Record<string, { product: boolean; option: boolean }> = {};

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id,stock_status")
        .in("id", productIds);
      if (!active) return;
      if (!productsError) {
        const found = new Set((productsData || []).map((p: any) => p.id));
        productIds.forEach((pid) => {
          if (!found.has(pid)) next[pid] = { product: true, option: false };
        });
        (productsData || []).forEach((p: any) => {
          const s = (p.stock_status || "").toString().toLowerCase();
          if (["deleted", "inactive", "unavailable"].includes(s)) next[p.id] = { product: true, option: false };
        });
      }

      if (variantIds.length > 0) {
        const { data: variantsData, error: variantsError } = await (supabase
          .from("product_variants" as any) as any)
          .select("id,is_available")
          .in("id", variantIds);
        if (!active) return;
        if (!variantsError) {
          const found = new Set((variantsData || []).map((v: any) => v.id));
          items.forEach((it) => {
            const vid = it.variant_info?.variant_id;
            if (!vid) return;
            if (!found.has(vid)) {
              next[it.id] = { product: next[it.id]?.product ?? false, option: true };
              return;
            }
            const v = (variantsData || []).find((x: any) => x.id === vid);
            if (v && v.is_available === false) next[it.id] = { product: next[it.id]?.product ?? false, option: true };
          });
        }
      }

      setUnavailable(next);
    })();
    return () => {
      active = false;
    };
  }, [items]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSearchParams({ page: page.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveFromWishlist = (id: string) => {
    removeItem(id);
    toast.success("Item removed from wishlist");
    
    // If we're on the last page and it becomes empty, go to previous page
    if (currentItems.length === 1 && currentPage > 1 && totalPages > 1) {
      const newTotalPages = Math.ceil((filteredItems.length - 1) / itemsPerPage);
      if (currentPage > newTotalPages) {
        handlePageChange(newTotalPages);
      }
    }
  };

  const handleAddToCart = async (item: any) => {
    if (isBanned) {
      toast.error("You are banned");
      return;
    }
    const u = unavailable[item.id];
    if (u?.product) {
      toast.error("This product is unavailable.");
      return;
    }
    if (u?.option) {
      toast.error("This option is unavailable.");
      return;
    }
    try {
      const variantId = item?.variant_info?.variant_id as string | undefined;
      if (variantId) {
        const { data, error } = await (supabase
          .from("product_variants" as any) as any)
          .select("stock_quantity,is_available")
          .eq("id", variantId)
          .maybeSingle();
        if (error) throw error;
        const stockQty = data?.stock_quantity === null || data?.stock_quantity === undefined ? null : Number(data.stock_quantity);
        if (data && data.is_available === false) {
          toast.error("This option is unavailable.");
          return;
        }
        if (stockQty !== null && stockQty <= 0) {
          toast.error("You're too late — this option is now out of stock.");
          return;
        }
        addItemToCart({ ...item, stock_quantity: stockQty });
        toast.success(`${item.name} added to cart!`);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("stock_quantity,stock_status")
        .eq("id", item.id)
        .maybeSingle();
      if (error) throw error;
      const stockQty = data?.stock_quantity === null || data?.stock_quantity === undefined ? null : Number(data.stock_quantity);
      const status = (data?.stock_status || "").toString().toLowerCase();
      if (["deleted", "inactive", "unavailable", "sold_out"].includes(status)) {
        toast.error("This product is unavailable.");
        return;
      }
      if (stockQty !== null && stockQty <= 0) {
        toast.error("You're too late — this item is now out of stock.");
        return;
      }
      addItemToCart({ ...item, stock_quantity: stockQty });
      toast.success(`${item.name} added to cart!`);
    } catch {
      addItemToCart(item);
      toast.success(`${item.name} added to cart!`);
    }
  };

  const discountedPrice = (price: number, discount_percentage: number) => {
    return price * (1 - discount_percentage / 100);
  };

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

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <Crown className="w-20 h-20 text-primary/30 mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold mb-4">Your Wishlist is Empty</h1>
          <p className="text-muted-foreground mb-8">Start adding items to your wishlist!</p>
          <Link to="/products">
            <Button variant="royal">Browse Products</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <div className="warm-bg min-h-screen">
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold mb-4">My Wishlist ({filteredItems.length} items)</h1>
          
          {/* Search Bar */}
          <div className="flex justify-center mb-6">
            <SearchBar 
              onSearch={handleSearch} 
              placeholder="Search wishlist..." 
              initialValue={searchTerm}
              context="wishlist"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {currentItems.map((item) => {
            const finalPrice = discountedPrice(item.price, item.discount_percentage);
            const isProductUnavailable = !!unavailable[item.id]?.product;
            const isOptionUnavailable = !!unavailable[item.id]?.option;
            const isUnavailable = isProductUnavailable || isOptionUnavailable;
            
            return (
              <div 
                key={item.id} 
                ref={el => newItemRefs.current[item.id] = el}
                className={cn(
                  "group relative bg-card rounded border border-border/30 overflow-hidden hover:shadow-md transition-all duration-300",
                  item.isNewlyAdded && "animate-pulse bg-blue-500/10 border-blue-500/30"
                )}
              >
                <div className="relative aspect-video overflow-hidden">
                  <Link
                    to={`/product/${item.id}${item.variant_info?.variant_id ? `?variant=${encodeURIComponent(item.variant_info.variant_id)}` : ''}`}
                    className="block w-full h-full"
                  >
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-secondary">
                        <Crown className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </Link>
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {item.discount_percentage > 0 && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold gradient-gold text-white shadow-md">
                        -{item.discount_percentage}%
                      </span>
                    )}
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveFromWishlist(item.id)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors z-10 opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {/* Content */}
                <div className="p-3">
                  <Link
                    to={`/product/${item.id}${item.variant_info?.variant_id ? `?variant=${encodeURIComponent(item.variant_info.variant_id)}` : ''}`}
                    className="block"
                  >
                    <h3 className="font-display text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                  </Link>
                  {item.variant_info?.attribute_name && item.variant_info?.attribute_value && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.variant_info.attribute_name}: {item.variant_info.attribute_value}
                    </div>
                  )}
                  {isUnavailable && (
                    <div className="mt-1 text-xs text-destructive">
                      {isProductUnavailable
                        ? "This product is unavailable."
                        : "This option is unavailable."}
                    </div>
                  )}
                  
                  <div className="mt-2 flex items-center gap-2">
                    {item.discount_percentage > 0 ? (
                      <>
                        <span className="font-display text-base font-bold text-primary">
                          ₹{finalPrice.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{item.price.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="font-display text-base font-bold text-primary">
                        ₹{item.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-12 text-xs sm:text-sm px-2 sm:px-3 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-light-blue-500/20 hover:border-blue-500/50 transition-all duration-300"
                      onClick={() => handleRemoveFromWishlist(item.id)}
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Remove
                    </Button>
                    <Button 
                      size="sm" 
                      variant="royal" 
                      className="flex-1 h-12 text-xs sm:text-sm px-2 sm:px-3"
                      onClick={() => handleAddToCart(item)}
                      disabled={isUnavailable}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-md text-sm font-medium bg-card border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                Previous
              </button>
              
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                // Show first, last, current, and nearby pages
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        currentPage === page
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border hover:bg-muted transition-colors"
                      }`}
                    >
                      {page}
                    </button>
                  );
                }
                
                // Show ellipsis for skipped pages
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-2 py-2 text-sm text-muted-foreground">
                      ...
                    </span>
                  );
                }
                
                return null;
              })}
              
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-md text-sm font-medium bg-card border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
    </div>
  );
}
