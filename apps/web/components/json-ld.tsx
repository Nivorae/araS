/**
 * Renders a JSON-LD `<script>` tag. Use for schema.org structured data so AI
 * crawlers and search engines can parse the page's entities.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- Next.js's documented pattern for JSON-LD
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
