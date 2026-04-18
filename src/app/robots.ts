import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/root/", "/dashboard", "/journals/", "/settings", "/admin/"],
      },
    ],
    sitemap: "https://wesetup.ru/sitemap.xml",
    host: "https://wesetup.ru",
  };
}
