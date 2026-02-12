import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "email" | "otp" | "reset";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (step === "email") return email.trim().length > 3;
    if (step === "otp") return otp.trim().length >= 4;
    return newPassword.length >= 6 && newPassword === confirmPassword;
  }, [step, email, otp, newPassword, confirmPassword]);

  const requestOtp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("super-responder", {
        body: { action: "request", email: email.trim().toLowerCase() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("OTP sent to your email");
      setStep("otp");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("super-responder", {
        body: { action: "verify", email, otp },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResetToken(data?.reset_token ?? null);
      toast.success("OTP verified");
      setStep("reset");
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!resetToken) {
      toast.error("Reset session expired. Please try again.");
      setStep("email");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("super-responder", {
        body: { action: "reset", email, reset_token: resetToken, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Password updated. Please login.");
      navigate("/auth");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === "email") return requestOtp();
    if (step === "otp") return verifyOtp();
    return resetPassword();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold mb-2">Forgot Password</h1>
            <p className="text-muted-foreground">
              {step === "email"
                ? "Enter your email to receive an OTP"
                : step === "otp"
                ? "Enter the OTP sent to your email"
                : "Set a new password"}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-6 animate-fade-in">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={step !== "email" || loading}
                  className="mt-1"
                  required
                />
              </div>

              {step !== "email" && (
                <div>
                  <Label htmlFor="otp">OTP</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                    disabled={step !== "otp" || loading}
                    className="mt-1"
                    inputMode="numeric"
                    required
                  />
                </div>
              )}

              {step === "reset" && (
                <>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      disabled={loading}
                      className="mt-1"
                      minLength={6}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      disabled={loading}
                      className="mt-1"
                      minLength={6}
                      required
                    />
                  </div>
                </>
              )}

              <Button type="submit" variant="royal" size="lg" className="w-full" disabled={loading || !canSubmit}>
                {step === "email" ? "Send OTP" : step === "otp" ? "Verify OTP" : "Update Password"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <button
                type="button"
                className="hover:text-primary transition-colors"
                onClick={() => navigate("/auth")}
                disabled={loading}
              >
                Back to Login
              </button>

              {step !== "email" && (
                <div className="mt-3">
                  <button
                    type="button"
                    className="hover:text-primary transition-colors"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setResetToken(null);
                    }}
                    disabled={loading}
                  >
                    Try a different email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
