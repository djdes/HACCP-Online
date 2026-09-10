import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAggregateRating } from "@/lib/seo/aggregate-rating";

describe("buildAggregateRating", () => {
  const base = { place: "Кафе", quote: "Отлично" };
  it("меньше трёх оценок — null; без оценки не считается", () => {
    assert.equal(buildAggregateRating([{ ...base, author: "А", rating: 5 }, { ...base, author: "Б", rating: null }]), null);
  });
  it("среднее с одним знаком, до пяти отзывов", () => {
    const rows = [5, 4, 5, 3, 5, 4].map((rating, i) => ({ ...base, author: `П${i}`, rating }));
    const out = buildAggregateRating(rows);
    assert.ok(out);
    assert.equal(out.aggregateRating.ratingValue, "4.3");
    assert.equal(out.aggregateRating.reviewCount, 6);
    assert.equal(out.review.length, 5);
    assert.equal(out.review[0].reviewRating.ratingValue, 5);
  });
});
