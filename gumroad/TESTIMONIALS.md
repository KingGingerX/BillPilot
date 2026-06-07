# Testimonials

Add verified buyer quotes in `data/testimonials.json`.

Copy one object per person into the `testimonials` array:

```json
{
  "name": "",
  "role": "",
  "product": "",
  "rating": 5,
  "quote": "",
  "date": ""
}
```

Rules:

- `name` is required.
- `quote` is required.
- `rating` is required and must be `1` through `5`.
- `role`, `product`, and `date` are optional but useful.
- Keep quotes verified. Do not add invented buyer proof.

Example structure after adding two real people:

```json
{
  "testimonials": [
    {
      "name": "Real Buyer Name",
      "role": "Founder, Company",
      "product": "Purchased Product",
      "rating": 5,
      "quote": "The exact testimonial text they gave you.",
      "date": "June 2026"
    },
    {
      "name": "Second Real Buyer Name",
      "role": "Creator",
      "product": "Purchased Product",
      "rating": 5,
      "quote": "Another verified quote.",
      "date": "June 2026"
    }
  ]
}
```
