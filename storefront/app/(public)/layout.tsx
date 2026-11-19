import Link from 'next/link'
import Brand from '@/app/_components/Brand'
export default function Layout({children}:{children:React.ReactNode}){return <><header className="catalog-header"><Link href="/"><Brand/></Link><Link href="/login">Workspace sign in</Link></header><main>{children}</main></>}
