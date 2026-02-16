"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSession } from "next-auth/react";
import { addShopReview } from "@/lib/actions/shop-product-actions";
// @ts-ignore
import { Star, User } from "lucide-react";
import { useActionState } from "react";
import { formatDate } from "@/lib/utils";

interface Review {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    user: {
        name: string;
        email: string;
    };
}

interface ReviewSectionProps {
    productId: string;
    reviews: Review[];
}

export function ReviewSection({ productId, reviews }: ReviewSectionProps) {
    const { data: session } = useSession();
    const [showForm, setShowForm] = useState(false);
    const [rating, setRating] = useState(5);
    const [state, formAction, isPending] = useActionState(addShopReview, undefined);

    // Calculate rating distribution
    const ratingCounts = [0, 0, 0, 0, 0];
    reviews.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) {
            ratingCounts[r.rating - 1]++;
        }
    });

    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>

            {/* Rating Summary */}
            <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-200">
                <div className="text-center">
                    <div className="text-5xl font-black text-slate-900 mb-2">{avgRating.toFixed(1)}</div>
                    <div className="flex items-center justify-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                            <Star
                                key={i}
                                className={`h-5 w-5 ${i < Math.floor(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                            />
                        ))}
                    </div>
                    <p className="text-sm text-slate-500">{reviews.length} reviews</p>
                </div>

                <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                        const count = ratingCounts[stars - 1];
                        const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                        return (
                            <div key={stars} className="flex items-center gap-3">
                                <span className="text-sm font-medium text-slate-600 w-12">{stars} star</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-400"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <span className="text-sm text-slate-500 w-8 text-right">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Write Review Button */}
            {session?.user && !showForm && (
                <Button onClick={() => setShowForm(true)} className="mb-6">
                    Write a Review
                </Button>
            )}

            {!session?.user && (
                <p className="text-sm text-slate-500 mb-6">Please sign in to write a review.</p>
            )}

            {/* Review Form */}
            {showForm && session?.user && (
                <form action={formAction} className="mb-8 p-6 bg-slate-50 rounded-xl space-y-4">
                    <input type="hidden" name="productId" value={productId} />

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Your Rating</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className="focus:outline-none"
                                >
                                    <Star
                                        className={`h-8 w-8 transition-colors ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        <input type="hidden" name="rating" value={rating} />
                    </div>

                    <div>
                        <label htmlFor="comment" className="block text-sm font-bold text-slate-700 mb-2">
                            Your Review (Optional)
                        </label>
                        <textarea
                            id="comment"
                            name="comment"
                            rows={4}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Share your experience with this product..."
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Submitting..." : "Submit Review"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                            Cancel
                        </Button>
                    </div>

                    {state === "success" && (
                        <p className="text-sm text-green-600 font-medium">Review submitted successfully!</p>
                    )}
                    {state && state !== "success" && (
                        <p className="text-sm text-red-600 font-medium">{state}</p>
                    )}
                </form>
            )}

            {/* Reviews List */}
            <div className="space-y-6">
                {reviews.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No reviews yet. Be the first to review!</p>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="border-b border-slate-100 pb-6 last:border-0">
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <User className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="font-bold text-slate-900">{review.user.name}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-4 w-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-sm text-slate-500">
                                            {formatDate(review.createdAt)}
                                        </span>
                                    </div>
                                    {review.comment && (
                                        <p className="text-slate-600 leading-relaxed">{review.comment}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
