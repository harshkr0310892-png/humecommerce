import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/products/ProductCard";
import { FilterMenu } from "@/components/products/FilterMenu";
import { SearchBar } from "@/components/SearchBar";
import TopDeals from "@/components/home/TopDeals";
import TextType from "@/components/ui/TextType";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Sparkles, TrendingUp, Zap, ShoppingBag, Star } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";

type FilterType = 'all' | 'in_stock' | 'on_sale';
type SortType = 'name' | 'price_low' | 'price_high';

interface Category {
  id: string;
  name: string;
  image_url?: string;
  parent_id?: string;
  seller_id?: string;
}

// Inline styles for light theme optimization
const styles = `
  .products-page {
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --gold-gradient: linear-gradient(135deg, #f5af19 0%, #f12711 100%);
    --soft-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    --hover-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    --card-bg: #ffffff;
    --section-bg: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  }

  .hero-section {
    background: linear-gradient(135deg, #667eea15 0%, #764ba215 50%, #f5af1910 100%);
    border-radius: 24px;
    position: relative;
    overflow: hidden;
  }

  .hero-section::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 60%;
    height: 200%;
    background: radial-gradient(ellipse, rgba(102, 126, 234, 0.1) 0%, transparent 70%);
    pointer-events: none;
  }

  .hero-section::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -10%;
    width: 40%;
    height: 150%;
    background: radial-gradient(ellipse, rgba(245, 175, 25, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .category-strip {
    background: var(--card-bg);
    border-radius: 20px;
    box-shadow: var(--soft-shadow);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .category-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }

  .category-card:hover {
    transform: translateY(-4px);
  }

  .category-card:hover .category-image {
    transform: scale(1.05);
    box-shadow: var(--hover-shadow);
  }

  .category-image {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: linear-gradient(145deg, #f3f4f6 0%, #e5e7eb 100%);
  }

  .category-card.active .category-image {
    border: 2px solid #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15);
  }

  .category-card.active .category-name {
    color: #667eea;
    font-weight: 600;
  }

  .scroll-container {
    scrollbar-width: none;
    -ms-overflow-style: none;
    scrollbar-color: transparent transparent;
  }

  .scroll-container::-webkit-scrollbar {
    width: 0px;
    height: 0px;
  }

  .scroll-button {
    background: white;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(0, 0, 0, 0.08);
    transition: all 0.2s ease;
  }

  .scroll-button:hover {
    background: #f8fafc;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  }

  .stats-card {
    background: var(--card-bg);
    border-radius: 16px;
    box-shadow: var(--soft-shadow);
    border: 1px solid rgba(0, 0, 0, 0.06);
    transition: all 0.3s ease;
  }

  .stats-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--hover-shadow);
  }

  .product-grid {
    display: grid;
    gap: 20px;
  }

  .filter-section {
    background: var(--card-bg);
    border-radius: 16px;
    box-shadow: var(--soft-shadow);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .gradient-text {
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .gradient-gold-text {
    background: var(--gold-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .deals-section {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%);
    border-radius: 20px;
    position: relative;
    overflow: hidden;
  }

  .deals-section::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    pointer-events: none;
  }

  .badge-new {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 20px;
    font-weight: 600;
  }

  .badge-hot {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 20px;
    font-weight: 600;
  }

  .empty-state {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border: 2px dashed #e2e8f0;
    border-radius: 24px;
  }

  .pagination-button {
    transition: all 0.2s ease;
  }

  .pagination-button:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .pagination-button.active {
    background: var(--primary-gradient);
    color: white;
    border: none;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  .floating-icon {
    animation: float 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .shimmer {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
`;

