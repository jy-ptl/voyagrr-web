import { MediaCard } from "../media/MediaCard";

interface FeedItem {
  id: string;
  type: "photo" | "video";
  url: string;
  title: string;
  location: string;
  likes: number;
  comments: number;
  tags: string[];
  thumbnail?: string;
}

const MOCK_DATA: FeedItem[] = [
  {
    id: "1",
    type: "photo",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    title: "Misty Mountains",
    location: "Yosemite, USA",
    likes: 1240,
    comments: 42,
    tags: ["Nature", "Mountains"],
  },
  {
    id: "2",
    type: "video",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    thumbnail: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
    title: "Alpine Lakes",
    location: "Swiss Alps",
    likes: 3500,
    comments: 128,
    tags: ["Travel", "Video"],
  },
  {
    id: "3",
    type: "photo",
    url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
    title: "Crystal Waters",
    location: "Maldives",
    likes: 2100,
    comments: 85,
    tags: ["Summer", "Ocean"],
  },
  {
    id: "4",
    type: "photo",
    url: "https://images.unsplash.com/photo-1533105079780-92b9be482077",
    title: "Night in Tokyo",
    location: "Tokyo, Japan",
    likes: 4200,
    comments: 156,
    tags: ["City", "Night"],
  },
  {
    id: "5",
    type: "photo",
    url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
    title: "Hidden Forest",
    location: "Oregon, USA",
    likes: 980,
    comments: 31,
    tags: ["Adventure", "Forest"],
  },
  {
    id: "6",
    type: "video",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    thumbnail: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
    title: "Into the Wild",
    location: "Alaska, USA",
    likes: 1800,
    comments: 74,
    tags: ["Wildlife", "Action"],
  },
  {
    id: "7",
    type: "photo",
    url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34",
    title: "Paris Mornings",
    location: "Paris, France",
    likes: 2900,
    comments: 110,
    tags: ["Classic", "Europe"],
  },
  {
    id: "8",
    type: "photo",
    url: "https://images.unsplash.com/photo-1493246507139-91e8bef99cce",
    title: "Sunset Cliffs",
    location: "Iceland",
    likes: 5600,
    comments: 210,
    tags: ["Landscape", "Epic"],
  },
];

export const HomeFeed = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Explore the World</h2>
          <p className="text-muted-foreground">Discover stories from travelers around the globe.</p>
        </div>
        <div className="flex gap-2">
          {["Trending", "Latest", "Following"].map((filter) => (
            <button
              key={filter}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-white/10"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3 xl:columns-4">
        {MOCK_DATA.map((item) => (
          <div key={item.id} className="break-inside-avoid">
            <MediaCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
};
