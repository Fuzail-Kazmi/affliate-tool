import assert from 'node:assert/strict'
import { test } from 'node:test'
import { localIntent } from '../lib/affiliate/questions'

test('understands the suggested catalog questions and named store follow-ups', () => {
  for (const [q, expected] of [
    ['Which stores have no offers?', 'empty'],
    ['Show expiring coupons', 'expiry'],
    ['How do I verify a coupon?', 'verify'],
    ['Show Allbirds promo codes', 'codes'],
    ['List stores', 'catalog'],
    ['How do I publish these offers?', 'publish'],
    ['How do I scan a merchant website?', 'discover'],
  ])
    assert.equal(localIntent(q, ['Allbirds']), expected)
})
test('unrelated questions stay outside store support', () => {
  for (const q of [
    'Write a poem',
    'What is the weather at this store?',
    'Can you debug my program?',
  ])
    assert.equal(localIntent(q, []), 'outside')
})