export default function Products() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const categoryStickyRef = useRef<HTMLDivElement>(null);
  const [categoryStuck, setCategoryStuck] = useState(false);
  const [openMobileCategoryMenu, setOpenMobileCategoryMenu] = useState<string | null>(null);
  const productsPerPage = 12;

  // Handle URL search parameter
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchTerm(decodeURIComponent(searchParam));
    }
  }, [searchParams]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    if (term) {
      setSearchParams({ search: encodeURIComponent(term) });
    } else {
      setSearchParams({});
    }
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 300;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const update = () => {
      const el = categoryStickyRef.current;
      if (!el) return;
      const topOffset = window.innerWidth < 640 ? 64 : 80;
      const stuck = el.getBoundingClientRect().top <= topOffset + 1;
      setCategoryStuck(prev => (prev === stuck ? prev : stuck));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Get parent categories for the category strip
  const parentCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter((c: Category) => c.parent_id == null && c.seller_id == null);
  }, [categories]);

  // Get subcategories for a parent
  const getSubcategories = (parentId: string) => {
    if (!categories) return [];
    return categories.filter((c: Category) => c.parent_id === parentId);
  };

  // Calculate min and max prices from products
  const priceRange = useMemo(() => {
    if (!products || products.length === 0) return { min: 0, max: 10000 };
    const prices = products.map((p: any) => Number(p.price)).filter((p: number) => !isNaN(p));
    if (prices.length === 0) return { min: 0, max: 10000 };
    return {
      min: Math.floor(Math.min(...prices) / 100) * 100,
      max: Math.ceil(Math.max(...prices) / 100) * 100,
    };
  }, [products]);

  // Product stats
  const productStats = useMemo(() => {
    if (!products) return { total: 0, onSale: 0, inStock: 0 };
    return {
      total: products.length,
      onSale: products.filter((p: any) => (p.discount_percentage || 0) > 0).length,
      inStock: products.filter((p: any) => p.stock_status === 'in_stock').length
    };
  }, [products]);

  const filteredProducts = products?.filter((product: any) => {
    // Search filter - case insensitive
    if (searchTerm && !product.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Category filter
    if (selectedCategory !== 'all' && product.category_id !== selectedCategory) {
      return false;
    }
    
    // Stock/Sale filter
    if (filter === 'in_stock') return product.stock_status === 'in_stock';
    if (filter === 'on_sale') return (product.discount_percentage || 0) > 0;
    
    // Price range filter
    const productPrice = Number(product.price);
    if (minPrice !== '' && productPrice < minPrice) return false;
    if (maxPrice !== '' && productPrice > maxPrice) return false;
    
    return true;
  }).sort((a: any, b: any) => {
    // Sorting
    switch (sortBy) {
      case 'price_low':
        return Number(a.price) - Number(b.price);
      case 'price_high':
        return Number(b.price) - Number(a.price);
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Pagination logic
  const totalPages = filteredProducts ? Math.ceil(filteredProducts.length / productsPerPage) : 0;
  const startIndex = (currentPage - 1) * productsPerPage;
  const paginatedProducts = filteredProducts?.slice(startIndex, startIndex + productsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleCategoryCardClick = (categoryId: string, hasSubcategories: boolean) => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && hasSubcategories) {
      setOpenMobileCategoryMenu((prev) => (prev === categoryId ? null : categoryId));
      return;
    }
    setOpenMobileCategoryMenu(null);
    handleCategoryClick(categoryId);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;
    
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    return (
      <div className="flex items-center justify-center gap-2 mt-10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-button rounded-full w-10 h-10 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        {startPage > 1 && (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(1)}
              className="pagination-button rounded-full w-10 h-10 p-0"
            >
              1
            </Button>
            {startPage > 2 && <span className="px-2 text-muted-foreground">...</span>}
          </>
        )}
        
        {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange(page)}
            className={`pagination-button rounded-full w-10 h-10 p-0 ${
              currentPage === page ? 'active' : ''
            }`}
          >
            {page}
          </Button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2 text-muted-foreground">...</span>}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(totalPages)}
              className="pagination-button rounded-full w-10 h-10 p-0"
            >
              {totalPages}
            </Button>
          </>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-button rounded-full w-10 h-10 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  return (
    <Layout>
      <style>{styles}</style>
      <div className="products-page min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 py-8">
          
          {/* Hero Section */}
          <div className="hero-section p-8 md:p-12 mb-8">
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-amber-500 floating-icon" />
                <span className="text-sm font-medium text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                  Premium Collection
                </span>
                <Sparkles className="w-6 h-6 text-amber-500 floating-icon" style={{ animationDelay: '1s' }} />
              </div>
              
              <h1 className="font-display text-4xl md:text-6xl font-bold text-center mb-4">
                <TextType
                  text="Discover Excellence"
                  as="span"
                  className="gradient-text"
                  typingSpeed={80}
                  deletingSpeed={50}
                  pauseDuration={3000}
                  loop={true}
                  showCursor={true}
                  cursorClassName="text-4xl md:text-6xl"
                />
              </h1>
              
              <p className="text-muted-foreground max-w-2xl mx-auto text-center mb-8 text-lg">
                Explore our curated selection of premium products, crafted with excellence 
                and designed for those who appreciate quality.
              </p>
              
              {/* Search Bar */}
              <div className="flex justify-center mb-8">
                <div className="w-full max-w-xl">
                  <SearchBar 
                    onSearch={handleSearch} 
                    placeholder="Search for products, brands, categories..." 
                    initialValue={searchTerm}
                    context="collection"
                  />
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="stats-card p-4 text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 mx-auto mb-2">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-800">{productStats.total}</div>
                  <div className="text-xs text-muted-foreground">Products</div>
                </div>
                <div className="stats-card p-4 text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 mx-auto mb-2">
                    <Zap className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-800">{productStats.onSale}</div>
                  <div className="text-xs text-muted-foreground">On Sale</div>
                </div>
                <div className="stats-card p-4 text-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 mx-auto mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-800">{productStats.inStock}</div>
                  <div className="text-xs text-muted-foreground">In Stock</div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Strip Section */}
          <div ref={categoryStickyRef} className="mb-8 sticky top-16 sm:top-20 z-40">
            <div className={`category-strip ${categoryStuck ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'}`}>
              <div className={categoryStuck ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2" : "flex items-center justify-between mb-4"}>
                {categoryStuck ? (
                  <div className="w-full sm:flex-1 sm:mr-3">
                    <SearchBar
                      onSearch={handleSearch}
                      placeholder="Search products..."
                      initialValue={searchTerm}
                      context="collection"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                    <h2 className="text-xl font-bold text-gray-800">Shop by Category</h2>
                  </div>
                )}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => scrollCategories('left')}
                    className={`scroll-button ${categoryStuck ? 'p-1.5' : 'p-2'} rounded-full`}
                    type="button"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => scrollCategories('right')}
                    className={`scroll-button ${categoryStuck ? 'p-1.5' : 'p-2'} rounded-full`}
                    type="button"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              <div 
                ref={categoryScrollRef}
                className={`scroll-container scrollbar-hide flex items-center gap-4 overflow-x-auto overflow-y-visible ${categoryStuck ? 'pb-1' : 'pb-2'}`}
              >
                {/* Category Cards */}
                {parentCategories.map((category, index) => {
                  const categoryProducts = products?.filter((p: any) => p.category_id === category.id) || [];
                  const isNew = index < 3;
                  const isHot = categoryProducts.length > 10;
                  const subs = getSubcategories(category.id);
                  const hasSubs = subs.length > 0;
                  
                  return (
                    <div
                      key={category.id}
                      onClick={() => handleCategoryCardClick(category.id, hasSubs)}
                      className={`category-card flex-shrink-0 relative group ${
                        selectedCategory === category.id ? 'active' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center p-2 sm:p-3 min-w-[88px] sm:min-w-[100px]">
                        {/* Badge */}
                        {(isNew || isHot) && (
                          <div className="absolute -top-1 -right-1 z-10">
                            <span className={isHot ? 'badge-hot' : 'badge-new'}>
                              {isHot ? 'HOT' : 'NEW'}
                            </span>
                          </div>
                        )}
                        
                        <div className="category-image w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-sm">
                          {category.image_url ? (
                            <img 
                              src={category.image_url} 
                              alt={category.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                              <span className="text-2xl font-bold text-gray-400">
                                {category.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <span className={`category-name text-xs sm:text-sm mt-2 sm:mt-3 font-medium text-gray-700 text-center line-clamp-1 ${
                          selectedCategory === category.id ? 'text-indigo-600' : ''
                        }`}>
                          {category.name}
                        </span>
                        {!categoryStuck && (
                          <span className="text-xs text-muted-foreground mt-1">
                            {categoryProducts.length} items
                          </span>
                        )}
                      </div>

                      {/* Subcategory Dropdown on Hover */}
                      {hasSubs && (
                        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-full mt-3 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200">
                          <div className="bg-white rounded-2xl shadow-2xl p-4 min-w-[520px] border border-gray-100">
                            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
                              Seller Categories
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {subs.map((sub) => (
                                <button
                                  key={sub.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCategoryClick(sub.id);
                                  }}
                                  className="text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors"
                                  type="button"
                                >
                                  {sub.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {openMobileCategoryMenu && (
                <div className="md:hidden mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase">
                      {(() => {
                        const parent = parentCategories.find((c) => c.id === openMobileCategoryMenu);
                        return parent?.name ? `More in ${parent.name}` : "Categories";
                      })()}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => setOpenMobileCategoryMenu(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {getSubcategories(openMobileCategoryMenu).map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        className="px-3 py-2 rounded-lg text-sm text-gray-700 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        onClick={() => {
                          handleCategoryClick(sub.id);
                          setOpenMobileCategoryMenu(null);
                        }}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Deals Section */}
          <div className="deals-section p-6 mb-8">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-amber-600" />
                <h2 className="text-xl font-bold text-amber-800">Flash Deals</h2>
                <span className="badge-hot">Limited Time</span>
              </div>
              <TopDeals containerClassName="px-0" />
            </div>
          </div>

          {/* Filter Section */}
          <div className="filter-section p-4 mb-8">
            <FilterMenu
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              filter={filter}
              setFilter={setFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              minPrice={minPrice}
              setMinPrice={setMinPrice}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
              minProductPrice={priceRange.min}
              maxProductPrice={priceRange.max}
            />
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {paginatedProducts?.length || 0} of {filteredProducts?.length || 0} products
              </span>
              {searchTerm && (
                <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                  "{searchTerm}"
                </span>
              )}
            </div>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => handleCategoryClick('all')}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                Clear filters
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="product-grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="space-y-3 bg-white p-4 rounded-2xl shadow-sm">
                  <Skeleton className="aspect-square rounded-xl shimmer" />
                  <Skeleton className="h-4 w-3/4 shimmer" />
                  <Skeleton className="h-4 w-1/2 shimmer" />
                </div>
              ))}
            </div>
          ) : paginatedProducts && paginatedProducts.length > 0 ? (
            <>
              <div className="product-grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {paginatedProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={Number(product.price)}
                    discount_percentage={product.discount_percentage || 0}
                    image_url={product.image_url}
                    cash_on_delivery={(product as any).cash_on_delivery}
                    stock_status={product.stock_status}
                    index={index}
                  />
                ))}
              </div>
              {renderPagination()}
            </>
          ) : (
            <div className="empty-state text-center py-20 px-8">
              <Crown className="w-20 h-20 text-indigo-200 mx-auto mb-6 floating-icon" />
              <h3 className="font-display text-2xl font-bold text-gray-700 mb-3">
                No products found
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {searchTerm 
                  ? `No products match "${searchTerm}". Try a different search term.` 
                  : filter !== 'all' || selectedCategory !== 'all' || minPrice !== '' || maxPrice !== ''
                  ? 'Try adjusting your filters to see more products.' 
                  : 'Check back soon for our amazing collection!'}
              </p>
              <Button
                onClick={() => {
                  setFilter('all');
                  setSelectedCategory('all');
                  setMinPrice('');
                  setMaxPrice('');
                  setSearchTerm('');
                }}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
              >
                Reset All Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
