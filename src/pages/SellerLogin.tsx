import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";

export default function SellerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const doAutoLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const auto = params.get("auto");
      const id = params.get("id");
      const e = (params.get("e") || params.get("email") || "").trim();
      if (auto !== "1" || !id || !e) return;

      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("sellers")
          .select("id, name, email, is_active, is_banned")
          .eq("id", id)
          .ilike("email", e)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error("Invalid auto-login link");
          return;
        }
        if (!(data as any).is_active) {
          toast.error("Seller is inactive");
          return;
        }
        if ((data as any).is_banned) {
          toast.error("Seller is banned");
          return;
        }
        sessionStorage.setItem("seller_logged_in", "true");
        sessionStorage.setItem("seller_email", (data as any).email);
        sessionStorage.setItem("seller_name", (data as any).name);
        sessionStorage.setItem("seller_id", (data as any).id);
        toast.success("Logged in!");
        navigate("/seller", { replace: true });
      } catch (err) {
        console.error("Seller auto-login error:", err);
        toast.error("Failed to auto-login");
      } finally {
        setLoading(false);
      }
    };

    const handleAuthRedirect = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            url.searchParams.delete("code");
            window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
          }
          navigate("/seller", { replace: true });
          return;
        }
        if (window.location.hash && window.location.hash.includes("access_token")) {
          const fn = (supabase.auth as any).getSessionFromUrl;
          if (typeof fn === "function") {
            await fn({ storeSession: true });
            window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
            navigate("/seller", { replace: true });
          }
        }
      } catch (e) {
        console.error("Auth redirect handling error:", e);
      }
    };

    doAutoLogin();
    handleAuthRedirect();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error("Invalid credentials");
        setLoading(false);
        return;
      }

      const { data, error: sellerError } = await supabase
        .from("sellers")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (sellerError) {
        toast.error("Seller verification failed");
        setLoading(false);
        return;
      }

      if (!data) {
        toast.error("Access denied");
        setLoading(false);
        return;
      }

      if (!data.is_active) {
        toast.error("Seller is inactive");
        setLoading(false);
        return;
      }

      if (data.is_banned) {
        toast.error("Seller is banned");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("seller_logged_in", "true");
      sessionStorage.setItem("seller_email", data.email);
      sessionStorage.setItem("seller_name", data.name);
      sessionStorage.setItem("seller_id", data.id);
      toast.success("Login successful!");
      navigate("/seller");
    } catch (err) {
      toast.error("An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Seller Login</CardTitle>
          <CardDescription>Enter your credentials to access your seller dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
