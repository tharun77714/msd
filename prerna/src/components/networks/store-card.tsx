"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Tag, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import supabase from '@/lib/supabaseClient';
import { calculateStoreRating } from '@/lib/utils/ratings';

export interface Store {
  id: string;
  name: string;
  address: string;
  type: string; // e.g., Boutique, Chain, Artisan Collective
  latitude: number;
  longitude: number;
  distance?: number; // Optional distance in km
}

interface StoreCardProps {
  store: Store;
  className?: string;
  onRatingUpdate?: () => void;
}

export function StoreCard({ store, className, onRatingUpdate }: StoreCardProps) {
  const [avgRating, setAvgRating] = useState<number>(5); // Default to 5 stars
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [refreshCount, setRefreshCount] = useState(0); // Add a refresh counter

  const fetchRating = async () => {
    const { avgRating, reviewCount } = await calculateStoreRating(supabase, store.id);
    setAvgRating(avgRating);
    setReviewCount(reviewCount);
  };

  useEffect(() => {
    fetchRating();
  }, [store.id]);

  // Allow parent components to trigger a rating refresh
  useEffect(() => {
    if (onRatingUpdate) {
      setRefreshCount(c => c + 1);
    }
  }, [onRatingUpdate]);

  // Fetch rating when store changes or when explicitly refreshed
  useEffect(() => {
    fetchRating();
  }, [store.id, refreshCount]);

  // Helper: open Google Maps directions for this store
  function openDirections() {
    if (store.latitude && store.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
      window.open(url, '_blank');
    }
  }

  return (
    <Card className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full", className)}>
      <CardHeader>
        <CardTitle className="font-headline text-lg mb-1 leading-tight flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" /> {store.name}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {store.address}
          <div className="flex items-center gap-1 mt-2">
            <span className="text-yellow-500 font-bold">{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</span>
            <span className="text-sm">
              {avgRating.toFixed(1)}/5 {reviewCount > 0 && `(${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`}
            </span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center gap-2">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Tag className="h-3 w-3"/> {store.type}
        </Badge>
        {store.distance !== undefined && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Navigation className="h-3 w-3"/> {store.distance.toFixed(1)} km away
          </Badge>
        )}
        <button
          className="ml-auto text-xs text-primary underline hover:text-accent font-medium"
          type="button"
          onClick={openDirections}
          title="Get Directions to this store"
        >
          Get Directions
        </button>
      </CardContent>
    </Card>
  );
}
