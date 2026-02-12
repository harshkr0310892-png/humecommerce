import { Link, useNavigate } from "react-router-dom";
import React, { ElementType } from "react";
import SimpleTextReveal from "@/components/SimpleTextReveal";
import Carousel from "@/components/Carousel";
import { Layout } from "@/components/layout/Layout";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { BannerCarousel } from "@/components/home/BannerCarousel";
import TopDeals from "@/components/home/TopDeals";
import DealGrid from "@/components/home/DealGrid";
import { SpecialOfferPopup } from "@/components/SpecialOfferPopup";
import { 
  Crown, 
  Sparkles, 
  Truck, 
  Shield, 
  Gift, 
  ArrowRight, 
  Star,
  Zap,
  Heart,
  ShoppingBag,
  ChevronRight,
  Package,
  Clock,
  BadgeCheck,
  Flame,
  TrendingUp,
  Award,
  Headphones,
  RefreshCw,
  CreditCard,
  Mail,
  Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const iconMap: Record<string, ElementType> = {
  crown: Crown,
  truck: Truck,
  shield: Shield,
  gift: Gift,
  sparkles: Sparkles,
  zap: Zap,
  package: Package,
  clock: Clock,
  badge: BadgeCheck,
  headphones: Headphones,
  refresh: RefreshCw,
  card: CreditCard,
};

// Enhanced Feature Card
const FeatureCard = ({ 
  icon: Icon, 
  title, 
  description, 
  color,
  index
}: { 
  icon: ElementType; 
  title: string; 
  description: string;
  color: string;
  index: number;
}) => (
  <div 
    className="group relative overflow-hidden rounded-3xl bg-card p-6 md:p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border border-border"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    {/* Gradient Blob */}
    <div className={cn(
      "absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500",
      color
    )} />
    
    <div className="relative z-10">
      <div className={cn(
        "w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
        color
      )}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="font-bold text-lg md:text-xl mb-3 text-foreground">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

// Enhanced Category Card
const CategoryCard = ({ category, index }: { category: any; index: number }) => (
  <Link
    to={`/products?category=${encodeURIComponent(category.id)}`}
    className="group flex flex-col items-center flex-shrink-0"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-3xl overflow-hidden bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-border shadow-lg group-hover:shadow-2xl transition-all duration-500 group-hover:-translate-y-2 group-hover:scale-105">
      {category.image_url ? (
        <img 
          src={category.image_url} 
          alt={category.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-pink-500">
          <span className="text-3xl font-bold text-white">
            {category.name?.charAt(0)}
          </span>
        </div>
      )}
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
          <ArrowRight className="w-5 h-5 text-slate-900" />
        </div>
      </div>
    </div>
    <span className="mt-4 text-xs md:text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-300 text-center line-clamp-2 max-w-[80px] md:max-w-[120px]">
      {category.name}
    </span>
  </Link>
);

// Section Header
const SectionHeader = ({ 
  title, 
  subtitle, 
  action,
  actionLink,
  icon: Icon,
  gradient
}: { 
  title: string; 
  subtitle?: string;
  action?: string;
  actionLink?: string;
  icon?: ElementType;
  gradient?: string;
}) => (
  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14">
    <div className="flex items-start gap-4">
      {Icon && (
        <div className={cn(
          "hidden md:flex w-14 h-14 rounded-2xl items-center justify-center flex-shrink-0",
          gradient || "bg-gradient-to-br from-blue-500 to-purple-500"
        )}>
          <Icon className="w-7 h-7 text-white" />
        </div>
      )}
      <div>
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-muted-foreground text-sm md:text-base max-w-xl">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && actionLink && (
      <Link 
        to={actionLink}
        className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-muted text-sm font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-all duration-300"
      >
        {action}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Link>
    )}
  </div>
);

// Stats Badge
const StatBadge = ({ icon: Icon, label, value, color }: { icon: ElementType; label: string; value: string; color: string }) => (
  <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-foreground">{value}</p>
    </div>
  </div>
);

export default function Index() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(() => {
    // Check if user has already subscribed in local storage
    return localStorage.getItem('newsletter_subscribed') === 'true';
  });
  
  // Detect mobile devices for performance optimization
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  const handleHomeSearch = (term: string) => {
    const q = term.trim();
    if (!q) return;
    navigate(`/products?search=${encodeURIComponent(q)}`);
  };
  
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setIsSubscribing(true);
    try {
      const { error } = await supabase
        .from('newsletter_subscriptions')
        .insert([{ email }]);
      
      if (error) {
        if (error.code === '23505') { // Unique violation error code
          toast.error("You're already subscribed to our newsletter!");
        } else {
          toast.error("Failed to subscribe. Please try again.");
        }
        return;
      }
      
      toast.success("Thank you for subscribing to our newsletter!");
      setEmail("");
      setIsSubscribed(true);
      // Save subscription status to local storage
      localStorage.setItem('newsletter_subscribed', 'true');
    } catch (err) {
      console.error('Error subscribing to newsletter:', err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: sections } = useQuery({
    queryKey: ['home-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_sections')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const heroSection = sections?.find(s => s.section_type === 'hero');
  const featuresSection = sections?.find(s => s.section_type === 'features');
  const featuredProductsSection = sections?.find(s => s.section_type === 'featured_products');
  const ctaSection = sections?.find(s => s.section_type === 'cta');

  const featuredProducts = products?.slice(0, 8);

  const { data: categories } = useQuery({
    queryKey: ['home-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .is('seller_id', null)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const topCategories = useMemo(() => categories?.slice(0, 10) || [], [categories]);

  const defaultFeatures = [
    { 
      icon: Truck, 
      title: 'Lightning Fast Delivery', 
      description: 'Get your orders delivered within 2-3 business days. Free shipping on orders above ₹499.',
      color: 'bg-gradient-to-br from-blue-500 to-purple-500'
    },
    { 
      icon: Shield, 
      title: '100% Secure Payments', 
      description: 'Your payment information is processed securely. We support all major payment methods.',
      color: 'bg-gradient-to-br from-blue-500 to-purple-500'
    },
    { 
      icon: RefreshCw, 
      title: 'Easy Returns', 
      description: '7-day hassle-free returns. No questions asked. Full refund guaranteed.',
      color: 'bg-gradient-to-br from-blue-500 to-purple-500'
    },
    { 
      icon: Headphones, 
      title: '24/7 Premium Support', 
      description: 'Our dedicated support team is here to help you anytime via chat, email, or phone.',
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-card to-background">
      <Layout>
        <SpecialOfferPopup />
        
        {/* ========== HERO SECTION ========== */}
        <section className="relative overflow-hidden min-h-[70vh] sm:min-h-[80vh] md:min-h-[90vh] flex items-center">
          {/* Optimized Background - Black Grey Mix with Glassy Border */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-card to-purple-500/5">
            {/* Glassy overlay with border effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/30 via-gray-800/20 to-black/40 backdrop-blur-sm border border-white/10 rounded-inherit" />
            
            {/* Static blobs instead of animated ones for better performance */}
            <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full blur-3xl opacity-30 hidden sm:block" />
            <div className="absolute top-40 right-10 w-96 h-96 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full blur-3xl opacity-30 hidden sm:block" />
            <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-gradient-to-br from-gray-500 to-gray-700 rounded-full blur-3xl opacity-20 hidden sm:block" />
            
            {/* Grid pattern with grey tones */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />
          </div>

          <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
            <div className="absolute inset-0 -z-10">
              {/* Background elements removed when Squares component was deleted */}
            </div>
            <div className="max-w-5xl mx-auto text-center">
              {/* Announcement Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-8 animate-fade-in-up">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600"></span>
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    New Arrivals Just Dropped!
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-primary" />
              </div>

              {/* Main Heading */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight mb-4 sm:mb-6 text-foreground">
                {heroSection?.title || 'Shop Premium Quality'}
              </h1>

              {/* Subheading */}
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xs sm:max-w-2xl mx-auto mb-6 sm:mb-10 animate-fade-in-up animation-delay-400 leading-relaxed">
                {heroSection?.subtitle || 'Discover our curated collection of premium products. Best quality, best prices, best experience!'}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center animate-fade-in-up animation-delay-600">
                <Link to={(heroSection?.content as any)?.buttonLink || '/products'}>
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-primary-foreground shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 rounded-2xl"
                  >
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    {(heroSection?.content as any)?.buttonText || 'Start Shopping'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/track-order">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-bold border-2 border-border hover:border-primary/50 hover:bg-primary/5 rounded-2xl transition-all duration-300"
                  >
                    <Package className="w-5 h-5 mr-2" />
                    Track Your Order
                  </Button>
                </Link>
              </div>

              {/* Trust Stats */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6 sm:mt-8 md:mt-14 animate-fade-in-up animation-delay-800">
                <StatBadge 
                  icon={Star} 
                  label="Rating" 
                  value="4.9/5" 
                  color="bg-gradient-to-br from-primary to-accent" 
                />
                <StatBadge 
                  icon={Heart} 
                  label="Happy Customers" 
                  value="50,000+" 
                  color="bg-gradient-to-br from-primary to-accent" 
                />
                <StatBadge 
                  icon={BadgeCheck} 
                  label="Products" 
                  value="Verified" 
                  color="bg-gradient-to-br from-primary to-accent" 
                />
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-8 h-12 rounded-full border-2 border-border flex items-start justify-center p-2">
              <div className="w-1.5 h-3 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
        </section>

        {/* Sticky Search (Home) */}
        <section className="sticky top-16 sm:top-20 z-40 py-3 bg-background/60 backdrop-blur border-b border-border/40">
          <div className="container mx-auto px-4">
            <div className="bg-card/80 border border-border rounded-2xl p-3">
              <div className="flex justify-center">
                <SearchBar
                  onSearch={handleHomeSearch}
                  placeholder="Search products..."
                  context="collection"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ========== CATEGORIES SECTION ========== */}
        {topCategories.length > 0 && (
          <section className="py-12 md:py-20">
            <div className="container mx-auto px-4">
              <div className="bg-card rounded-2xl sm:rounded-3xl md:rounded-[2rem] p-4 sm:p-6 md:p-10 border border-border shadow-xl shadow-foreground/10">
                <div className="mb-10 md:mb-14">
                  <SimpleTextReveal className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2 text-center md:text-left">
                    Shop by Category
                  </SimpleTextReveal>
                  <p className="mt-2 text-muted-foreground text-sm md:text-base max-w-xl text-center md:text-left">
                    Browse through our diverse collection of categories
                  </p>
                </div>
                
                <div className="flex items-start gap-3 sm:gap-5 md:gap-8 overflow-x-auto pb-4 scrollbar-hide">
                  {topCategories.map((cat: any, index: number) => (
                    <CategoryCard key={cat.id} category={cat} index={index} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========== BANNER CAROUSEL ========== */}
        <section className="py-6 sm:py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="rounded-3xl md:rounded-[2rem] overflow-hidden shadow-2xl shadow-foreground/10">
              <BannerCarousel />
            </div>
          </div>
        </section>

        {/* ========== TOP DEALS ========== */}
        <TopDeals />

        {/* ========== DEAL GRID SECTIONS ========== */}
        {sections && sections.filter((s: any) => s.section_type === 'deal_grid' && s.is_active).map((s: any) => (
          <DealGrid key={s.id} section={s} />
        ))}

        {/* ========== FEATURES SECTION ========== */}
        <section className="py-10 sm:py-16 md:py-24 bg-gradient-to-b from-background to-card">
          <div className="container mx-auto px-4">
            <div className="mb-10 md:mb-14">
              <SimpleTextReveal className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2 text-center md:text-left">
                {featuresSection?.title || "Why Choose Us?"}
              </SimpleTextReveal>
              <p className="mt-2 text-muted-foreground text-sm md:text-base max-w-xl text-center md:text-left">
                We're committed to providing you the best shopping experience
              </p>
            </div>
            
            {/* Mobile Carousel for features */}
            <div className="md:hidden mb-10">
              <Carousel 
                items={((featuresSection?.content as any)?.features || defaultFeatures).map((feature: any, index: number) => ({
                  ...feature,
                  id: index + 1,
                  icon: React.createElement(feature.icon || Award, { className: "h-[20px] w-[20px] text-primary-foreground" })
                }))}
                baseWidth={300}
                loop={true}
                autoplay={true}
                autoplayDelay={4000}
              />
            </div>
            
            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
              {((featuresSection?.content as any)?.features || defaultFeatures).map((feature: any, index: number) => {
                const IconComponent = typeof feature.icon === 'string' ? (iconMap[feature.icon] || Gift) : feature.icon;
                return (
                  <FeatureCard
                    key={index}
                    icon={IconComponent}
                    title={feature.title}
                    description={feature.description}
                    color={feature.color || 'bg-gradient-to-br from-blue-500 to-purple-500'}
                    index={index}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* ========== FEATURED PRODUCTS ========== */}
        <section className="py-10 sm:py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="mb-10 md:mb-14">
              <SimpleTextReveal className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2 text-center md:text-left">
                {featuredProductsSection?.title || "Featured Products"}
              </SimpleTextReveal>
              <p className="mt-2 text-muted-foreground text-sm md:text-base max-w-xl text-center md:text-left">
                {featuredProductsSection?.subtitle || "Handpicked just for you from our premium collection"}
              </p>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4 animate-pulse">
                    <Skeleton className="aspect-square rounded-2xl bg-muted" />
                    <Skeleton className="h-4 w-3/4 rounded-lg bg-muted" />
                    <Skeleton className="h-4 w-1/2 rounded-lg bg-muted" />
                  </div>
                ))}
              </div>
            ) : featuredProducts && featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {featuredProducts.map((product, index) => (
                  <div 
                    key={product.id} 
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <ProductCard
                      id={product.id}
                      name={product.name}
                      price={Number(product.price)}
                      discount_percentage={product.discount_percentage || 0}
                      image_url={product.image_url}
                      cash_on_delivery={(product as any).cash_on_delivery}
                      images={product.images}
                      stock_status={product.stock_status}
                      stock_quantity={product.stock_quantity}
                      index={index}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-gradient-to-br from-background to-card rounded-3xl border border-border">
                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <Crown className="w-12 h-12 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  Coming Soon!
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  We're preparing an amazing collection of premium products for you.
                </p>
              </div>
            )}

            {/* Mobile View All Button */}
            <div className="text-center mt-6 sm:mt-10 md:hidden">
              <Link to="/products">
                <Button 
                  size="lg" 
                  className="w-full max-w-sm h-12 sm:h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-primary-foreground font-bold shadow-lg shadow-primary/25"
                >
                  View All Products
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ========== CTA SECTION ========== */}
        {ctaSection && (
          <section className="py-12 md:py-20">
            <div className="container mx-auto px-4">
              <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl md:rounded-[2rem] bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-4 sm:p-8 md:p-16 lg:p-20">
                {/* Background Elements - Optimized for mobile */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-60 h-60 bg-gray-700/20 rounded-full blur-2xl hidden sm:block" />
                  <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-gray-700/20 rounded-full blur-2xl hidden sm:block" />
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />
                </div>
                
                <div className="relative z-10 text-center max-w-3xl mx-auto">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-6">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-white">Limited Time Offer</span>
                  </div>
                  
                  <SimpleTextReveal className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white mb-4 sm:mb-6 leading-tight">
                    {ctaSection.title}
                  </SimpleTextReveal>
                  
                  {ctaSection.subtitle && (
                    <p className="text-base sm:text-lg md:text-xl text-white/90 max-w-sm sm:max-w-xl mx-auto mb-6 sm:mb-10">
                      {ctaSection.subtitle}
                    </p>
                  )}
                  
                  <Link to={(ctaSection.content as any)?.buttonLink || '/products'}>
                    <Button 
                      size="lg" 
                      className="h-12 sm:h-14 md:h-16 px-6 sm:px-10 md:px-12 text-base sm:text-lg font-bold bg-white text-primary hover:bg-white/90 rounded-2xl shadow-2xl shadow-black/20 transition-all duration-300 hover:scale-105"
                    >
                      {(ctaSection.content as any)?.buttonText || 'Shop Now'}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========== NEWSLETTER SECTION ========== */}
        <section className="py-10 sm:py-16 md:py-24 bg-gradient-to-b from-gray-900/20 to-gray-800/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 rounded-2xl sm:rounded-3xl md:rounded-[2rem] p-4 sm:p-8 md:p-14 text-center relative overflow-hidden backdrop-blur-sm bg-opacity-30 border border-white/10">
                {/* Background Pattern - Optimized for mobile */}
                <div className="absolute inset-0">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-gray-600/30 rounded-full blur-2xl hidden sm:block" />
                  <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-gray-600/30 rounded-full blur-2xl hidden sm:block" />
                </div>
                
                <div className="relative z-10">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <Mail className="w-10 h-10 text-white" />
                  </div>
                  
                  {isSubscribed ? (
                    <div className="text-center">
                      <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-3 sm:mb-4">
                        Thanks for subscribing us!
                      </h3>
                      <p className="text-white/90 text-sm sm:text-base md:text-lg mb-4 sm:mb-8 max-w-xs sm:max-w-lg mx-auto">
                        You're all set! Look out for our exclusive deals and updates in your inbox.
                      </p>
                      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-green-500/80 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-3 sm:mb-4">
                        Suscribe us for more products
                      </h3>
                      <p className="text-white/90 text-sm sm:text-base md:text-lg mb-4 sm:mb-8 max-w-xs sm:max-w-lg mx-auto">
                        Subscribe to our newsletter and be the first to know about new products and exclusive deals!
                      </p>
                      
                      <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-full sm:max-w-lg mx-auto">
                        <input
                          type="email"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="flex-1 h-12 xs:h-14 sm:h-16 px-3 xs:px-4 sm:px-6 rounded-xl xs:rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
                        />
                        <Button 
                          type="submit"
                          disabled={isSubscribing}
                          className="h-12 sm:h-14 px-6 sm:px-8 bg-gradient-to-r from-gray-200 to-gray-100 text-gray-900 hover:from-gray-100 hover:to-gray-50 rounded-2xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
                        >
                          {isSubscribing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Subscribing...
                            </>
                          ) : (
                            <>
                              Subscribe
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </form>
                    </>
                  )}
                  
                  <p className="text-white/60 text-xs mt-4">
                    By subscribing, you agree to receive marketing emails. Unsubscribe anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== BOTTOM TRUST BAR ========== */}
        <section className="py-6 sm:py-10 border-t border-border">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 md:gap-16">
              <div className="flex flex-col items-center gap-1 sm:gap-3 text-muted-foreground">
                <Truck className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-center">Free Shipping</span>
              </div>
              <div className="flex flex-col items-center gap-1 sm:gap-3 text-muted-foreground">
                <Shield className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-center">Secure Payments</span>
              </div>
              <div className="flex flex-col items-center gap-1 sm:gap-3 text-muted-foreground">
                <RefreshCw className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-center">Easy Returns</span>
              </div>
              <div className="flex flex-col items-center gap-1 sm:gap-3 text-muted-foreground">
                <Headphones className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-center">24/7 Support</span>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    </div>
  );
}
