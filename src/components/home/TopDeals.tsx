import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function formatPrice(value: number | string | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN');
}

type TopDealsProps = {
  className?: string;
  containerClassName?: string;
};

export function TopDeals({ className, containerClassName }: TopDealsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const sectionClasses = cn("py-6", className);
  const containerClasses = cn("container mx-auto px-4", containerClassName);

  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = 300;
    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    setTimeout(checkScroll, 400);
  };

  // Look for a home_sections entry with section_type = 'top_deals'
  const { data: sections } = useQuery({
    queryKey: ['home-sections-top-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_sections')
        .select('*')
        .eq('section_type', 'top_deals')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data;
    },
  });

  const section = sections && sections.length > 0 ? sections[0] : null;

  // If section defines explicit product IDs, fetch those; otherwise auto-pick by discount
  const { data: products, isLoading } = useQuery({
    queryKey: ['top-deals', section?.id || 'auto'],
    queryFn: async () => {
      try {
        // Normalize section.content to an object
        const contentObj: any = section && typeof section.content === 'string'
          ? (() => { try { return JSON.parse(section.content); } catch { return {}; } })()
          : (section && section.content) || {};

        const idsRaw = Array.isArray(contentObj?.product_ids) ? contentObj.product_ids : [];
        const ids = idsRaw.filter(Boolean).map(String);

        if (ids.length > 0) {
          // Use eq for single id to avoid REST encoding issues
          let resp;
          if (ids.length === 1) {
            resp = await supabase
              .from('products')
              .select('*')
              .eq('id', ids[0])
              .eq('is_active', true)
              .limit(12);
          } else {
            resp = await supabase
              .from('products')
              .select('*')
              .in('id', ids)
              .eq('is_active', true)
              .limit(12);
          }

          const response = resp as any;
          const { data, error } = response;
          if (error) {
            console.error('TopDeals: error fetching selected products', error);
            return [];
          }
          const map = new Map((data || []).map((d: any) => [d.id, d]));
          return ids.map(id => map.get(id)).filter(Boolean);
        }

        const response = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('discount_percentage', { ascending: false })
          .limit(12);
        const { data, error } = response as any;
        if (error) {
          console.error('TopDeals: error fetching fallback products', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error('TopDeals: unexpected error in queryFn', err);
        return [];
      }
    },
  });

  useEffect(() => {
    setTimeout(checkScroll, 100);
  }, [section, products]);

  if (isLoading) {
    return (
      <section className={sectionClasses}>
        <div className={containerClasses}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold text-foreground">{section?.title || 'Top Deals'}</h3>
            <div className="text-sm text-muted-foreground">View all</div>
          </div>
          <div className="bg-card rounded-xl p-4 relative border border-border/50 shadow-sm">
            <div className="flex gap-3 md:gap-4 overflow-x-auto py-2 flex-1 scrollbar-hide">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 text-center w-24 md:w-28 min-w-[96px] md:min-w-[112px]">
                  <Skeleton className="w-full h-24 md:h-28 rounded-lg bg-muted mb-2 p-2 md:p-3" />
                  <Skeleton className="h-3 w-3/4 mx-auto mb-1" />
                  <Skeleton className="h-2 w-1/2 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) {
    return (
      <section className={sectionClasses}>
        <div className={containerClasses}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-semibold text-foreground">{section?.title || 'Top Deals'}</h3>
            <div className="text-sm text-muted-foreground">View all</div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border/50 shadow-sm">
            <p className="text-sm text-muted-foreground text-center">No deals to show. Check that you have active products in the `products` table or create a `home_sections` entry with type `top_deals` and `product_ids` (use the Admin CMS → Sections).</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClasses}>
      <div className={containerClasses}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold text-foreground">{section?.title || 'Top Deals'}</h3>
          <Link to="/products" className="text-sm text-muted-foreground hover:text-primary transition-colors">View all</Link>
        </div>

        <div className="bg-card rounded-xl p-4 relative border border-border/50 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="hidden md:flex w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 disabled:bg-muted disabled:text-muted-foreground text-primary items-center justify-center flex-shrink-0 z-10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              onLoad={checkScroll}
              className="flex gap-3 md:gap-4 overflow-x-auto py-2 flex-1 scrollbar-hide snap-x snap-mandatory"
            >
              {products.map((p: any) => (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  className="flex-shrink-0 snap-start text-center w-24 md:w-28 min-w-[96px] md:min-w-[112px]"
                >
                  <div className="w-full h-24 md:h-28 rounded-lg bg-muted overflow-hidden flex items-center justify-center mb-2 shadow-sm p-2 md:p-3 transition-transform hover:scale-105">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="text-xs text-muted-foreground">No Image</div>
                    )}
                  </div>
                  <div className="text-xs md:text-sm font-medium line-clamp-2 mb-1 text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">From ₹{formatPrice(p.price)}</div>
                </Link>
              ))}
            </div>

            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="hidden md:flex w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 disabled:bg-muted disabled:text-muted-foreground text-primary items-center justify-center flex-shrink-0 z-10 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TopDeals;
