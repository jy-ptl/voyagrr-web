import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import { setAuth } from "@/store/slices/authSlice";
import { loginWithKeycloak } from "@/auth/keycloak";
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
import { LogIn, Code, User, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const decodeJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(window.atob(base64));
    } catch {
      return null;
    }
  };

  const onSubmit = async (values: LoginValues) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.login(values);
      
      // Extract user info from id_token or access_token
      const idTokenData = decodeJwt(data.id_token || data.access_token);
      
      dispatch(setAuth({
        token: data.access_token,
        refreshToken: data.refresh_token,
        user: idTokenData ? {
          id: idTokenData.sub,
          username: idTokenData.preferred_username || idTokenData.sub,
          email: idTokenData.email || "",
          firstName: idTokenData.given_name || "",
          lastName: idTokenData.family_name || "",
        } : null
      }));
      navigate("/my-drive");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Invalid credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeycloakLogin = async () => {
    try {
      await loginWithKeycloak();
    } catch {
      setError("External authentication failed");
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#050505] relative overflow-hidden px-4">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />

      <Card className="w-full max-w-md bg-[#0a0a0a]/80 border-white/5 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2rem] overflow-hidden">
        <CardHeader className="space-y-2 text-center pt-10">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-primary to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 mb-4 transform rotate-3">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tight text-white">Welcome Back</CardTitle>
          <CardDescription className="text-zinc-500 text-sm">Enter your credentials to access Voyagrr</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="space-y-1">
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
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-primary/50 transition-all" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold text-center animate-shake">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-12 bg-white text-black hover:bg-zinc-200 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl mt-2" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0a0a0a] px-4 text-zinc-600 font-bold tracking-widest">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 h-12 rounded-xl text-white font-bold" onClick={handleKeycloakLogin}>
              <LogIn className="mr-2 h-4 w-4 text-primary" /> Keycloak
            </Button>
            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 h-12 rounded-xl text-white font-bold">
              <Code className="mr-2 h-4 w-4" /> Github
            </Button>
          </div>
        </CardContent>
        <CardFooter className="pb-10 pt-4 flex justify-center border-t border-white/5">
          <p className="text-sm text-zinc-500">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-black hover:underline underline-offset-4">Create one</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
