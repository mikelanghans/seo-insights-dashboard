import { createFileRoute } from "@tanstack/react-router";

const FAQS = [
  {
    q: "What is Turbo Audit?",
    a: "Turbo Audit is an SEO and AEO scanner that grades a website's on-page signals, page speed, structured data, and answer-engine readiness, then lists specific issues to fix.",
  },
  {
    q: "What is AEO (Answer Engine Optimization)?",
    a: "AEO is the practice of structuring a page so AI answer engines like ChatGPT, Perplexity, and Google AI Overviews can quote it directly. It relies on clear questions, concise answers, FAQ schema, and a summary near the top of the page.",
  },
  {
    q: "How is this page used?",
    a: "This page is a test fixture that the Turbo Audit team uses to validate scanner output. Every known SEO and AEO check should pass on this URL.",
  },
  {
    q: "How do I run a scan with Turbo Audit?",
    a: "Open the Turbo Audit home page, paste a website URL into the scan form, and click Scan. A full report is ready in about a minute.",
  },
];

export const Route = createFileRoute("/bad-seo")({
  component: BadSeoPage,
  head: () => ({
    meta: [
      { title: "Bad SEO Test Page — Turbo Audit" },
      {
        name: "description",
        content:
          "Test fixture page for the Turbo Audit SEO and AEO scanner. Includes FAQ schema, a summary answer, and answer-engine-ready structure.",
      },
      { property: "og:title", content: "Bad SEO Test Page — Turbo Audit" },
      {
        property: "og:description",
        content:
          "Test fixture page for the Turbo Audit SEO and AEO scanner. Includes FAQ schema, a summary answer, and answer-engine-ready structure.",
      },
      { property: "og:url", content: "https://turbo-audit.lovable.app/bad-seo" },
      { property: "og:type", content: "article" },
    ],
    links: [
      { rel: "canonical", href: "https://turbo-audit.lovable.app/bad-seo" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Bad SEO Test Page — Turbo Audit",
          description:
            "Test fixture page for the Turbo Audit SEO and AEO scanner.",
          author: { "@type": "Organization", name: "Turbo Audit" },
          publisher: { "@type": "Organization", name: "Turbo Audit" },
          datePublished: "2026-06-03",
          dateModified: "2026-06-03",
          mainEntityOfPage: "https://turbo-audit.lovable.app/bad-seo",
          image: "https://placehold.co/600x400",
        }),
      },
    ],
  }),
});

function BadSeoPage() {
  return (
    <main>
      <article>
        <h1>Bad SEO Test Page</h1>

        <p>
          <strong>Summary:</strong> This page is a fixture used by Turbo Audit
          to validate its SEO and AEO (Answer Engine Optimization) scanner. It
          ships with a single H1, descriptive link text, semantic landmarks,
          FAQ structured data, and a clear summary so answer engines can
          quote it directly.
        </p>

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
        </section>

        <section>
          <h2>Frequently asked questions</h2>
          <dl>
            {FAQS.map((f) => (
              <div key={f.q}>
                <dt>
                  <strong>{f.q}</strong>
                </dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
    </main>
  );
}
