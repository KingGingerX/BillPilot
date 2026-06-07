(function () {
  const section = document.querySelector("[data-testimonials-list]");
  if (!section) return;

  const maxRating = 5;
  const featuredCount = 6;

  function cleanText(value, limit) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, limit);
  }

  function cleanRating(value) {
    const rating = Number(value);
    if (!Number.isFinite(rating)) return 0;
    return Math.max(1, Math.min(maxRating, Math.round(rating)));
  }

  function validEntry(entry) {
    return cleanText(entry.name, 80) && cleanText(entry.quote, 420) && cleanRating(entry.rating);
  }

  function stars(rating) {
    return "★★★★★".slice(0, rating);
  }

  function renderCard(entry) {
    const card = document.createElement("article");
    card.className = "testimonial-card";

    const rating = cleanRating(entry.rating);
    const product = cleanText(entry.product, 90);
    const role = cleanText(entry.role, 120);
    const date = cleanText(entry.date, 40);

    card.innerHTML = [
      `<div class="testimonial-stars" aria-label="${rating} out of ${maxRating} stars">${stars(rating)}</div>`,
      `<blockquote>${cleanText(entry.quote, 420)}</blockquote>`,
      `<div class="testimonial-person">`,
      `<strong>${cleanText(entry.name, 80)}</strong>`,
      role ? `<span>${role}</span>` : "",
      product ? `<span>${product}</span>` : "",
      date ? `<span>${date}</span>` : "",
      `</div>`
    ].join("");

    return card;
  }

  fetch("data/testimonials.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("testimonial_data_unavailable");
      return response.json();
    })
    .then(function (data) {
      const entries = Array.isArray(data.testimonials) ? data.testimonials.filter(validEntry).slice(0, featuredCount) : [];
      if (!entries.length) return;
      section.replaceChildren.apply(section, entries.map(renderCard));
    })
    .catch(function () {});
})();
