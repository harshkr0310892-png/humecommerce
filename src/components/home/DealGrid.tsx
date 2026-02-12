import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatPrice(value: number | string | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN');
}

export default function DealGrid({ section }: { section: any }) {
  const content = typeof section.content === 'string' ? (() => { try { return JSON.parse(section.content); } catch { return {}; } })() : section.content || {};
  const layoutConfig = typeof section.layout_config === 'string' 
    ? (() => { try { return JSON.parse(section.layout_config); } catch { return { columns: 5, rows: 2 }; } })() 
    : (section.layout_config || { columns: 5, rows: 2 });
  
  const columns = layoutConfig.columns || 5;
  const rows = layoutConfig.rows || 2;
  const totalProducts = columns * rows;

  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === 'undefined') return 1024;
    return window.innerWidth;
  });

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const effectiveColumns = useMemo(() => {
    const clampToConfigured = (n: number) => Math.max(1, Math.min(n, columns));

    if (viewportWidth < 640) return clampToConfigured(2);
    if (viewportWidth < 768) return clampToConfigured(3);
    if (viewportWidth < 1024) return clampToConfigured(4);
    return clampToConfigured(columns);
  }, [viewportWidth, columns]);
  
  const ids: string[] = Array.isArray(content?.product_ids) ? content.product_ids : [];

  const { data: products, isLoading } = useQuery({
    queryKey: ['deal-grid', ids.join(',')],
    queryFn: async () => {
      if (ids.length === 0) return [];
      try {
        let resp;
        if (ids.length === 1) {
          resp = await supabase.from('products').select('*').eq('id', ids[0]).eq('is_active', true).limit(20);
        } else {
          resp = await supabase.from('products').select('*').in('id', ids).eq('is_active', true).limit(20);
        }
        const { data, error } = resp as any;
        if (error) {
          console.error('DealGrid: error fetching products', error);
          return [];
        }
        const map = new Map((data || []).map((d: any) => [d.id, d]));
        return ids.map(id => map.get(id)).filter(Boolean);
      } catch (err) {
        console.error('DealGrid: unexpected error', err);
        return [];
      }
    },
  });

  if (isLoading) {
    return (
      <section className="py-6">
        <div className="container mx-auto px-4">
          <h3 className="font-display text-xl font-semibold mb-4">{section?.title || 'Deals'}</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` }}>
            {[...Array(Math.min(10, totalProducts))].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full h-40 rounded-lg" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold">{section?.title || 'Deals'}</h3>
          <Link to="/products" className={cn("text-sm text-muted-foreground hover:text-primary transition-colors")}>View all</Link>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` }}>
          {products.slice(0, totalProducts).map((p: any) => (
            <Link
              key={p.id}
              to={`/product/${p.id}`}
              className="bg-card rounded-lg overflow-hidden border border-border/50 shadow-sm"
            >
              <div className="w-full h-40 bg-muted flex items-center justify-center p-3">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-xs text-muted-foreground">No Image</div>
                )}
              </div>
              <div className="p-2">
                <div className="text-xs font-medium line-clamp-2 mb-1 text-foreground">{p.name}</div>
                <div className="text-xs text-muted-foreground">₹{formatPrice(p.price)}</div>
                <div className="text-xs text-green-600 font-semibold mt-1">
                  {Number(p.discount_percentage || 0) > 0 ? `Min. ${p.discount_percentage}% Off` : 'Special offer'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
