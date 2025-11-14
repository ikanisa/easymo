export interface FeaturedProperty {
  id: string;
  name: string;
  location: string;
  priceRange: string;
  rating: number;
  reviews: number;
  status: string;
  etaLabel: string;
  photoUrl: string;
  badges: { label: string; tone?: "default" | "success" | "warning" }[];
  highlights: Array<{ label: string; value: string }>;
}

export const mockFeaturedProperties: FeaturedProperty[] = [
  {
    id: "re-nyarutarama-skyloft",
    name: "Nyarutarama Sky Loft",
    location: "KG 552 St · Kigali",
    priceRange: "$1,250 / mo",
    rating: 4.9,
    reviews: 132,
    status: "Verified",
    etaLabel: "Agent replies in 5 min",
    photoUrl: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
    badges: [
      { label: "Lake view", tone: "success" },
      { label: "2 BR" },
      { label: "125 m²" },
    ],
    highlights: [
      { label: "Shortlist rate", value: "68%" },
      { label: "Leads this week", value: "32" },
      { label: "Avg discount", value: "5%" },
    ],
  },
  {
    id: "re-kacyiru-terrace",
    name: "Kacyiru Garden Terrace",
    location: "KG 7 Ave · Kigali",
    priceRange: "$980 / mo",
    rating: 4.7,
    reviews: 96,
    status: "New",
    etaLabel: "New media in 12h",
    photoUrl: "https://images.unsplash.com/photo-1505692794400-5e0b0c1fdb47?auto=format&fit=crop&w=1200&q=80",
    badges: [
      { label: "3 BR" },
      { label: "Furnished" },
      { label: "Balcony", tone: "warning" },
    ],
    highlights: [
      { label: "Shortlist rate", value: "54%" },
      { label: "Leads this week", value: "21" },
      { label: "Avg discount", value: "3%" },
    ],
  },
];
