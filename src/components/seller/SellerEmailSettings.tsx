import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface SellerNotificationEmail {
  id: string;
  seller_id: string;
  email: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface SellerEmailSettingsProps {
  sellerId: string;
}

export const SellerEmailSettings = ({ sellerId }: SellerEmailSettingsProps) => {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ["seller-notification-emails", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_notification_emails")
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SellerNotificationEmail[];
    },
    enabled: !!sellerId,
  });

  const addEmailMutation = useMutation({
    mutationFn: async ({ email, isPrimary }: { email: string; isPrimary: boolean }) => {
      const { error } = await supabase.rpc("add_seller_notification_email", {
        p_seller_id: sellerId,
        p_email: email,
        p_is_primary: isPrimary,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-notification-emails", sellerId] });
      toast.success("Email added successfully");
      setNewEmail("");
      setIsAdding(false);
    },
    onError: (error) => {
      console.error("Error adding email:", error);
      toast.error("Failed to add email");
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, email, isPrimary }: { id: string; email: string; isPrimary: boolean }) => {
      const { error } = await supabase.rpc("update_seller_notification_email", {
        p_id: id,
        p_email: email,
        p_is_primary: isPrimary,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-notification-emails", sellerId] });
      toast.success("Email updated successfully");
    },
    onError: (error) => {
      console.error("Error updating email:", error);
      toast.error("Failed to update email");
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_seller_notification_email", {
        p_id: id,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-notification-emails", sellerId] });
      toast.success("Email deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting email:", error);
      toast.error("Failed to delete email");
    },
  });

  const handleAddEmail = () => {
    if (!newEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(newEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsAdding(true);
    // If no emails exist, make this the primary email
    const isPrimary = emails.length === 0;
    addEmailMutation.mutate({ email: newEmail.trim(), isPrimary });
  };

  const togglePrimary = (id: string, currentEmail: string) => {
    updateEmailMutation.mutate({ id, email: currentEmail, isPrimary: true });
  };

  const handleDelete = (id: string) => {
    if (emails.length <= 1) {
      toast.error("You must have at least one email address");
      return;
    }
    deleteEmailMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Manage email addresses where you receive order notifications, return requests, and other important updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter email address for notifications"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
            />
            <Button 
              onClick={handleAddEmail} 
              disabled={addEmailMutation.isPending}
            >
              {addEmailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </>
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No notification emails configured yet</p>
              <p className="text-sm mt-1">Add an email to start receiving notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((emailItem) => (
                <div 
                  key={emailItem.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    emailItem.is_primary 
                      ? "border-primary bg-primary/5" 
                      : "border-border"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{emailItem.email}</span>
                      {emailItem.is_primary && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {new Date(emailItem.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!emailItem.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePrimary(emailItem.id, emailItem.email)}
                        disabled={updateEmailMutation.isPending}
                      >
                        Set as Primary
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(emailItem.id)}
                      disabled={deleteEmailMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Configure what types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-normal">New Orders</Label>
                <p className="text-sm text-muted-foreground">Receive notifications when you get new orders</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-normal">Return Requests</Label>
                <p className="text-sm text-muted-foreground">Get notified when customers request returns</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-normal">Order Updates</Label>
                <p className="text-sm text-muted-foreground">Receive status updates for your orders</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-normal">Low Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">Get notified when products are running low</p>
              </div>
              <Switch />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};