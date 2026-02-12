import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  Ban,
  Loader2,
  RefreshCw,
  Link as LinkIcon,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Seller {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_banned: boolean;
  created_at: string;
  updated_at?: string;
}

interface SellerForm {
  name: string;
  email: string;
  is_active: boolean;
}

export const SellersManager = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerDialogOpen, setSellerDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [sellerForm, setSellerForm] = useState<SellerForm>({
    name: "",
    email: "",
    is_active: true,
  });
  const queryClient = useQueryClient();

  const { data: fetchedSellers, isLoading, refetch } = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Seller[];
    },
  });

  useEffect(() => {
    if (fetchedSellers) {
      setSellers(fetchedSellers);
    }
  }, [fetchedSellers]);

  const sellerMutation = useMutation({
    mutationFn: async (sellerData: SellerForm & { id?: string }) => {
      const data = {
        name: sellerData.name,
        email: sellerData.email,
        is_active: sellerData.is_active,
        is_banned: sellerData.id ? editingSeller?.is_banned : false,
      };

      if (sellerData.id) {
        const { error } = await supabase
          .from("sellers")
          .update(data)
          .eq("id", sellerData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sellers").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success(editingSeller ? "Seller updated!" : "Seller created!");
      resetSellerForm();
      setSellerDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error saving seller:", error);
      toast.error("Failed to save seller");
    },
  });

  const deleteSellerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sellers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success("Seller deleted!");
    },
    onError: (error) => {
      console.error("Error deleting seller:", error);
      toast.error("Failed to delete seller");
    },
  });

  const banSellerMutation = useMutation({
    mutationFn: async ({ id, is_banned }: { id: string; is_banned: boolean }) => {
      const { error } = await supabase
        .from("sellers")
        .update({ is_banned })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success("Seller status updated!");
    },
    onError: (error) => {
      console.error("Error updating seller ban status:", error);
      toast.error("Failed to update seller status");
    },
  });

  const resetSellerForm = () => {
    setSellerForm({
      name: "",
      email: "",
      is_active: true,
    });
    setEditingSeller(null);
  };

  const handleEditSeller = (seller: Seller) => {
    setEditingSeller(seller);
    setSellerForm({
      name: seller.name,
      email: seller.email,
      is_active: seller.is_active,
    });
    setSellerDialogOpen(true);
  };

  const copyAccessLink = async (seller: Seller) => {
    const url = `${window.location.origin}/?sellerEmail=${encodeURIComponent(seller.email)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Access link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleSubmitSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerForm.name.trim()) {
      toast.error("Please enter seller name");
      return;
    }
    if (!sellerForm.email.trim()) {
      toast.error("Please enter seller email");
      return;
    }
    sellerMutation.mutate({
      ...sellerForm,
      id: editingSeller?.id,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Sellers</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog
            open={sellerDialogOpen}
            onOpenChange={(open) => {
              setSellerDialogOpen(open);
              if (!open) resetSellerForm();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="royal">
                <Plus className="w-4 h-4 mr-2" />
                Add Seller
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingSeller ? "Edit Seller" : "Add New Seller"}
                </DialogTitle>
                <DialogDescription>
                  {editingSeller ? "Update seller information" : "Create a new seller"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitSeller} className="space-y-4">
                <div>
                  <Label htmlFor="seller_name">Name *</Label>
                  <Input
                    id="seller_name"
                    value={sellerForm.name}
                    onChange={(e) =>
                      setSellerForm({ ...sellerForm, name: e.target.value })
                    }
                    placeholder="Enter seller name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="seller_email">Email *</Label>
                  <Input
                    id="seller_email"
                    type="email"
                    value={sellerForm.email}
                    onChange={(e) =>
                      setSellerForm({ ...sellerForm, email: e.target.value })
                    }
                    placeholder="Enter seller email"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="is_active"
                    checked={sellerForm.is_active}
                    onCheckedChange={(checked) =>
                      setSellerForm({ ...sellerForm, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active">Active Account</Label>
                </div>
                <Button
                  type="submit"
                  variant="royal"
                  className="w-full"
                  disabled={sellerMutation.isPending}
                >
                  {sellerMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {editingSeller ? "Update Seller" : "Add Seller"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </div>
      ) : sellers && sellers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sellers.map((seller) => (
            <div
              key={seller.id}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50"
            >
              <div className="w-12 h-12 rounded-lg gradient-gold flex items-center justify-center flex-shrink-0">
                <Store className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-lg">{seller.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                    {seller.is_active ? "Active" : "Inactive"}
                  </span>
                  {seller.is_banned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
                      Banned
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>• {seller.email}</span>
                  <span>• Created: {new Date(seller.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditSeller(seller)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyAccessLink(seller)}
                  title="Copy Access Link"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    banSellerMutation.mutate({
                      id: seller.id,
                      is_banned: !seller.is_banned,
                    })
                  }
                >
                  <Ban className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteSellerMutation.mutate(seller.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border border-border/50">
          <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No sellers yet. Add your first seller!</p>
        </div>
      )}
    </div>
  );
};
