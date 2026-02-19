import { useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin, Leaf, Recycle, TreePine, Plus, Minus, Youtube, Linkedin, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Footer = () => {
  const [isQuickLinksOpen, setIsQuickLinksOpen] = useState(false);
  const [isCommitmentOpen, setIsCommitmentOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(() => {
    // Check if user has already subscribed in local storage
    return localStorage.getItem('newsletter_subscribed') === 'true';
  });
  
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
    
    const isBanned = await checkIsBanned(email);
    if (isBanned) {
      toast.error("You are banned");
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

  return (
    <footer 
      className="relative text-white/90 pt-16 pb-6 px-4 border-t border-white/[0.08]"
      style={{
        background: `
          radial-gradient(1200px 500px at 10% 0%, rgba(124,92,255,0.35), transparent 60%),
          radial-gradient(900px 450px at 90% 10%, rgba(34,197,94,0.25), transparent 55%),
          linear-gradient(180deg, #0f1833, #0b1020)
        `
      }}
    >
      <div className="max-w-[1100px] mx-auto">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-8">
          
          {/* Brand Card */}
          <div className="p-5 bg-white/[0.06] border border-white/[0.12] rounded-[18px] backdrop-blur-[10px] shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <span 
                className="font-bold text-lg tracking-wide"
                style={{
                  background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0.8))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Kiran Store
              </span>
            </div>
            
            <p className="text-white/65 text-sm leading-relaxed mb-4">
              Your premier destination for sustainable, eco-friendly products that care for both you and the planet.
            </p>
            
            <div className="flex items-center gap-2 text-xs text-emerald-400 mb-5">
              <TreePine className="w-4 h-4" />
              <span>Committed to sustainability & carbon neutrality</span>
            </div>
            
            {/* Social Icons */}
            <div className="flex gap-2.5 flex-wrap">
              {[
                { icon: Facebook, href: "#" },
                { icon: Twitter, href: "#" },
                { icon: Instagram, href: "#" },
                { icon: Youtube, href: "#" },
                { icon: Linkedin, href: "#" },
              ].map((social, index) => (
                <a 
                  key={index}
                  href={social.href} 
                  className="w-[42px] h-[42px] rounded-xl grid place-items-center border border-white/[0.12] bg-white/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-500/20 hover:border-violet-500/40"
                >
                  <social.icon className="w-5 h-5 text-white/80" />
                </a>
              ))}
            </div>
          </div>

          {/* Footer Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 content-start">
            
            {/* Quick Links */}
            <div className="p-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[0.95rem] text-white/90 font-semibold tracking-wide">
                  Quick Links
                </h4>
                <button 
                  className="lg:hidden w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center transition-transform duration-300 hover:scale-110 border border-violet-500/30"
                  onClick={() => setIsQuickLinksOpen(!isQuickLinksOpen)}
                >
                  {isQuickLinksOpen ? (
                    <Minus className="w-4 h-4 text-violet-300" />
                  ) : (
                    <Plus className="w-4 h-4 text-violet-300" />
                  )}
                </button>
              </div>
              <div 
                className={`flex flex-col overflow-hidden transition-all duration-500 ease-in-out ${
                  isQuickLinksOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 lg:max-h-96 lg:opacity-100'
                }`}
              >
                {['Shop Collection', 'View Cart', 'Track Order', 'Contact Us', 'FAQs', 'Privacy Policy'].map((link, index) => {
                  // Map specific links to their correct routes
                  let linkTo = `/${link.toLowerCase().replace(' ', '-')}`;
                  if (link === 'FAQs') {
                    linkTo = '/faq';
                  } else if (link === 'Privacy Policy') {
                    linkTo = '/privacy';
                  } else if (link === 'Shop Collection') {
                    linkTo = '/products';
                  } else if (link === 'View Cart') {
                    linkTo = '/cart';
                  }
                  
                  return (
                    <Link 
                      key={index}
                      to={linkTo} 
                      className="inline-block py-1.5 text-white/65 text-sm transition-all duration-150 hover:text-white hover:translate-x-0.5"
                    >
                      {link}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Our Commitment */}
            <div className="p-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[0.95rem] text-white/90 font-semibold tracking-wide">
                  Commitment
                </h4>
                <button 
                  className="lg:hidden w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center transition-transform duration-300 hover:scale-110 border border-violet-500/30"
                  onClick={() => setIsCommitmentOpen(!isCommitmentOpen)}
                >
                  {isCommitmentOpen ? (
                    <Minus className="w-4 h-4 text-violet-300" />
                  ) : (
                    <Plus className="w-4 h-4 text-violet-300" />
                  )}
                </button>
              </div>
              <div 
                className={`flex flex-col gap-3 overflow-hidden transition-all duration-500 ease-in-out ${
                  isCommitmentOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 lg:max-h-96 lg:opacity-100'
                }`}
              >
                {[
                  { icon: Recycle, title: 'Zero Waste', desc: '100% recyclable packaging' },
                  { icon: TreePine, title: 'Carbon Neutral', desc: 'Offset all emissions' },
                  { icon: Leaf, title: 'Eco Materials', desc: 'Sustainably sourced' },
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg group-hover:shadow-emerald-500/25 transition-all">
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">{item.title}</p>
                      <p className="text-white/50 text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="p-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[0.95rem] text-white/90 font-semibold tracking-wide">
                  Contact Us
                </h4>
                <button 
                  className="lg:hidden w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center transition-transform duration-300 hover:scale-110 border border-violet-500/30"
                  onClick={() => setIsContactOpen(!isContactOpen)}
                >
                  {isContactOpen ? (
                    <Minus className="w-4 h-4 text-violet-300" />
                  ) : (
                    <Plus className="w-4 h-4 text-violet-300" />
                  )}
                </button>
              </div>
              <div 
                className={`flex flex-col gap-3 overflow-hidden transition-all duration-500 ease-in-out ${
                  isContactOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 lg:max-h-96 lg:opacity-100'
                }`}
              >
                {[
                  { icon: Mail, title: 'Email', value: 'support@kiranstore.com' },
                  { icon: Phone, title: 'Phone', value: '+91 9876543210' },
                  { icon: MapPin, title: 'Address', value: '123 Green Ave, Mumbai' },
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg group-hover:shadow-violet-500/25 transition-all">
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">{item.title}</p>
                      <p className="text-white/50 text-xs">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="p-2">
              <h4 className="text-[0.95rem] text-white/90 font-semibold tracking-wide mb-3">
                Newsletter
              </h4>
              {isSubscribed ? (
                <div className="text-center">
                  <p className="text-white/65 text-sm leading-relaxed mb-3">
                    Thanks for subscribing us!
                  </p>
                  <div className="w-8 h-8 mx-auto mb-3 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">
                    You're all set! Look out for our exclusive deals in your inbox.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-white/65 text-sm leading-relaxed mb-3">
                    Subscribe for eco-tips and exclusive offers.
                  </p>
                  <form onSubmit={handleSubscribe} className="grid grid-cols-1 gap-2.5 mb-2.5">
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-3 py-2.5 rounded-xl border border-white/[0.12] bg-black/20 text-white/90 text-sm outline-none placeholder:text-white/45 focus:border-violet-500/60 focus:shadow-[0_0_0_4px_rgba(124,92,255,0.18)] transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={isSubscribing}
                      className="w-full py-2.5 px-4 rounded-xl border border-violet-500/60 bg-gradient-to-br from-violet-500/95 to-violet-600/70 text-white font-bold text-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 flex items-center justify-center gap-2"
                    >
                      {isSubscribing ? (
                        <>
                          <Send className="w-4 h-4 animate-spin" />
                          Subscribing...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Subscribe
                        </>
                      )}
                    </button>
                  </form>
                  <small className="text-white/50 text-xs leading-relaxed">
                    By subscribing, you agree to our{' '}
                    <Link to="/privacy" className="text-white/75 underline underline-offset-2 hover:text-white">
                      Privacy Policy
                    </Link>
                  </small>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="max-w-[1100px] mx-auto mt-7 pt-5 border-t border-white/[0.09] flex flex-col sm:flex-row items-center justify-between gap-3 text-white/50 text-sm">
          <p>© 2024 Kiran Store. All rights reserved.</p>
          
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Leaf className="w-3.5 h-3.5" />
              Plastic Free
            </span>
            <span className="flex items-center gap-1.5 text-violet-400">
              <Recycle className="w-3.5 h-3.5" />
              Recyclable
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <TreePine className="w-3.5 h-3.5" />
              Carbon Neutral
            </span>
          </div>
          
          <div className="flex gap-4 flex-wrap">
            {['Terms', 'Privacy', 'Cookies'].map((link, index) => (
              <Link 
                key={index}
                to={`/${link.toLowerCase()}`} 
                className="text-white/50 hover:text-white/90 transition-colors py-1"
              >
                {link}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
