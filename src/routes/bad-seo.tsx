import { createFileRoute } from "@tanstack/react-router";

// Intentionally bad SEO page for testing the SEO scanner.
// - No <title> override (falls back to root)
// - No meta description
// - No Open Graph tags
// - No canonical link
// - Multiple H1s, non-descriptive link text, images without alt
export const Route = createFileRoute("/bad-seo")({
  component: BadSeoPage,
});

function BadSeoPage() {
  return (
    <div>
      <h1>Welcome</h1>
      <h1>Another Heading</h1>
      <img src="https://placehold.co/600x400" />
      <p>
        Click <a href="/">here</a> to go back.
      </p>
      <a href="/about">read more</a>
      <div>lorem ipsum dolor sit amet</div>
    </div>
  );
}
