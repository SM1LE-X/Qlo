import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/story", "/llms.txt"],
        disallow: ["/api/"],
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"],
        allow: ["/", "/story", "/llms.txt"],
        disallow: ["/api/", "/patient", "/hospital", "/insurer"],
      },
    ],
  };
}
