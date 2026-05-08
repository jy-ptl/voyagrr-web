import { Home, Map, Image as ImageIcon, Users, Heart, Clock, PlusCircle, X, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { icon: HardDrive, label: "My Drive", href: "/my-drive" },
  { icon: Map, label: "My Trips", href: "/trips" },
  { icon: Home, label: "Feed", href: "/feed", isDisabled: true },
  { icon: ImageIcon, label: "Gallery", href: "/gallery", isDisabled: true },
  { icon: Users, label: "Groups", href: "/groups" },
  { icon: Heart, label: "Favorites", href: "/favorites", isDisabled: true },
  { icon: Clock, label: "Recent", href: "/recent", isDisabled: true },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen w-72 border-r border-white/5 bg-[#0a0810]/80 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6">
          <Link to="/" onClick={onClose}>
            <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              VOYAGRR
            </h1>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex h-[calc(100%-4rem)] flex-col justify-between p-4">
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const content = (
                <Button
                  variant="ghost"
                  disabled={item.isDisabled}
                  className={cn(
                    "w-full justify-start gap-3 text-sm font-medium transition-all duration-300 relative group h-11 px-4 rounded-xl",
                    isActive 
                      ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5",
                    item.isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-zinc-400"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 h-6 w-1 rounded-r-full bg-primary shadow-[0_0_15px_rgba(170,59,255,0.8)]" />
                  )}
                  <item.icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "group-hover:text-primary"
                  )} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.isDisabled && (
                    <span className="text-[8px] font-black uppercase tracking-tighter bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5 text-zinc-600">
                      Soon
                    </span>
                  )}
                </Button>
              );

              if (item.isDisabled) {
                return <div key={item.label}>{content}</div>;
              }

              return (
                <Link key={item.label} to={item.href} onClick={onClose}>
                  {content}
                </Link>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Storage</p>
                <p className="text-[10px] text-zinc-500">65% used</p>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-800">
                <div 
                  className="h-1.5 rounded-full bg-gradient-to-r from-primary to-purple-500 shadow-[0_0_10px_rgba(170,59,255,0.4)]" 
                  style={{ width: '65%' }}
                />
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">6.5 GB of 10 GB used</p>
            </div>
            
            <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] h-11">
              <PlusCircle className="h-4 w-4" />
              Upload Media
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};
