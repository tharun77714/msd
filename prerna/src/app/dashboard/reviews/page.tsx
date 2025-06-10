"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import supabase from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';

interface Review {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
  status: 'pending' | 'approved'; // Keep status field in interface for data structure
  store_id: string;
  user_id: string;
  updated_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  };
  store: {
    name: string;
  };
}

export default function BusinessReviewsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchReviews();
  }, [user]);

  const fetchReviews = async () => {
    console.log('Fetching reviews for user:', user?.id);
    const { data: userStores, error: userStoresError } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', user?.id);

    if (userStoresError) {
      console.error('Error fetching user stores:', userStoresError);
      setReviews([]);
      setLoading(false);
      return;
    }

    console.log('User stores fetched:', userStores);

    if (!userStores || userStores.length === 0) {
      console.log('No stores found for user, returning empty reviews array.');
      setReviews([]);
      setLoading(false);
      return;
    }

    const storeIds = userStores.map(store => store.id);
    console.log('Store IDs for fetching reviews:', storeIds);

    const { data: reviewsData, error: reviewsError } = await supabase
      .from('store_reviews')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .in('store_id', storeIds)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      console.error('Supabase error details:', reviewsError);
      setReviews([]); // Ensure reviews state is empty on error
      setLoading(false);
      return;
    }

    console.log('Reviews data fetched:', reviewsData);
    setReviews(reviewsData || []);
    setLoading(false);
  };

  if (loading) return <div>Loading reviews...</div>;

  const stats = {
    total: reviews.length,
    averageRating: reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length || 0
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Business Reviews</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"> {/* Adjusted grid for fewer stats */}
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Reviews</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Average Rating</div>
          <div className="text-2xl font-bold">
            {stats.averageRating.toFixed(1)} ★
          </div>
        </Card>
        {/* Removed Approved and Pending stats */}
      </div>

      {/* Removed Tabs component */}
      {/* <Tabs defaultValue="all" className="w-full"> */}
        {/* Removed TabsList and TabsTrigger */}
        {/* <TabsList>...</TabsList> */}

        {/* Display all reviews directly */}
        {/* <TabsContent value={activeTab} className="mt-6"> */}
          <div className="space-y-4 mt-6"> {/* Added margin-top to compensate for removed tabs */}
            {reviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No reviews found.
              </p>
            ) : (
              reviews.map((review) => (
                <Card key={review.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold mb-1">
                        {review.store.name}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-yellow-500">
                          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                        </span>
                        <span className="text-sm text-muted-foreground ml-2"> {/* Added margin-left */}
                          {new Date(review.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm mb-2">{review.review_text}</p>
                      <p className="text-xs text-muted-foreground">
                        By: {review.profiles.full_name || 'Anonymous'} 
                        {review.profiles.email ? ` (${review.profiles.email})` : ''}
                      </p>
                    </div>
                    {/* Removed status display and action buttons */}
                    {/* <div className="flex flex-col items-end gap-2">...</div> */}
                  </div>
                </Card>
              ))
            )}
          </div>
        {/* </TabsContent> */}
      {/* </Tabs> */}
    </div>
  );
}
