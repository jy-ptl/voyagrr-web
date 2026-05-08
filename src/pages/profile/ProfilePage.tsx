import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  Mail, 
  Shield, 
  HardDrive, 
  Settings, 
  LogOut, 
  ChevronRight,
  Camera,
  MapPin,
  Calendar
} from "lucide-react";
import { useDispatch } from "react-redux";
import { clearAuth } from "@/store/slices/authSlice";
import { useNavigate } from "react-router-dom";

export const ProfilePage = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(clearAuth());
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.username || "Voyagrr User";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Hero Section */}
      <div className="relative h-48 rounded-[2rem] bg-gradient-to-br from-primary/20 via-blue-600/10 to-transparent border border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 grayscale" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#050505] to-transparent" />
      </div>

      {/* Profile Header */}
      <div className="relative px-8 -mt-20">
        <div className="flex flex-col md:flex-row items-end gap-6">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-[#050505] rounded-[2.5rem] shadow-2xl">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-to-tr from-primary to-blue-600 text-3xl font-black text-white">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <Button size="icon" className="absolute bottom-0 right-0 rounded-xl bg-white text-black hover:bg-zinc-200 shadow-xl active:scale-90 transition-all">
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 space-y-2 pb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-white">{fullName}</h1>
              <div className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] font-black text-primary uppercase tracking-widest">
                Premium
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-zinc-500 font-medium">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span>@{user?.username}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>Global Explorer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>Joined May 2024</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pb-2">
            <Button variant="outline" className="rounded-xl border-white/10 hover:bg-white/5 h-11 px-6 font-bold">
              Edit Profile
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl border-white/10 hover:bg-white/5 h-11 w-11">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-0">
        {/* Storage Stats */}
        <Card className="bg-[#0a0a0a]/50 border-white/5 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Storage Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-white">12.4 GB used</span>
                <span className="text-zinc-500">50 GB total</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[25%] rounded-full shadow-[0_0_10px_rgba(147,51,234,0.5)]" />
              </div>
            </div>
            <Button variant="link" className="text-primary p-0 h-auto text-xs font-black uppercase tracking-widest hover:no-underline">
              Upgrade Plan <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Security Summary */}
        <Card className="bg-[#0a0a0a]/50 border-white/5 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Account Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Two-Factor Auth</p>
                <p className="text-[10px] text-zinc-500">Enhanced protection active</p>
              </div>
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            </div>
            <Button variant="link" className="text-zinc-500 p-0 h-auto text-xs font-black uppercase tracking-widest hover:no-underline">
              Manage Security <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="bg-[#0a0a0a]/50 border-white/5 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Mail className="h-4 w-4" /> Primary Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-white truncate">{user?.email}</p>
              <p className="text-[10px] text-zinc-500">Verified on May 12, 2024</p>
            </div>
            <Button variant="link" className="text-zinc-500 p-0 h-auto text-xs font-black uppercase tracking-widest hover:no-underline">
              Update Email <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Action List */}
      <div className="bg-[#0a0a0a]/30 border border-white/5 rounded-[2rem] divide-y divide-white/5">
        {[
          { icon: Settings, label: "Notification Settings", description: "Manage how you receive alerts" },
          { icon: Shield, label: "Privacy Policy", description: "How we protect your data" },
        ].map((item, i) => (
          <div key={i} className="p-6 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer transition-colors group first:rounded-t-[2rem] last:rounded-b-[2rem]">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <item.icon className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.description}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white transition-all transform group-hover:translate-x-1" />
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="pt-4 px-4 flex justify-between items-center text-zinc-600">
        <p className="text-[10px] font-bold uppercase tracking-widest">
          Account ID: {user?.username?.toUpperCase() || "VOYAGRR_USER"}
        </p>
        <Button 
          variant="ghost" 
          className="text-destructive hover:text-destructive hover:bg-destructive/10 font-black uppercase tracking-widest text-[10px] rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="h-3 w-3 mr-2" />
          Sign Out of Voyagrr
        </Button>
      </div>
    </div>
  );
};
