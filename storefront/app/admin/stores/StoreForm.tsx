import RecordForm from '@/app/admin/_components/RecordForm'
import Link from 'next/link'
import type { Store } from '@/lib/db/schema'
import ImageUploadInput from '@/app/_components/ImageUploadInput'

type Props = {

  action: (formData: FormData) => Promise<{error:string} | void>
  defaultValues?: Partial<Store>
}

export default function StoreForm({ action, defaultValues }: Props) {
  return (
    <RecordForm action={action} className="bg-white rounded-xl border border-emerald-100 shadow-sm p-6 space-y-5 max-w-lg">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
        <input
          id="name" name="name"
          required
          defaultValue={defaultValues?.name}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="e.g. Amazon"
        />
        <p className="text-xs text-gray-400 mt-1">A URL slug will be generated automatically from the name.</p>
      </div>

      <label className="block text-sm font-medium text-gray-700">Merchant website
        <input name="website" type="url" maxLength={2048} defaultValue={defaultValues?.website || ''} placeholder="https://merchant.com" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"/>
      </label>
      <ImageUploadInput label="Logo / Image" defaultValue={defaultValues?.imageUrl} />

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          Save
        </button>
        <Link
          href="/admin/stores"
          className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </RecordForm>
  )
}
