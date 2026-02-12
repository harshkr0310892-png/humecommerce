import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import React, { JSX } from 'react';
import { Truck, Shield, RefreshCw, Headphones, Star } from 'lucide-react';

// --- Types ---
export interface CarouselItem {
  title: string;
  description: string;
  id: number;
  icon: React.ReactNode;
}

export interface CarouselProps {
  items?: CarouselItem[];
  baseWidth?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  round?: boolean;
  alignment?: 'center' | 'right' | 'left';
}

// --- Data ---
const DEFAULT_ITEMS: CarouselItem[] = [
  {
    title: 'Lightning Fast',
    description: 'Orders delivered in 2-3 days. Free shipping over $50.',
    id: 1,
    icon: <Truck className="h-6 w-6 text-white" />
  },
  {
    title: 'Secure Payments',
    description: 'Your info is processed securely. We support all major cards.',
    id: 2,
    icon: <Shield className="h-6 w-6 text-white" />
  },
  {
    title: 'Easy Returns',
    description: '7-day hassle-free returns. Full refunds guaranteed.',
    id: 3,
    icon: <RefreshCw className="h-6 w-6 text-white" />
  },
  {
    title: '24/7 Support',
    description: 'Our team is here to help via chat, email, or phone.',
    id: 4,
    icon: <Headphones className="h-6 w-6 text-white" />
  },
  {
    title: 'Trusted Service',
    description: 'Join thousands of satisfied customers who trust us.',
    id: 5,
    icon: <Star className="h-6 w-6 text-white" />
  }
];

// --- Constants ---
const DRAG_BUFFER = 0;
const VELOCITY_THRESHOLD = 500;
const GAP = 16;
const SPRING_OPTIONS = { type: 'spring' as const, stiffness: 300, damping: 30 };

// --- Sub-Component: Item ---
interface CarouselItemProps {
  item: CarouselItem;
  index: number;
  itemWidth: number;
  itemHeight: number;
  round: boolean;
  trackItemOffset: number;
  x: any;
}

