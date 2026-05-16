import { Search, Bell, User, LogOut, Settings, Menu, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "@/auth/keycloak";
import type { RootState } from "@/store";
import React from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = React.useState(() =>
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  );

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <nav className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/5 bg-[#0a0810]/70 px-4 backdrop-blur-xl lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5 text-muted-foreground" />
        </Button>

        <div className="relative hidden w-full max-w-lg sm:block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search..."
            className="h-11 w-full rounded-xl border-white/10 bg-white/[0.04] pl-11 text-sm text-white placeholder:text-zinc-500 transition-all focus-visible:border-primary/50 focus-visible:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {!isStandalone && installPrompt && (
          <Button
            variant="outline"
            className="hidden items-center gap-2 border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 sm:inline-flex"
            onClick={() => void handleInstallClick()}
          >
            <Download className="h-4 w-4" />
            Install
          </Button>
        )}

        <Button variant="ghost" size="icon" className="relative text-zinc-400 hover:text-white">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(170,59,255,0.6)]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-primary/50">
              <Avatar className="h-9 w-9 border border-white/10">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} />
                <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#12101a] border-white/10 text-white" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs leading-none text-zinc-500">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="hover:bg-white/5 focus:bg-white/5 cursor-pointer" onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-white/5 focus:bg-white/5 cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem 
              className="text-red-400 hover:bg-red-400/10 focus:bg-red-400/10 cursor-pointer" 
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};
