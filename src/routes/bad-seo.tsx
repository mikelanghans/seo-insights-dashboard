import { createFileRoute } from "@tanstack/react-router";

// Partially-fixed SEO test page. Half of the issues are intentionally left.
// Fixed:
// - Added <title> override
// - Added meta description
// - Single H1
// - Image has alt text
// Still broken (on purpose):
// - No Open Graph tags (og:title, og:description, og:url)
// - No canonical link
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
