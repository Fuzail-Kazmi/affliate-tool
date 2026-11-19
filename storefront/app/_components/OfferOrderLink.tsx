import Link from 'next/link'
import Icon from './Icon'

export default function OfferOrderLink({
  slug,
  name,
}: {
  slug: string
  name: string
}) {
  return (
    <Link
      href={'/' + slug + '/view/vouchers?edit=order'}
      aria-label={'Edit offer order for ' + name}
      title="Edit offer order"
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-brand hover:bg-gray-100"
    >
      <Icon name="pencil" size={17} />
    </Link>
  )
}
