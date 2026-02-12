import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Crown,
  Loader2,
  Mail,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CustomerAuth() {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const redirectUrl =
          new URLSearchParams(window.location.search).get("redirect") ||
          "/profile";
        navigate(redirectUrl);
      }
    });
  }, [navigate]);

  const handleChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast.error(error.message || "Google sign-in failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!isLogin && !formData.fullName) {
      toast.error("Please enter your full name");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        if (data.user) {
          localStorage.setItem("customer_user_id", data.user.id);
          toast.success("Welcome back!");

          const redirectUrl =
            new URLSearchParams(window.location.search).get("redirect") ||
            "/profile";
          navigate(redirectUrl);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`,
            data: { full_name: formData.fullName },
          },
        });

        if (error) throw error;

        if (data.user) {
          const { error: profileError } = await supabase
            .from("customer_profiles")
            .insert({
              user_id: data.user.id,
              full_name: formData.fullName,
            });

          if (profileError) {
            console.error("Profile creation error:", profileError);
          }

          localStorage.setItem("customer_user_id", data.user.id);
          toast.success("Account created successfully!");

          const redirectUrl =
            new URLSearchParams(window.location.search).get("redirect") ||
            "/profile";
          navigate(redirectUrl);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);

      if (error.message?.includes("Invalid login credentials")) {
        toast.error("Invalid email or password");
      } else if (error.message?.includes("User already registered")) {
        toast.error("An account with this email already exists");
      } else {
        toast.error(error.message || "Authentication failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Common input style (glassmorphism, white text)
  const glassInputClass =
    "h-11 w-full rounded-lg border border-white/20 bg-white/5 " +
    "pl-11 pr-10 text-sm text-slate-50 placeholder:text-slate-400 " +
    "shadow-inner shadow-black/40 backdrop-blur-md " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 " +
    "focus-visible:border-amber-300/80";

  return (
    <>
      {/* Internal CSS just for this component */}
      <style>{`
        @keyframes formSwitch {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-formSwitch {
          animation: formSwitch 0.28s ease-out;
        }
      `}</style>

      <Layout>
        {/* Static gradient background */}
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {/* Soft static radial highlights */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-amber-500/18 blur-3xl" />
            <div className="absolute -bottom-40 -left-10 h-96 w-96 rounded-full bg-yellow-500/14 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.06),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(251,146,60,0.06),_transparent_55%)]" />
          </div>

          <div className="container relative z-10 mx-auto px-4 py-10">
            <div className="mx-auto max-w-md">
              {/* Brand / Logo */}
              <div className="mb-8 text-center">
                <div className="relative mx-auto mb-6 inline-block">
                  <div className="absolute inset-0 h-20 w-20 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 blur-xl opacity-50 animate-pulse" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-2xl shadow-amber-500/40 ring-2 ring-amber-300/60">
                    <Crown className="h-10 w-10 text-white drop-shadow-lg" />
                    <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-amber-200" />
                  </div>
                </div>

                <h1 className="font-display bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 bg-clip-text text-3xl sm:text-4xl font-bold text-transparent">
                  {isLogin ? "Welcome Back" : "Join the Elite"}
                </h1>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-300/80">
                  {isLogin
                    ? "Sign in to access your exclusive orders and premium profile."
                    : "Create your account to unlock premium features and track orders."}
                </p>
              </div>

              {/* Glass card */}
              <div className="relative">
                {/* Animated border glow wrapper */}
                <div className="absolute -inset-[1px] rounded-2xl bg-[conic-gradient(at_top,_rgba(251,191,36,0.7),_rgba(15,23,42,0.7),_rgba(251,146,60,0.9),_rgba(15,23,42,0.7),_rgba(251,191,36,0.7))] opacity-70 blur-[2px] animate-pulse" />

                <div className="relative rounded-2xl border border-white/15 bg-slate-950/30 shadow-[0_18px_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
                  {/* Soft inner overlay */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-black/10" />

                  <div className="relative z-10 p-6 sm:p-7">
                    {/* Top animated accent line */}
                    <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-amber-300/70 to-transparent animate-pulse" />

                    {/* Toggle buttons */}
                    <div className="mb-6 flex rounded-xl border border-white/12 bg-black/40 p-1.5 backdrop-blur-sm">
                      <button
                        type="button"
                        onClick={() => setIsLogin(true)}
                        className={cn(
                          "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200",
                          isLogin
                            ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/40"
                            : "text-slate-300/80 hover:bg-white/5 hover:text-slate-100"
                        )}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className={cn(
                          "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200",
                          !isLogin
                            ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/40"
                            : "text-slate-300/80 hover:bg-white/5 hover:text-slate-100"
                        )}
                      >
                        Sign Up
                      </button>
                    </div>

                    {/* 🔥 Animated Form Wrapper */}
                    <div
                      key={isLogin ? "login" : "signup"}
                      className="animate-formSwitch"
                    >
                      <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name (signup only) */}
                        {!isLogin && (
                          <div>
                            <Label
                              htmlFor="fullName"
                              className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-300/80"
                            >
                              Full Name
                            </Label>
                            <div className="relative flex items-center">
                              <div className="absolute left-0 top-0 flex h-11 w-10 items-center justify-center rounded-l-lg border-r border-white/10 bg-white/10">
                                <User className="h-4 w-4 text-amber-200/90" />
                              </div>
                              <Input
                                id="fullName"
                                value={formData.fullName}
                                onChange={handleChange("fullName")}
                                placeholder="Enter your full name"
                                className={cn(glassInputClass, "pl-11 pr-3")}
                              />
                            </div>
                          </div>
                        )}

                        {/* Email */}
                        <div>
                          <Label
                            htmlFor="email"
                            className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-300/80"
                          >
                            Email Address
                          </Label>
                          <div className="relative flex items-center">
                            <div className="absolute left-0 top-0 flex h-11 w-10 items-center justify-center rounded-l-lg border-r border-white/10 bg-white/10">
                              <Mail className="h-4 w-4 text-amber-200/90" />
                            </div>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={handleChange("email")}
                              placeholder="Enter your email"
                              className={cn(glassInputClass, "pl-11")}
                            />
                          </div>
                        </div>

                        {/* Password */}
                        <div>
                          <Label
                            htmlFor="password"
                            className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-300/80"
                          >
                            Password
                          </Label>
                          <div className="relative flex items-center">
                            <div className="absolute left-0 top-0 flex h-11 w-10 items-center justify-center rounded-l-lg border-r border-white/10 bg-white/10">
                              <Lock className="h-4 w-4 text-amber-200/90" />
                            </div>
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              value={formData.password}
                              onChange={handleChange("password")}
                              placeholder="Enter your password"
                              minLength={6}
                              className={cn(glassInputClass, "pl-11 pr-9")}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowPassword((prev) => !prev)
                              }
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300/80 hover:text-amber-200 transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          {isLogin ? (
                            <div className="mt-2 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate("/forgot-password")
                                }
                                className="text-xs text-amber-300/90 underline-offset-2 hover:text-amber-200 hover:underline transition-colors"
                              >
                                Forgot password?
                              </button>
                            </div>
                          ) : (
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400/85">
                              <Lock className="h-3 w-3" />
                              Minimum 6 characters required
                            </p>
                          )}
                        </div>

                        {/* Submit */}
                        <div className="pt-1">
                          <Button
                            type="submit"
                            size="lg"
                            disabled={isLoading}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border-0 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-sm font-semibold text-white shadow-lg shadow-amber-600/50 transition-all duration-200 hover:brightness-110 disabled:opacity-70"
                          >
                            <span className="flex items-center gap-2">
                              {isLoading ? (
                                <>
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  {isLogin
                                    ? "Signing in..."
                                    : "Creating account..."}
                                </>
                              ) : (
                                <>
                                  {isLogin ? "Sign In" : "Create Account"}
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
                            </span>
                          </Button>
                        </div>
                      </form>
                    </div>

                    {/* Divider */}
                    <div className="my-5">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/12" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-slate-950/80 px-3 text-[11px] uppercase tracking-[0.18em] text-slate-400/80">
                            Or continue with
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Google button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={handleGoogleSignIn}
                      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-white/18 bg-black/55 text-sm font-medium text-slate-100 shadow-inner shadow-black/40 backdrop-blur-md transition-all duration-200 hover:bg-black/45 hover:text-white"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.79 15.71 17.57V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.71 17.57C14.73 18.23 13.48 18.64 12 18.64C9.14 18.64 6.71 16.69 5.84 14.09H2.18V16.96C4 20.53 7.7 23 12 23Z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09C5.62 13.43 5.49 12.73 5.49 12C5.49 11.27 5.62 10.57 5.84 9.91V7.04H2.18C1.43 8.55 1 10.22 1 12C1 13.78 1.43 15.45 2.18 16.96L5.84 14.09Z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.36C13.62 5.36 15.06 5.93 16.21 7.04L19.36 4.07C17.45 2.24 14.97 1 12 1C7.7 1 4 3.47 2.18 7.04L5.84 9.91C6.71 7.31 9.14 5.36 12 5.36Z"
                          fill="#EA4335"
                        />
                      </svg>
                      <span>Sign in with Google</span>
                    </Button>

                    {/* Footer */}
                    <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400/80">
                      By continuing, you agree to our{" "}
                      <button className="text-amber-300/90 underline underline-offset-2 hover:text-amber-200 transition-colors">
                        Terms of Service
                      </button>{" "}
                      and{" "}
                      <button className="text-amber-300/90 underline underline-offset-2 hover:text-amber-200 transition-colors">
                        Privacy Policy
                      </button>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
