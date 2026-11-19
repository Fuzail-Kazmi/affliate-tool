import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/login', '/*/view/vouchers'],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://127.0.0.1:5081'}/sitemap.xml`,
  }
}
