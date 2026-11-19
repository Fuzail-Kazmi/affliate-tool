import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core'
import type { Discovery } from '../affiliate/types'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').default('Admin').notNull(),
  grants: jsonb('grants').$type<string[] | null>(),
  active: boolean('active').default(true).notNull(),
  sessionVersion: integer('session_version').default(0).notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  website: text('website'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const blogCategories = pgTable('blog_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const blogs = pgTable('blogs', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  featuredImage: text('featured_image'),
  metaKeywords: text('meta_keywords'),
  featured: boolean('featured').default(false).notNull(),
  categoryId: integer('category_id').references(() => blogCategories.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Coupon type: 'copy' = copy-to-clipboard, 'link' = direct link
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .notNull()
    .references(() => stores.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull().$type<'copy' | 'link'>(),
  code: text('code'),       // for 'copy' type
  linkUrl: text('link_url'), // for 'link' type
  expiresAt: timestamp('expires_at'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const carouselImages = pgTable('carousel_images', {
  id: serial('id').primaryKey(),
  imageUrl: text('image_url').notNull(),
  mobileImageUrl: text('mobile_image_url'),
  title: text('title'),
  linkUrl: text('link_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  price: text('price').notNull(),
  linkUrl: text('link_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
})

export type User = typeof users.$inferSelect
export const offerScans = pgTable('offer_scans', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  adminId: integer('admin_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  result: jsonb('result').notNull().$type<Discovery>(),
  saved: jsonb('saved').notNull().$type<number[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
export type Store = typeof stores.$inferSelect
export type BlogCategory = typeof blogCategories.$inferSelect
export type Blog = typeof blogs.$inferSelect
export type Coupon = typeof coupons.$inferSelect
export type CarouselImage = typeof carouselImages.$inferSelect
export type Product = typeof products.$inferSelect
export type NewStore = typeof stores.$inferInsert
export type NewBlog = typeof blogs.$inferInsert
export type NewCoupon = typeof coupons.$inferInsert
export type NewCarouselImage = typeof carouselImages.$inferInsert
export type NewProduct = typeof products.$inferInsert
export type Setting = typeof settings.$inferSelect

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').references(()=>stores.id,{onDelete:'set null'}),
  storeName: text('store_name').notNull(),
  employeeId: integer('employee_id').references(()=>users.id,{onDelete:'set null'}),
  kind: text('kind').notNull(),
  sheet: text('sheet'),
  completedWebsite: text('completed_website'),
  started: timestamp('started', {withTimezone:true}),
  completed: timestamp('completed',{withTimezone:true}),
  created: timestamp('created',{withTimezone:true}).defaultNow().notNull(),
})
export const events = pgTable('activity_log', {
  id: serial('id').primaryKey(), actor:text('actor').notNull(), role:text('role').notNull(),
  action:text('action').notNull(), previous:jsonb('previous'), updated:jsonb('updated'),
  at:timestamp('at',{withTimezone:true}).defaultNow().notNull(),
})
