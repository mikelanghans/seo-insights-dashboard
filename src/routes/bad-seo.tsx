import { createFileRoute } from "@tanstack/react-router";

// Fully-fixed SEO test page. All known issues from earlier rounds are resolved:
// - Title + meta description
// - Open Graph tags + canonical
// - Single H1, image alt
// - Descriptive link text
// - <main> landmark / semantic structure
export const Route = createFileRoute("/bad-seo")({
  component: BadSeoPage,
  head: () => ({
    meta: [
      { title: "Bad SEO Test Page — Turbo Audit" },
      {
        name: "description",
        content:
          "Test fixture page used to validate the SEO scanner. All previously-flagged issues have been resolved.",
      },
      { property: "og:title", content: "Bad SEO Test Page — Turbo Audit" },
      {
        property: "og:description",
        content:
          "Test fixture page used to validate the SEO scanner. All previously-flagged issues have been resolved.",
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
    <main>
      <h1>Bad SEO Test Page</h1>
      <section>
        <h2>About this page</h2>
        <img
          src="https://placehold.co/600x400"
          alt="Placeholder image used for SEO scanner testing"
          width={600}
          height={400}
        />
        <p>
          This fixture page is used to validate the Turbo Audit SEO scanner.{" "}
          <a href="/">Return to the Turbo Audit home page</a> or{" "}
          <a href="/history">view recent scan history</a>.
        </p>
        <p>lorem ipsum dolor sit amet</p>
      </section>
    </main>
  );
}
