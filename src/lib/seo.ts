export const SITE_URL = "https://catlog.party";
export const SITE_NAME = "cat.log";

interface Page {
	title: string;
	description: string;
	/** Path from the site root, e.g. "/meowstermind". */
	path: string;
	/** Keep the page out of search results (it has nothing to read without JS). */
	noindex?: boolean;
}

/** Title, description, canonical URL and share-card tags for one page. */
export function seo({ title, description, path, noindex }: Page) {
	const url = new URL(path, SITE_URL).href;
	const image = new URL("/og.png", SITE_URL).href;
	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			...(noindex ? [{ name: "robots", content: "noindex, follow" }] : []),
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: SITE_NAME },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: url },
			{ property: "og:image", content: image },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{
				property: "og:image:alt",
				content:
					"cat.log: cozy cat games to play together. Five sticker cats and paw prints.",
			},
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
			{ name: "twitter:image", content: image },
		],
		links: [{ rel: "canonical", href: url }],
	};
}

/** A JSON-LD block for the page head. */
export function jsonLd(data: Record<string, unknown>) {
	return {
		type: "application/ld+json",
		children: JSON.stringify({ "@context": "https://schema.org", ...data }),
	};
}
