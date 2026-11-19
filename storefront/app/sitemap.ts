import type {MetadataRoute} from 'next'
export default function sitemap():MetadataRoute.Sitemap{return [{url:process.env.NEXT_PUBLIC_BASE_URL||'http://127.0.0.1:5081'}]}
