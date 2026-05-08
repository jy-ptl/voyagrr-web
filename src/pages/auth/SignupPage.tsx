import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Mail, User, ShieldCheck, ArrowRight } from "lucide-react";

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

type SignupValues = z.infer<typeof signupSchema>;

export const SignupPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const onSubmit = async (values: SignupValues) => {
    setLoading(true);
    setError(null);
    try {
      await authService.signup(values);
      navigate("/login");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#050505] relative overflow-hidden px-4 py-4">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />

      <Card className="w-full max-w-xl bg-[#0a0a0a]/80 border-white/5 backdrop-blur-2xl shadow-2xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="space-y-2 text-center pt-12">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-4xl font-black tracking-tight text-white">Join Voyagrr</CardTitle>
          <CardDescription className="text-zinc-500 text-sm">Create your account to start your journey</CardDescription>
        </CardHeader>
        <CardContent className="px-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-primary/50 transition-all" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-primary/50 transition-all" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Username</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                          <Input placeholder="johndoe" {...field} className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50 transition-all" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Email</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                          <Input placeholder="john@voyagrr.com" {...field} className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50 transition-all" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Secure Password</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
                        <Input type="password" placeholder="••••••••••••" {...field} className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50 transition-all" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold text-center">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-14 bg-white text-black hover:bg-zinc-200 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/5" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="pb-12 pt-6 flex justify-center border-t border-white/5 bg-white/[0.02]">
          <p className="text-sm text-zinc-500">
            Already a member?{" "}
            <Link to="/login" className="text-primary font-black hover:underline underline-offset-4">Sign in here</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
