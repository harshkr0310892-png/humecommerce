import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface PopupOffer {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  button_text: string;
  button_link: string;
}

export function SpecialOfferPopup() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [popup, setPopup] = useState<PopupOffer | null>(null);

  useEffect(() => {
    const checkPopup = async () => {
      // Check if popup was already shown this session
      const shownKey = 'offer_popup_shown';
      if (sessionStorage.getItem(shownKey)) return;

      const { data, error } = await supabase
        .from('popup_offers')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      setPopup(data);
      
      // Delay popup appearance for better UX
      setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem(shownKey, 'true');
      }, 2000);
    };

    checkPopup();
  }, []);

  const handleAction = () => {
    if (popup?.button_link) {
      navigate(popup.button_link);
    }
    setIsOpen(false);
  };

  if (!popup) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[420px] p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <DialogTitle className="sr-only">Special Offer</DialogTitle>
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#070A12] via-[#0B1430] to-[#070A12] shadow-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-70" style={{
            background:
              'radial-gradient(600px 300px at 20% 10%, rgba(212,175,55,0.18), transparent 60%), radial-gradient(500px 250px at 90% 20%, rgba(59,130,246,0.18), transparent 55%), radial-gradient(700px 350px at 50% 100%, rgba(16,185,129,0.10), transparent 60%)'
          }} />

          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur hover:bg-white/15 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {popup.image_url ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              <img
                src={popup.image_url}
                alt={popup.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070A12] via-[#070A12]/30 to-transparent" />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-black/30 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Limited-time offer
              </div>
            </div>
          ) : (
            <div className="relative px-6 pt-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-white/5 px-3 py-1 text-xs font-semibold text-amber-200">
                <Sparkles className="h-4 w-4" />
                Limited-time offer
              </div>
            </div>
          )}

          <div className="px-6 pb-6 pt-5 text-center text-white">
            <h2 className="font-display text-xl font-bold leading-snug text-white sm:text-2xl">
              {popup.title}
            </h2>

            {popup.description && (
              <p className="mt-2 text-sm text-white/80">
                {popup.description}
              </p>
            )}

            <div className="mt-6 grid gap-3">
              <Button
                variant="royal"
                size="lg"
                onClick={handleAction}
                className="w-full"
              >
                {popup.button_text}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsOpen(false)}
                className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
