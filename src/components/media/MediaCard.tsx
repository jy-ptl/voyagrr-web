import React from "react";
import { motion } from "framer-motion";
import { Play, Heart, MessageCircle, Share2, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MediaItem {
  id: string;
  type: "photo" | "video";
  url: string;
  thumbnail?: string;
  title: string;
  location: string;
  likes: number;
  comments: number;
  tags: string[];
}

interface MediaCardProps {
  item: MediaItem;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-2xl"
    >
      <Card className="border-none bg-secondary/20 transition-all duration-300 group-hover:shadow-[0_20px_50px_rgba(170,59,255,0.2)]">
        <div className="relative aspect-[3/4] overflow-hidden sm:aspect-[4/5] md:aspect-auto">
          <img
            src={item.thumbnail || item.url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {item.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-white/20 p-3 backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                <Play className="h-8 w-8 fill-white text-white" />
              </div>
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Top badges */}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2 opacity-0 transition-all duration-300 group-hover:opacity-100">
            {item.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-white/10 text-white backdrop-blur-md border-white/20">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <h3 className="text-lg font-bold text-white">{item.title}</h3>
            <div className="mt-1 flex items-center gap-1 text-sm text-gray-300">
              <MapPin className="h-3 w-3" />
              {item.location}
            </div>
            
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <div className="flex gap-4">
                <button className="flex items-center gap-1 text-white hover:text-primary transition-colors">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">{item.likes}</span>
                </button>
                <button className="flex items-center gap-1 text-white hover:text-primary transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs">{item.comments}</span>
                </button>
              </div>
              <button className="text-white hover:text-primary transition-colors">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
