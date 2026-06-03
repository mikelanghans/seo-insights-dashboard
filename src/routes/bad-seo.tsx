import { createFileRoute } from "@tanstack/react-router";

// Partially-fixed SEO test page. Round 2 — half of the remaining issues fixed.
// Fixed previously: title, meta description, single H1, image alt.
// Fixed this round:
// - Open Graph tags (og:title, og:description, og:url, og:type)
// - Canonical link
// Still broken (on purpose):
// - Non-descriptive link text ("here", "read more")
// - No <main> landmark / semantic structure
export const Route = createFileRoute("/bad-seo")({
  component: BadSeoPage,
  head: () => ({
    meta: [
      { title: "Bad SEO Test Page — Turbo Audit" },
      {
        name: "description",
        content:
          "Test fixture page used to validate the SEO scanner. Half of the common issues have been fixed; the rest remain on purpose.",
      },
      { property: "og:title", content: "Bad SEO Test Page — Turbo Audit" },
      {
        property: "og:description",
        content:
          "Test fixture page used to validate the SEO scanner. Half of the common issues have been fixed; the rest remain on purpose.",
      },
      { property: "og:url", content: "https://turbo-audit.lovable.app/bad-seo" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://turbo-audit.lovable.app/bad-seo" },
    ],
  }),
});

function BadSeoPage() {
  return (
    <div>
      <h1>Bad SEO Test Page</h1>
      <h2>Another Heading</h2>
      <img src="https://placehold.co/600x400" alt="Placeholder image used for SEO scanner testing" />
      <p>
        Click <a href="/">here</a> to go back.
      </p>
      <a href="/about">read more</a>
      <div>lorem ipsum dolor sit amet</div>
    </div>
  );
}
