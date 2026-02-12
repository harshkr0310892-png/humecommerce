import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  link_url: string | null;
}

const getTransformedImageUrl = (imageUrl: string, width: number, height: number) => {
  try {
    const url = new URL(imageUrl);
    if (url.hostname.includes('supabase')) {
      url.searchParams.set('width', width.toString());
      url.searchParams.set('height', height.toString());
      url.searchParams.set('quality', '90');
      url.searchParams.set('resize', 'cover');
    }
    return url.toString();
  } catch (error) {
    return imageUrl;
  }
};

interface BannerCarouselProps {
  categories?: any[];
}

export function BannerCarousel({ categories }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isAutoTransition, setIsAutoTransition] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState<Set<number>>(new Set([0]));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const SLIDE_DURATION = 2200;
  const ANIMATION_DURATION = 300;
  const AUTO_ANIMATION_DURATION = 300;
  const minSwipeDistance = 50;

  const { data: banners, isLoading } = useQuery({
    queryKey: ['home-banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Banner[];
    },
  });

  // Preload next image
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    const nextIndex = (currentIndex + 1) % banners.length;
    const prevIndex = (currentIndex - 1 + banners.length) % banners.length;
    
    [nextIndex, prevIndex].forEach(idx => {
      if (!imagesLoaded.has(idx)) {
        const img = new Image();
        img.src = getTransformedImageUrl(banners[idx].image_url, 1920, 1080);
        img.onload = () => {
          setImagesLoaded(prev => new Set([...prev, idx]));
        };
      }
    });
  }, [currentIndex, banners, imagesLoaded]);

  const goToSlide = useCallback((index: number, dir: 'next' | 'prev', isAuto: boolean = false) => {
    if (isAnimating || !banners || banners.length === 0) return;
    
    setIsAnimating(true);
    setIsAutoTransition(isAuto);
    setDirection(dir);
    setPreviousIndex(currentIndex);
    setCurrentIndex(index);
    setProgress(0);

    const duration = isAuto ? AUTO_ANIMATION_DURATION : ANIMATION_DURATION;
    
    setTimeout(() => {
      setIsAnimating(false);
      setIsAutoTransition(false);
    }, duration);
  }, [banners, currentIndex, isAnimating]);

  const nextSlide = useCallback((isAuto: boolean = false) => {
    if (!banners || banners.length === 0) return;
    const nextIndex = (currentIndex + 1) % banners.length;
    goToSlide(nextIndex, 'next', isAuto);
  }, [banners, currentIndex, goToSlide]);

  const prevSlide = useCallback(() => {
    if (!banners || banners.length === 0) return;
    const prevIndex = (currentIndex - 1 + banners.length) % banners.length;
    goToSlide(prevIndex, 'prev', false);
  }, [banners, currentIndex, goToSlide]);

  // Smooth progress bar animation using requestAnimationFrame
  useEffect(() => {
    if (!banners || banners.length <= 1 || isPaused || isAnimating) {
      return;
    }

    let startTime: number | null = null;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const newProgress = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      
      setProgress(newProgress);

      if (newProgress < 100) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Auto transition with smooth effect
        nextSlide(true);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [banners, currentIndex, isPaused, isAnimating, nextSlide]);

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      nextSlide(false);
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  // Close open seller menus on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (openMenuFor) {
        const menuEl = document.getElementById(`seller-menu-${openMenuFor}`);
        if (menuEl && !menuEl.contains(target)) {
          setOpenMenuFor(null);
        }
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openMenuFor]);

  if (isLoading) {
    return (
      <div className="w-full aspect-[21/9] md:aspect-[3/1] rounded-2xl overflow-hidden">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];
  const previousBanner = banners[previousIndex];
  const animDuration = isAutoTransition ? AUTO_ANIMATION_DURATION : ANIMATION_DURATION;

  const BannerContent = () => (
    <div 
      className="relative w-full aspect-[21/9] md:aspect-[3/1] rounded-2xl overflow-hidden group"
      style={{
        background: 'linear-gradient(135deg, #0f1833 0%, #1a1a2e 50%, #0b1020 100%)',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Category strip overlay (top) */}
      {categories && categories.length > 0 && (
        <div className="absolute top-4 left-0 right-0 z-20 pointer-events-auto">
          <div className="container mx-auto px-4">
            <div className="bg-black/40 backdrop-blur-xl rounded-xl p-2 inline-flex gap-4 overflow-x-auto hide-scrollbar border border-white/10">
              {categories.filter((c: any) => c.parent_id == null && c.seller_id == null).slice(0, 12).map((cat: any) => (
                <div key={cat.id} className="relative group/cat">
                  <a
                    href={`/products?category=${encodeURIComponent(cat.id)}`}
                    className="flex flex-col items-center text-center min-w-[72px] transition-transform duration-300 hover:scale-105"
                  >
                    <div className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur overflow-hidden flex items-center justify-center border border-white/20 transition-all duration-300 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/20">
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-sm text-white/70 font-medium">{cat.name?.charAt(0)}</div>
                      )}
                    </div>
                    <span className="text-xs mt-1.5 text-white/80 font-medium">{cat.name}</span>
                  </a>

                  {/* Hover flyout */}
                  <div className="hidden md:block absolute left-0 top-full mt-2 z-50">
                    <div 
                      ref={containerRef} 
                      className={cn(
                        "min-w-[220px] bg-black/80 backdrop-blur-xl rounded-xl shadow-2xl p-2 transition-all duration-300 border border-white/10",
                        openMenuFor === cat.id ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none',
                        "group-hover/cat:opacity-100 group-hover/cat:translate-y-0 group-hover/cat:pointer-events-auto"
                      )}
                    >
                      {(() => {
                        const children = (categories.filter((ch: any) => ch.parent_id === cat.id && ch.seller_id) || []);
                        const grouped: Record<string, any[]> = {};
                        children.forEach((c: any) => {
                          const key = c.seller_id || 'unknown';
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(c);
                        });

                        return Object.entries(grouped).map(([sellerId, items]) => (
                          <div key={sellerId} className="mb-2">
                            <div className="px-3 py-1.5 text-sm font-semibold text-white/90 border-b border-white/10">{(items[0] as any).seller_name || 'Seller'}</div>
                            <div>
                              {items.map((ch: any) => (
                                <a 
                                  key={ch.id} 
                                  href={`/products?category=${encodeURIComponent(ch.id)}`} 
                                  className="block px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                                >
                                  {ch.name}
                                </a>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Banner Images with Enhanced Animation */}
      <div className="absolute inset-0">
        {/* All banner images - stacked */}
        {banners.map((banner, index) => {
          const isCurrent = index === currentIndex;
          const isPrevious = index === previousIndex && isAnimating;
          const isVisible = isCurrent || isPrevious;

          if (!isVisible) return null;

          return (
            <div
              key={banner.id}
              className="absolute inset-0"
              style={{
                zIndex: isCurrent ? 20 : 10,
                animation: isAnimating
                  ? isCurrent
                    ? isAutoTransition
                      ? `smoothFadeSlideIn ${animDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
                      : `${direction === 'next' ? 'slideInRight' : 'slideInLeft'} ${animDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
                    : isAutoTransition
                      ? `smoothFadeSlideOut ${animDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
                      : `${direction === 'next' ? 'slideOutLeft' : 'slideOutRight'} ${animDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
                  : 'none',
              }}
            >
              <div 
                className="w-full h-full overflow-hidden"
                style={{
                  animation: isCurrent && !isAnimating 
                    ? `kenBurnsZoom ${SLIDE_DURATION + 1000}ms ease-out forwards` 
                    : 'none',
                }}
              >
                <img
                  src={getTransformedImageUrl(banner.image_url, 1920, 1080)}
                  alt={banner.title || 'Banner'}
                  className="w-full h-full object-cover"
                  loading={index <= 1 ? "eager" : "lazy"}
                />
              </div>
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/30" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            </div>
          );
        })}
      </div>

      {/* Content with staggered animation */}
      {(currentBanner.title || currentBanner.subtitle) && (
        <div className="absolute inset-0 z-30 flex items-center">
          <div className="container mx-auto px-4">
            <div className="max-w-lg">
              {currentBanner.title && (
                <h2 
                  className="font-display text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4"
                  style={{
                    animation: isAnimating 
                      ? `textSlideUp ${animDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards` 
                      : 'none',
                    animationDelay: isAnimating ? '150ms' : '0ms',
                    opacity: isAnimating ? 0 : 1,
                    transform: isAnimating ? 'translateY(40px)' : 'translateY(0)',
                  }}
                >
                  <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-lg">
                    {currentBanner.title}
                  </span>
                </h2>
              )}
              {currentBanner.subtitle && (
                <p 
                  className="text-sm md:text-lg text-white/90 max-w-md"
                  style={{
                    animation: isAnimating 
                      ? `textSlideUp ${animDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards` 
                      : 'none',
                    animationDelay: isAnimating ? '300ms' : '0ms',
                    opacity: isAnimating ? 0 : 1,
                    transform: isAnimating ? 'translateY(40px)' : 'translateY(0)',
                  }}
                >
                  {currentBanner.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); prevSlide(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:border-white/40 active:scale-95"
            disabled={isAnimating}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); nextSlide(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/20 hover:scale-110 hover:border-white/40 active:scale-95"
            disabled={isAnimating}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Play/Pause Button */}
      {banners.length > 1 && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPaused(!isPaused); }}
          className="absolute bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/20 active:scale-95"
        >
          {isPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
        </button>
      )}

      {/* Enhanced Progress Bar & Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                if (index !== currentIndex && !isAnimating) {
                  goToSlide(index, index > currentIndex ? 'next' : 'prev', false);
                }
              }}
              className={cn(
                "relative transition-all duration-500 overflow-hidden rounded-full",
                index === currentIndex ? "w-12 h-2" : "w-2 h-2 hover:w-3 hover:h-3"
              )}
              style={{
                background: 'rgba(255,255,255,0.25)',
                boxShadow: index === currentIndex ? '0 0 10px rgba(255,255,255,0.3)' : 'none',
              }}
              disabled={isAnimating}
            >
              {index === currentIndex && (
                <div 
                  className="absolute left-0 top-0 h-full rounded-full transition-none"
                  style={{ 
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,1))',
                    boxShadow: '0 0 8px rgba(255,255,255,0.5)',
                  }}
                />
              )}
              {index !== currentIndex && (
                <div className="absolute inset-0 bg-white/60 hover:bg-white/80 rounded-full transition-colors duration-200" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Slide Counter with Animation */}
      {banners.length > 1 && (
        <div 
          className="absolute bottom-4 left-4 z-40 bg-black/30 backdrop-blur-md rounded-full px-3 py-1.5 text-white/80 text-sm font-medium border border-white/10 overflow-hidden"
          style={{
            animation: isAnimating ? 'counterPulse 0.3s ease-out' : 'none',
          }}
        >
          <span 
            className="inline-block text-white font-bold"
            style={{
              animation: isAnimating ? 'numberFlip 0.4s ease-out' : 'none',
            }}
          >
            {currentIndex + 1}
          </span>
          <span className="text-white/50"> / {banners.length}</span>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0.3;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0.3;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOutLeft {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0.3;
          }
        }

        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0.3;
          }
        }

        /* Smooth auto-transition animations */
        @keyframes smoothFadeSlideIn {
          0% {
            transform: translateX(30px) scale(1.02);
            opacity: 0;
            filter: blur(4px);
          }
          40% {
            filter: blur(0px);
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
            filter: blur(0px);
          }
        }

        @keyframes smoothFadeSlideOut {
          0% {
            transform: translateX(0) scale(1);
            opacity: 1;
            filter: blur(0px);
          }
          60% {
            filter: blur(2px);
          }
          100% {
            transform: translateX(-30px) scale(0.98);
            opacity: 0;
            filter: blur(4px);
          }
        }

        @keyframes textSlideUp {
          0% {
            transform: translateY(40px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes kenBurnsZoom {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.08);
          }
        }

        @keyframes counterPulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes numberFlip {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );

  if (currentBanner.link_url) {
    return (
      <Link to={currentBanner.link_url} className="block">
        <BannerContent />
      </Link>
    );
  }

  return <BannerContent />;
}