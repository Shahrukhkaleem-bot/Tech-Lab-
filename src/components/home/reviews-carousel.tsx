import { Carousel } from "@/components/common/carousel"
import { SectionHeader } from "@/components/common/section-header"
import { ReviewCard } from "@/components/reviews/review-card"
import type { Review } from "@/features/catalog/types"

export function ReviewsCarousel({ reviews, title = "What Our Customers Say" }: { reviews: Review[]; title?: string }) {
  if (!reviews.length) return null
  return (
    <section aria-labelledby="home-reviews" id="reviews">
      <SectionHeader id="home-reviews" title={title} subtitle="Real reviews from verified buyers" />
      <Carousel label="Customer reviews" itemClassName="basis-[85%] sm:basis-[45%] lg:basis-[31.5%] xl:basis-[24%]">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </Carousel>
    </section>
  )
}
