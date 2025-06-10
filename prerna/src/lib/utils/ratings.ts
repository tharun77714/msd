export async function calculateStoreRating(supabase: any, storeId: string) {
  try {    const { data, error } = await supabase
      .from('store_reviews')
      .select('rating')
      .eq('store_id', storeId)
      .eq('status', 'approved');
    
    if (error) throw error;

    if (!data || data.length === 0) {
      return { avgRating: 5, reviewCount: 0 }; // Default to 5 stars when no reviews
    }

    const validRatings = data.map(r => r.rating).filter(r => r >= 1 && r <= 5);
    if (validRatings.length === 0) {
      return { avgRating: 5, reviewCount: 0 };
    }

    const avgRating = validRatings.reduce((a, b) => a + b, 0) / validRatings.length;
    return {
      avgRating,
      reviewCount: validRatings.length
    };
  } catch (err) {
    console.error('Error calculating store rating:', err);
    return { avgRating: 5, reviewCount: 0 }; // Default on error
  }
}
