import {getSession} from '@/lib/auth'
import {redirect} from 'next/navigation'
export default async function Restricted({children}:{children:React.ReactNode}) {
 if(!await getSession())redirect('/admin')
 return children
}
