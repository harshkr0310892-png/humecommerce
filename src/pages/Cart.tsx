import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cartStore";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

export default function Cart() {
  const navigate = useNavigate();
  const { items, updateItem, updateQuantity, removeItem, getTotal, getDiscountedTotal, clearCart } = useCartStore();
  const total = getTotal();
  const discountedTotal = getDiscountedTotal();
  const savings = total - discountedTotal;
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
    if (productIds.length === 0) {
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,stock_status,stock_quantity")
        .in("id", productIds);
      if (!active) return;
      if (error) return;
      const map: Record<string, true> = {};
      const found = new Set((data || []).map((p: any) => p.id));
      productIds.forEach((pid) => {
        if (!found.has(pid)) map[pid] = true;
      });
      (data || []).forEach((p: any) => {
        const s = (p.stock_status || "").toString().toLowerCase();
        if (["deleted", "inactive", "unavailable"].includes(s)) map[p.id] = true;
      });

      const toRemove = items.filter((it: any) => map[(it.product_id || it.id.split("#")[0]) as string]);
      if (toRemove.length > 0) {
        toRemove.forEach((it: any) => removeItem(it.id));
        toast.error("Some items were removed because the product is unavailable.");
      }

      const productMap = new Map<string, any>((data || []).map((p: any) => [p.id, p]));
      items.forEach((it: any) => {
        if (it?.variant_info?.variant_id) return;
        const pid = (it.product_id || it.id.split("#")[0]) as string;
        const p = productMap.get(pid);
        if (!p) return;
        const qty = p.stock_quantity === null || p.stock_quantity === undefined ? null : Number(p.stock_quantity);
        updateItem(it.id, { stock_quantity: qty });
        if (qty !== null && it.quantity > qty) updateQuantity(it.id, qty);
      });
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
        return false;
      });
      if (removedLines.length > 0) {
        removedLines.forEach((it: any) => removeItem(it.id));
        toast.error("Some items were removed because the option is unavailable.");
      }

      const variantMap = new Map<string, any>(variants.map((v: any) => [v.id, v]));
      items.forEach((it: any) => {
        const vid = it?.variant_info?.variant_id as string | undefined;
        if (!vid) return;
        const v = variantMap.get(vid);
        if (!v) return;
        const qty = v.stock_quantity === null || v.stock_quantity === undefined ? null : Number(v.stock_quantity);
        updateItem(it.id, { stock_quantity: qty });
        if (qty !== null && it.quantity > qty) updateQuantity(it.id, qty);
      });
    })();
    return () => {
      active = false;
    };
  }, [items, removeItem, updateItem, updateQuantity, variantIds]);

  const handleCheckout = async () => {
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please login to checkout');
      navigate('/auth');
      return;
    }
    
    // Proceed to checkout if authenticated
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-12 h-12 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-4">Your Cart is Empty</h1>
            <p className="text-muted-foreground mb-8">
              Looks like you haven't added any items to your cart yet.
            </p>
            <Link to="/products">
              <Button variant="royal" size="lg">
                <Crown className="w-5 h-5 mr-2" />
                Browse Collection
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">
          Shopping <span className="gradient-gold-text">Cart</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, index) => {
              const discountedPrice = item.price * (1 - item.discount_percentage / 100);
              const variantId = (item as any)?.variant_info?.variant_id as string | undefined;
              const variantImage = variantId ? variantImages[variantId]?.[0] : undefined;
              const imageUrl = variantImage || item.image_url;
              const maxQty = (item as any).stock_quantity ?? null;
              const isAtMax = maxQty !== null && maxQty !== undefined && item.quantity >= Number(maxQty);
              
              return (
                <div 
                  key={item.id}
                  className={cn(
                    "flex gap-4 p-4 bg-card rounded-xl border border-border/50",
                    "opacity-0 animate-fade-in",
                    `stagger-${(index % 5) + 1}`
                  )}
                >
                  {/* Image */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Crown className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link 
                      to={`/product/${item.product_id || item.id}`}
                      className="font-display text-lg font-semibold hover:text-primary transition-colors line-clamp-1"
                    >
                      {item.name}
                    </Link>
                    {(item as any)?.variant_info?.attribute_name && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {(item as any).variant_info.attribute_name}:{" "}
                        {((item as any).variant_info.value_name ?? (item as any).variant_info.attribute_value) as any}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-1">
                      {item.discount_percentage > 0 ? (
                        <>
                          <span className="font-semibold text-primary">
                            ₹{discountedPrice.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            ₹{item.price.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold text-primary">
                          ₹{item.price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-border rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-muted transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className={cn("p-2 transition-colors", isAtMax ? "opacity-50 cursor-not-allowed" : "hover:bg-muted")}
                          disabled={isAtMax}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Cart
            </Button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border border-border/50 p-6 sticky top-24">
              <h2 className="font-display text-xl font-semibold mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span>-₹{savings.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between">
                    <span className="font-display text-lg font-semibold">Total</span>
                    <span className="font-display text-xl font-bold text-primary">
                      ₹{discountedTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <Button variant="royal" size="lg" className="w-full" onClick={handleCheckout}>
                Proceed to Checkout
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Link to="/products" className="block mt-4">
                <Button variant="royalOutline" size="lg" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