function CarouselItemCard({ 
  item, 
  index, 
  itemWidth, 
  itemHeight,
  round, 
  trackItemOffset, 
  x 
}: CarouselItemProps) {
  const range = [
    -(index + 1) * trackItemOffset, 
    -index * trackItemOffset, 
    -(index - 1) * trackItemOffset
  ];
  
  const rotateY = useTransform(x, range, [45, 0, -45], { clamp: false });
  const opacity = useTransform(x, range, [0.5, 1, 0.5], { clamp: false });
  const scale = useTransform(x, range, [0.9, 1, 0.9], { clamp: false });

  return (
    <motion.div
      className={`relative shrink-0 flex flex-col overflow-hidden cursor-grab active:cursor-grabbing select-none ${
        round
          ? 'items-center justify-center text-center rounded-full border-2 border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-900'
          : 'items-start justify-start rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md'
      }`}
      style={{
        width: itemWidth,
        height: round ? itemWidth : itemHeight,
        rotateY,
        opacity,
        scale,
      }}
    >
      {/* Glossy overlay */}
      {!round && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Content wrapper with proper padding */}
      <div className={`relative z-10 flex flex-col h-full w-full ${
        round ? 'items-center justify-center p-6' : 'p-5'
      }`}>
        {/* Icon */}
        <div className={`${round ? 'mb-3' : 'mb-4'}`}>
          <span className={`flex items-center justify-center ${
            round 
              ? 'h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30' 
              : 'h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25'
          }`}>
            {item.icon}
          </span>
        </div>

        {/* Text */}
        <div className={round ? 'px-2' : ''}>
          <h3 className={`font-semibold text-white tracking-tight leading-tight ${
            round ? 'text-base mb-1.5' : 'text-lg mb-2'
          }`}>
            {item.title}
          </h3>
          <p className={`font-normal leading-relaxed ${
            round ? 'text-xs text-gray-400' : 'text-sm text-gray-400'
          }`}>
            {item.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// --- Main Component ---
export default function Carousel({
  items = DEFAULT_ITEMS,
  baseWidth = 320,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  loop = false,
  round = false,
  alignment = 'center'
}: CarouselProps): JSX.Element {
  
  // Fixed padding values
  const containerPadding = 24; // matches p-6
  const itemWidth = baseWidth - (containerPadding * 2);
  const itemHeight = round ? itemWidth : 220; // Fixed height for non-round items
  const trackItemOffset = itemWidth + GAP;
  
  // Container height calculation
  const containerHeight = round 
    ? baseWidth 
    : itemHeight + (containerPadding * 2) + 40; // 40px for pagination area

  const itemsForRender = useMemo(() => {
    if (!loop) return items;
    if (items.length === 0) return [];
    return [items[items.length - 1], ...items, items[0]];
  }, [items, loop]);

  const [position, setPosition] = useState<number>(loop ? 1 : 0);
  const x = useMotionValue(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isJumping, setIsJumping] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pauseOnHover && containerRef.current) {
      const container = containerRef.current;
      const handleMouseEnter = () => setIsHovered(true);
      const handleMouseLeave = () => setIsHovered(false);
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [pauseOnHover]);

  useEffect(() => {
    if (!autoplay || itemsForRender.length <= 1) return undefined;
    if (pauseOnHover && isHovered) return undefined;

    const timer = setInterval(() => {
      setPosition(prev => Math.min(prev + 1, itemsForRender.length - 1));
    }, autoplayDelay);

    return () => clearInterval(timer);
  }, [autoplay, autoplayDelay, isHovered, pauseOnHover, itemsForRender.length]);

  useEffect(() => {
    const startingPosition = loop ? 1 : 0;
    setPosition(startingPosition);
    x.set(-startingPosition * trackItemOffset);
  }, [items.length, loop, trackItemOffset, x]);

  useEffect(() => {
    if (!loop && position > itemsForRender.length - 1) {
      setPosition(Math.max(0, itemsForRender.length - 1));
    }
  }, [itemsForRender.length, loop, position]);

  const effectiveTransition = isJumping ? { duration: 0 } : SPRING_OPTIONS;

  const handleAnimationStart = () => setIsAnimating(true);

  const handleAnimationComplete = () => {
    if (!loop || itemsForRender.length <= 1) {
      setIsAnimating(false);
      return;
    }
    const lastCloneIndex = itemsForRender.length - 1;

    if (position === lastCloneIndex) {
      setIsJumping(true);
      const target = 1;
      setPosition(target);
      x.set(-target * trackItemOffset);
      requestAnimationFrame(() => {
        setIsJumping(false);
        setIsAnimating(false);
      });
      return;
    }

    if (position === 0) {
      setIsJumping(true);
      const target = items.length;
      setPosition(target);
      x.set(-target * trackItemOffset);
      requestAnimationFrame(() => {
        setIsJumping(false);
        setIsAnimating(false);
      });
      return;
    }

    setIsAnimating(false);
  };

  const handleDragEnd = (_: any, info: PanInfo): void => {
    const { offset, velocity } = info;
    const direction =
      offset.x < -DRAG_BUFFER || velocity.x < -VELOCITY_THRESHOLD
        ? 1
        : offset.x > DRAG_BUFFER || velocity.x > VELOCITY_THRESHOLD
          ? -1
          : 0;

    if (direction === 0) return;

    setPosition(prev => {
      const next = prev + direction;
      const max = itemsForRender.length - 1;
      return Math.max(0, Math.min(next, max));
    });
  };

  const dragProps = loop
    ? {}
    : {
        dragConstraints: {
          left: -trackItemOffset * Math.max(itemsForRender.length - 1, 0),
          right: 0
        }
      };

  const activeIndex =
    items.length === 0 
      ? 0 
      : loop 
        ? (position - 1 + items.length) % items.length 
        : Math.min(position, items.length - 1);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${
        round 
          ? 'rounded-full border border-white/20 bg-neutral-900/80' 
          : 'rounded-3xl border border-white/10 bg-neutral-950/90 shadow-2xl shadow-black/50'
      } ${
        alignment === 'center' ? 'mx-auto' : 
        alignment === 'right' ? 'ml-auto' : 
        ''
      }`}
      style={{
        width: baseWidth,
        height: containerHeight,
        padding: containerPadding,
      }}
    >
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 bg-indigo-500/15 blur-[80px] rounded-full pointer-events-none" />

      {/* Carousel Track */}
      <motion.div
        className="flex"
        drag={isAnimating ? false : 'x'}
        {...dragProps}
        style={{
          gap: GAP,
          perspective: 1000,
          perspectiveOrigin: `${position * trackItemOffset + itemWidth / 2}px 50%`,
          x,
          height: round ? '100%' : itemHeight,
          alignItems: 'center',
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: -(position * trackItemOffset) }}
        transition={effectiveTransition}
        onAnimationStart={handleAnimationStart}
        onAnimationComplete={handleAnimationComplete}
      >
        {itemsForRender.map((item, index) => (
          <CarouselItemCard
            key={`${item?.id ?? index}-${index}`}
            item={item}
            index={index}
            itemWidth={itemWidth}
            itemHeight={itemHeight}
            round={round}
            trackItemOffset={trackItemOffset}
            x={x}
          />
        ))}
      </motion.div>

      {/* Pagination Dots */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 z-20"
        style={{ 
          bottom: round ? containerPadding : 12 
        }}
      >
        <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 backdrop-blur-sm border border-white/10">
          {items.map((_, index) => (
            <motion.button
              key={index}
              className={`rounded-full transition-all duration-300 ${
                activeIndex === index
                  ? 'w-5 h-1.5 bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]'
                  : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
              }`}
              onClick={() => setPosition(loop ? index + 1 : index)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}