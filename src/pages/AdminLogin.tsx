import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Crown, Lock, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Fixed admin credentials
const ADMIN_USERNAME = "harsh";
const ADMIN_PASSWORD = "harsh.kr1025";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Check if already logged in via session
  useEffect(() => {
    const isAdminLoggedIn = sessionStorage.getItem('admin_logged_in');
    if (isAdminLoggedIn === 'true') {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const sendOtp = async () => {
    setOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-login-otp", {
        body: { action: "request" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("OTP sent to admin email");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    setOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-login-otp", {
        body: { action: "verify", otp: otp.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      sessionStorage.setItem('admin_logged_in', 'true');
      toast.success('Welcome back, Admin!');
      navigate('/admin/dashboard');
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input
    if (!credentials.username.trim()) {
      setErrors({ username: 'Username is required' });
      return;
    }
    if (!credentials.password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    if (step === "otp") {
      if (otp.trim().length < 4) {
        toast.error("Please enter the OTP");
        return;
      }
      await verifyOtp();
      return;
    }

    setIsLoading(true);

    // Simulate a small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check fixed credentials
    if (credentials.username === ADMIN_USERNAME && credentials.password === ADMIN_PASSWORD) {
      setStep("otp");
      setOtp("");
      await sendOtp();
    } else {
      toast.error('Invalid username or password');
    }

    setIsLoading(false);
  };

  return (
    <Layout showHeader={false} showFooter={false}>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card to-background">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-30 overflow-hidden">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl animate-float" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center mx-auto mb-6 royal-shadow-lg">
              <Crown className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-2">Admin Portal</h1>
            <p className="text-muted-foreground">
              Sign in to manage your store
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border/50 p-8 royal-shadow">
            <div className="space-y-5">
              {step === "credentials" ? (
                <>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="username"
                        type="text"
                        value={credentials.username}
                        onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                        placeholder="Enter username"
                        className="pl-11"
                        autoComplete="username"
                        disabled={isLoading || otpLoading}
                      />
                    </div>
                    {errors.username && <p className="text-sm text-destructive mt-1">{errors.username}</p>}
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        value={credentials.password}
                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                        placeholder="Enter password"
                        className="pl-11"
                        autoComplete="current-password"
                        disabled={isLoading || otpLoading}
                      />
                    </div>
                    {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="otp">Email OTP</Label>
                    <Input
                      id="otp"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter OTP"
                      className="mt-1"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={otpLoading}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      OTP is sent to the configured admin email and expires in 1 minute.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="royalOutline"
                      className="w-1/2"
                      onClick={() => {
                        setStep("credentials");
                        setOtp("");
                      }}
                      disabled={otpLoading}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="royalOutline"
                      className="w-1/2"
                      onClick={sendOtp}
                      disabled={otpLoading}
                    >
                      {otpLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend OTP"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            <Button
              type="submit"
              variant="royal"
              size="lg"
              className="w-full mt-8"
              disabled={isLoading || otpLoading}
            >
              {(isLoading || otpLoading) ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {step === "credentials" ? "Signing in..." : "Verifying..."}
                </>
              ) : (
                step === "credentials" ? 'Sign In' : "Verify OTP"
              )}
            </Button>

          </form>

          <p className="text-center mt-6 text-muted-foreground text-sm">
            <a href="/" className="hover:text-primary transition-colors">
              ← Back to Store
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
}
