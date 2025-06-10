
"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Sparkles, Eye, ArrowLeft, ImageOff, Info, TriangleAlert, Quote, MessageSquareText, Save } from 'lucide-react';
import { generateImageVariations, type GenerateImageVariationsInput } from '@/ai/flows/generate-image-variations';
import { describeJewelry, type DescribeJewelryInput } from '@/ai/flows/describe-jewelry';
import { saveDesignAction, type SavedDesign } from '@/lib/actions/supabase-actions'; // Import the new action
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";


export default function ProductDetailsPage() {
  const router = useRouter();
  const { toast } = useToast(); 
  const { user, isLoading: authLoading } = useAuth(); // Get user from AuthContext
  
  const [mainImageUri, setMainImageUri] = useState<string | null>(null);
  const [mainPromptForVariations, setMainPromptForVariations] = useState<string | null>(null);
  const [aiGeneratedDescription, setAiGeneratedDescription] = useState<string | null>(null);
  const [isLoadingAiDescription, setIsLoadingAiDescription] = useState<boolean>(true);
  const [variationImages, setVariationImages] = useState<string[]>([]);
  const [isLoadingVariations, setIsLoadingVariations] = useState<boolean>(true);
  const [isSavingDesign, setIsSavingDesign] = useState<boolean>(false); // New state for saving
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const storedImageUri = sessionStorage.getItem('productDetailsImageUri');
      const storedPrompt = sessionStorage.getItem('productDetailsPrompt');

      if (storedImageUri && storedPrompt) {
        setMainImageUri(storedImageUri);
        setMainPromptForVariations(storedPrompt); 
      } else {
        setError("Product details not found in session. Please go back to the customizer and select an item.");
        setIsLoadingVariations(false);
        setIsLoadingAiDescription(false);
      }
    } catch (e) {
      console.error("Error accessing sessionStorage:", e);
      setError("Could not retrieve product details. Your browser might be blocking session storage or it's full.");
      setIsLoadingVariations(false);
      setIsLoadingAiDescription(false);
    }
  }, []);

  useEffect(() => {
    if (mainImageUri && mainPromptForVariations && isMounted) {
      const fetchVariations = async () => {
        setIsLoadingVariations(true);
        try {
          const input: GenerateImageVariationsInput = {
            baseImageDataUri: mainImageUri,
            originalDescription: mainPromptForVariations,
          };
          const result = await generateImageVariations(input);
          setVariationImages(result.variations);
          if (result.variations.length === 0 && isMounted) {
            toast({
                title: "No Variations Generated",
                description: "The AI could not generate additional views for this item at the moment.",
                variant: "default", 
            });
          }
        } catch (err) {
          let errorMessage = "An unexpected error occurred while generating image variations.";
          if (err instanceof Error) {
            errorMessage = err.message;
          }
          console.error("ProductDetailsPage: fetchVariations error:", err);
          setError(prevError => prevError ? `${prevError};; ${errorMessage}` : errorMessage); 
          toast({
            title: "Image Variation Error",
            description: errorMessage,
            variant: "destructive",
            duration: 7000,
          });
        } finally {
          setIsLoadingVariations(false);
        }
      };
      fetchVariations();
    }

    if (mainImageUri && isMounted) {
       const fetchDescription = async () => {
        setIsLoadingAiDescription(true);
        try {
          const result = await describeJewelry({ imageDataUri: mainImageUri });
          setAiGeneratedDescription(result.description);
        } catch (err) {
          let errorMessage = "An unexpected error occurred while generating the AI description.";
          let toastTitle = "AI Description Error";

          if (err instanceof Error) {
            errorMessage = err.message;
            if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("service unavailable") || errorMessage.toLowerCase().includes("model is overloaded")) {
              toastTitle = "AI Service Overloaded";
              errorMessage = "The AI service is currently busy. Please try again in a few minutes.";
            }
          }
          console.error("ProductDetailsPage: fetchDescription error:", err); // Log the original error
          setError(prevError => prevError ? `${prevError};; ${errorMessage}` : errorMessage); 
          toast({
            title: toastTitle,
            description: errorMessage,
            variant: "destructive",
          });
        } finally {
          setIsLoadingAiDescription(false);
        }
      };
      fetchDescription();
    }
  }, [mainImageUri, mainPromptForVariations, isMounted, toast]);

  const handleSaveDesign = async () => {
    if (!user) {
      toast({ title: "Not Logged In", description: "You must be logged in to save designs.", variant: "destructive" });
      return;
    }
    if (!mainImageUri || !mainPromptForVariations) {
      toast({ title: "Missing Data", description: "Cannot save design, image or prompt is missing.", variant: "destructive" });
      return;
    }

    setIsSavingDesign(true);
    try {
      const { error: saveError } = await saveDesignAction({
        user_id: user.id,
        image_data_uri: mainImageUri,
        design_prompt: mainPromptForVariations,
      });

      if (saveError) {
        throw saveError;
      }
      toast({ title: "Design Saved!", description: "Your jewelry design has been saved to your collection." });
    } catch (err: any) {
      console.error("Error saving design:", err);
      toast({
        title: "Save Failed",
        description: err.message || "Could not save your design. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDesign(false);
    }
  };


  if (!isMounted || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !mainImageUri && !isLoadingAiDescription && !isLoadingVariations) { 
    return (
        <Card className="max-w-2xl mx-auto mt-10">
            <CardHeader>
                <CardTitle className="text-destructive text-2xl flex items-center">
                    <ImageOff className="mr-2 h-8 w-8"/> Error Loading Details
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>Loading Failed</AlertTitle>
                    <AlertDescription>{error.split(';;')[0]}</AlertDescription>
                </Alert>
                <Button onClick={() => router.push('/dashboard/customizer')} variant="outline" className="mt-6 w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Customizer
                </Button>
            </CardContent>
        </Card>
    );
  }


  return (
    <div className="space-y-8 pb-16">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <Button onClick={() => router.push('/dashboard/customizer')} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Customizer
            </Button>
            {user && mainImageUri && mainPromptForVariations && (
                 <Button 
                    onClick={handleSaveDesign} 
                    variant="default" 
                    size="sm" 
                    disabled={isSavingDesign || isLoadingAiDescription || isLoadingVariations}
                    className="btn-primary-sparkle"
                >
                {isSavingDesign ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Save className="mr-2 h-4 w-4" />
                )}
                Save This Design
                </Button>
            )}
        </div>


      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-card border-b pb-4">
          <CardTitle className="text-3xl font-semibold text-foreground flex items-center">
            <Eye className="mr-3 h-8 w-8 text-primary" /> Jewelry Piece Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left Column: Main Image */}
            <div>
              {mainImageUri ? (
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Main Generated View</h2>
                  <div className="relative w-full max-w-md mx-auto aspect-square bg-muted/30 rounded-lg shadow-md overflow-hidden">
                    <Image src={mainImageUri} alt="Main customized jewelry" layout="fill" objectFit="contain" className="p-2" />
                  </div>
                </div>
              ) : (
                !error && <Skeleton className="w-full max-w-md mx-auto h-96 rounded-lg" /> 
              )}
            </div>

            {/* Right Column: AI Description and Variations */}
            <div className="space-y-8">
              {/* AI Generated Description */}
              {isLoadingAiDescription ? (
                <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border border-secondary">
                   <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center">
                    <MessageSquareText className="mr-2 h-5 w-5 text-primary animate-pulse" />
                    AI Generated Description
                  </h3>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : aiGeneratedDescription ? (
                <div className="p-4 bg-secondary/40 rounded-lg border border-secondary">
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center">
                    <MessageSquareText className="mr-2 h-5 w-5 text-primary" />
                    AI Generated Description
                  </h3>
                  <blockquote className="pl-4 border-l-4 border-primary text-sm text-foreground/90 bg-background/50 p-3 rounded-md shadow-sm">
                    {aiGeneratedDescription}
                  </blockquote>
                </div>
              ) : error && !aiGeneratedDescription ? ( 
                 <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>AI Description Failed</AlertTitle>
                    <AlertDescription>Could not generate an AI description for this item. Error: {error.split(';;').find(e => e.toLowerCase().includes("description")) || error.split(';;')[0]}</AlertDescription> 
                 </Alert>
              ) : null}
              
              {/* Additional AI Generated Views */}
              <div className="mt-8">
                <h2 className="text-2xl font-semibold text-foreground mb-6 text-center md:text-left">
                  <Sparkles className="mr-2 h-6 w-6 text-primary inline-block" /> Additional AI Generated Views
                </h2>
                {isLoadingVariations ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="w-full aspect-square rounded-lg" />
                        <Skeleton className="w-3/4 h-4 mx-auto" />
                      </div>
                    ))}
                  </div>
                ) : variationImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {variationImages.map((src, index) => (
                      <Card key={index} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                        <CardContent className="p-0">
                          <div className="relative w-full aspect-square bg-muted/20">
                            <Image src={src} alt={`Variation view ${index + 1}`} layout="fill" objectFit="contain" className="p-2" />
                          </div>
                        </CardContent>
                        <CardHeader className="p-2">
                            <CardDescription className="text-center text-xs">
                              {index === 0 && "Front View"}
                              {index === 1 && "Back View"}
                              {index === 2 && "Top View"}
                              {index === 3 && "45° View"}
                            </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  !error && ( 
                    <Card className="flex flex-col items-center justify-center py-10 border-dashed">
                      <ImageOff className="h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No additional views could be generated.</p>
                      <p className="text-xs text-muted-foreground mt-1">The AI might have had trouble creating variations.</p>
                    </Card>
                  )
                )}
                {error && variationImages.length === 0 && !isLoadingVariations && ( 
                    <Alert variant="destructive" className="mt-4">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>Variation Generation Issue</AlertTitle>
                        <AlertDescription>{error.split(';;').find(e => e.toLowerCase().includes("variation")) || error.split(';;')[0]}</AlertDescription> 
                    </Alert>
                )}
                {!isLoadingVariations && !error && variationImages.length < 4 && variationImages.length > 0 && (
                    <Alert variant="default" className="mt-6 bg-secondary/50">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Note on Variations</AlertTitle>
                        <AlertDescription>The AI generated {variationImages.length} additional view(s). Sometimes fewer than requested are produced if the AI cannot create distinct enough variations for all angles.</AlertDescription>
                    </Alert>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

