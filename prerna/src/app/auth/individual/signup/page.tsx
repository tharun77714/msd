"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Lock, MapPin, Phone, ArrowRight, Loader2, EyeIcon, EyeOffIcon } from 'lucide-react';
import { AddressAutocompleteInput } from '@/components/common/address-autocomplete-input'; // Assuming this component exists and is correctly implemented
import { signUpIndividual } from '@/lib/actions/supabase-actions';

const individualSignUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
  defaultShippingAddressText: z.string().min(10, "Default shipping address is required."),
  defaultShippingAddressLat: z.number().optional(),
  defaultShippingAddressLng: z.number().optional(),
  individualPhoneNumber: z.string().min(10, "Phone number must be at least 10 digits.").regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format."),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type IndividualSignUpFormValues = z.infer<typeof individualSignUpSchema>;

export default function IndividualSignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<IndividualSignUpFormValues>({
    resolver: zodResolver(individualSignUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      defaultShippingAddressText: "",
      individualPhoneNumber: "",
    },
  });

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  });

  const handlePlaceSelected = (placeDetails: { address: string; latitude: number; longitude: number } | null) => {
    if (placeDetails) {
      form.setValue('defaultShippingAddressText', placeDetails.address, { shouldValidate: true });
      form.setValue('defaultShippingAddressLat', placeDetails.latitude, { shouldValidate: true });
      form.setValue('defaultShippingAddressLng', placeDetails.longitude, { shouldValidate: true });
    }
  };

  async function onSubmit(data: IndividualSignUpFormValues) {
    setIsLoading(true);
    try {
      const result = await signUpIndividual(data);
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (result.data?.user) {
        toast({
          title: "Sign Up Successful!",
          description: "Please check your email to confirm your registration. Then, you can sign in.",
        });
        router.push('/auth/individual/signin');
      }
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
        <User className="mx-auto h-12 w-12 text-accent mb-2" />
        <CardTitle className="font-headline text-3xl">Create Your Account</CardTitle>
        <CardDescription>Join Sparkle Studio to discover unique jewelry.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4" />Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Alex Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4" />Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
 <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4" />Password</FormLabel>
 <div className="relative">
 <FormControl>
 <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
 </FormControl>
 <button type="button" onClick={togglePasswordVisibility} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
 {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
 </button>
 </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4" />Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormItem>
              <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4" />Please enter the location</FormLabel>
              <AddressAutocompleteInput
                apiKey={googleMapsApiKey}
                onPlaceSelected={handlePlaceSelected}
                initialValue={form.getValues().defaultShippingAddressText}
              />
               <FormField control={form.control} name="defaultShippingAddressText" render={({ field }) => <Input type="hidden" {...field} />} />
              <FormMessage>{form.formState.errors.defaultShippingAddressText?.message}</FormMessage>
            </FormItem>
            <FormField
              control={form.control}
              name="individualPhoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4" />Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1234567890 (with country code)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full btn-accent-sparkle text-lg py-3" disabled={isLoading} style={{ '--accent-foreground': 'hsl(var(--accent-foreground))', backgroundColor: 'hsl(var(--accent))' } as React.CSSProperties}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
              Create Account
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Button variant="link" asChild className="p-0 text-accent" style={{ color: 'hsl(var(--accent))' }}>
            <Link href="/auth/individual/signin">Sign In</Link>
          </Button>
        </p>
      </CardContent>
    </Card>
  );
}
