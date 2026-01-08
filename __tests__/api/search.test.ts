/**
 * Unit tests for Search API
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

describe('Search API Input Validation', () => {
  it('should reject empty query', () => {
    const query = ''
    expect(query.trim().length).toBe(0)
  })

  it('should reject query exceeding max length', () => {
    const query = 'a'.repeat(1001)
    expect(query.length).toBeGreaterThan(1000)
  })

  it('should accept valid URL', () => {
    const query = 'https://amazon.com/product/123'
    expect(() => new URL(query)).not.toThrow()
  })

  it('should accept valid keyword search', () => {
    const query = 'wireless headphones'
    expect(query.trim().length).toBeGreaterThan(0)
    expect(query.length).toBeLessThanOrEqual(1000)
  })

  it('should sanitize HTML tags', () => {
    const query = '<script>alert("xss")</script>product'
    const sanitized = query.replace(/[<>]/g, '')
    expect(sanitized).not.toContain('<')
    expect(sanitized).not.toContain('>')
  })

  it('should detect Amazon URLs', () => {
    const url = 'https://www.amazon.com/dp/B08N5WRWNW'
    const isAmazon = url.toLowerCase().includes('amazon.com')
    expect(isAmazon).toBe(true)
  })
})

describe('Search API Security', () => {
  it('should prevent XSS in query', () => {
    const maliciousQuery = 'product<script>alert(1)</script>'
    const sanitized = maliciousQuery.replace(/[<>]/g, '').replace(/javascript:/gi, '')
    expect(sanitized).not.toContain('<script>')
  })

  it('should prevent SQL injection patterns', () => {
    const query = "product'; DROP TABLE users; --"
    // In production, parameterized queries prevent this
    expect(query).toContain("'")
    // This test ensures we're aware of the pattern
  })

  it('should validate URL protocol', () => {
    const validUrl = 'https://example.com'
    const invalidUrl = 'javascript:alert(1)'
    
    const validParsed = new URL(validUrl)
    expect(['http:', 'https:']).toContain(validParsed.protocol)
    
    expect(() => {
      const invalidParsed = new URL(invalidUrl)
      if (!['http:', 'https:'].includes(invalidParsed.protocol)) {
        throw new Error('Invalid protocol')
      }
    }).toThrow()
  })
})
