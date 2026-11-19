export type Trial = {
  product: string
  price: string
  result: string
  savingsMinor?: number
  currency?: string
}
export type Offer = {
  title: string
  code: string
  source: string
  image?: string
  evidence: string
  verification: string
  trials: Trial[]
}
export type Discovery = {
  logo?: string
  offers: Offer[]
  warnings: string[]
  engine: string
}
export type Scan = {
  id: number
  storeId: number
  url: string
  result: Discovery
  saved: number[]
}
export type StoreOption = {
  id: number
  name: string
  slug: string
  website: string | null
}
