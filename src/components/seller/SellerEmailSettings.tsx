import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Edit3 } from "lucide-react";

interface SellerNotificationEmail {
  id: string;
  seller_id: string;
  email: string;
  is_primary: boolean;
  created_at: string;
}

interface SellerEmailSettingsProps {
  sellerId: string;
}

export const SellerEmailSettings = ({ sellerId }: SellerEmailSettingsProps) => {
  const [emails, setEmails] = useState<SellerNotificationEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Fetch seller notification emails
  const { data: fetchedEmails, isLoading, refetch } = useQuery({
    queryKey: ["seller-notification-emails", sellerId],
    queryFn: async () => {
      // For now, we'll keep using direct table access for fetching since we need to select
      // Eventually we'd want a custom function for this too, but for simplicity we'll allow
      // this read operation through RLS by making sure the seller_id matches
      const { data, error } = await supabase
        .from("seller_notification_emails")
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as SellerNotificationEmail[];
    },
    enabled: !!sellerId,
  });

  useEffect(() => {
    if (fetchedEmails) {
      setEmails(fetchedEmails);
    }
  }, [fetchedEmails]);

  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      // Check if email already exists
      const existingEmail = emails.find(e => e.email.toLowerCase() === email.toLowerCase());
      if (existingEmail) {
        throw new Error("This email is already added");
      }

      // Check if we've reached the limit of 5 emails
      if (emails.length >= 5) {
        throw new Error("Maximum of 5 notification emails allowed");
      }

      const { error } = await supabase.rpc('add_seller_notification_email', {
        p_seller_id: sellerId,
        p_email: email,
        p_is_primary: emails.length === 0  // Make first email primary
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-notification-emails", sellerId] });
      setNewEmail("");
      toast.success("Email added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add email");
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, email, is_primary }: { id: string; email: string; is_primary: boolean }) => {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      // Check if email already exists (excluding current record)
      const existingEmail = emails.find(e => 
        e.id !== id && e.email.toLowerCase() === email.toLowerCase()
      );
      if (existingEmail) {
        throw new Error("This email is already added");
      }

      const { error } = await supabase.rpc('update_seller_notification_email', {
        p_id: id,
        p_email: email,
        p_is_primary: is_primary
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-notification-emails", sellerId] });
      setEditingId(null);
      setEditingEmail("");
      toast.success("Email updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update email");
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_seller_notification_email', {
        p_id: id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-notification-emails", sellerId] });
      toast.success("Email removed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove email");
    },
  });

  const togglePrimaryEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get the current email details to use in the update function
      const emailRecord = emails.find(e => e.id === id);
      if (!emailRecord) {
        throw new Error('Email record not found');
      }
      
      // Update the email with the new primary status
      const { error } = await supabase.rpc('update_seller_notification_email', {
        p_id: id,
        p_email: emailRecord.email,
        p_is_primary: true
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-notification-emails", sellerId] });
      toast.success("Primary email updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update primary email");
    },
  });

  const handleAddEmail = () => {
    if (!newEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    addEmailMutation.mutate(newEmail.trim());
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    updateEmailMutation.mutate({ id: editingId, email: editingEmail.trim(), is_primary: emails.find(e => e.id === editingId)?.is_primary || false });
  };

  const handleTogglePrimary = (id: string, is_primary: boolean) => {
    if (is_primary) return; // Already primary
    togglePrimaryEmailMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Seller Notification Emails</CardTitle>
          <CardDescription>
            Add up to 5 email addresses where you want to receive order notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter email address"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
            />
            <Button 
              onClick={handleAddEmail} 
              disabled={addEmailMutation.isPending || !newEmail.trim()}
            >
              {addEmailMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </Button>
          </div>

          {emails && emails.length > 0 ? (
            <div className="space-y-3">
              {emails.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    item.is_primary ? 'bg-primary/5 border-primary' : 'border-border'
                  }`}
                >
                  {editingId === item.id ? (
                    <>
                      <Input
                        value={editingEmail}
                        onChange={(e) => setEditingEmail(e.target.value)}
                        className="flex-1"
                        autoFocus
                      />
                      <Button 
                        size="sm" 
                        onClick={handleSaveEdit}
                        disabled={updateEmailMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setEditingId(null);
                          setEditingEmail("");
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="font-medium">{item.email}</div>
                        {item.is_primary && (
                          <div className="text-xs text-primary font-medium">Primary email</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`primary-${item.id}`}>Primary</Label>
                          <Switch
                            id={`primary-${item.id}`}
                            checked={item.is_primary}
                            onCheckedChange={() => handleTogglePrimary(item.id, item.is_primary)}
                            disabled={togglePrimaryEmailMutation.isPending}
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingEmail(item.email);
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => deleteEmailMutation.mutate(item.id)}
                          disabled={deleteEmailMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No notification emails added yet</p>
              <p className="text-sm mt-1">Add an email to start receiving order notifications</p>
            </div>
          )}

          <div className="text-sm text-muted-foreground mt-4">
            <p><strong>Information:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You can add up to 5 email addresses</li>
              <li>All emails will receive the same notifications</li>
              <li>Primary email is highlighted and can be used as the main contact</li>
              <li>You'll receive notifications for new orders, returns, and cancellations</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};