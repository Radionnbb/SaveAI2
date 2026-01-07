import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  handleApiError,
  verifyAuth,
  validateRequiredFields,
  sanitizeInput,
  isUrl,
  detectUrlType,
  logApiRequest,
  type ApiResponse,
} from '@/lib/api/helpers'

interface SearchRequest {
  query: string
}

interface Product {
  id: string
  name: string
  price: number
  currency: string
  image?: string
  url: string
  store: string
  rating?: number
  reviews?: number
}

interface SearchResponse {
  query: string
  type: 'url' | 'keyword'
  urlType?: 'amazon' | 'other'
  product: Product
  alternatives: Product[]
  cheapest: Product
  searchId: string
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SearchResponse>>> {
  try {
    // Verify authentication
    const { userId, error: authError } = await verifyAuth()
    if (authError) return authError

    logApiRequest('/api/search', 'POST', userId!)

    // Parse request body
    const body: SearchRequest = await request.json()

    // Validate required fields
    const validationError = validateRequiredFields(body, ['query'])
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 })
    }

    // Sanitize input
    const sanitizedQuery = sanitizeInput(body.query)

    if (!sanitizedQuery) {
      return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 })
    }

    // Detect if input is URL or keyword
    const isUrlInput = isUrl(sanitizedQuery)
    const urlType = isUrlInput ? detectUrlType(sanitizedQuery) : undefined

    // Mock product data (replace with actual scraping/API logic)
    const mockProduct: Product = {
      id: 'prod_' + Date.now(),
      name: isUrlInput ? 'Product from URL' : `Search results for: ${sanitizedQuery}`,
      price: 299.99,
      currency: 'USD',
      image: '/placeholder.jpg',
      url: isUrlInput ? sanitizedQuery : `https://example.com/product/${Date.now()}`,
      store: urlType === 'amazon' ? 'Amazon' : 'Generic Store',
      rating: 4.5,
      reviews: 1234,
    }

    // Mock alternatives
    const mockAlternatives: Product[] = [
      {
        id: 'alt_1',
        name: mockProduct.name + ' - Alternative 1',
        price: 279.99,
        currency: 'USD',
        image: '/placeholder.jpg',
        url: 'https://example.com/alt1',
        store: 'Store A',
        rating: 4.3,
        reviews: 890,
      },
      {
        id: 'alt_2',
        name: mockProduct.name + ' - Alternative 2',
        price: 319.99,
        currency: 'USD',
        image: '/placeholder.jpg',
        url: 'https://example.com/alt2',
        store: 'Store B',
        rating: 4.7,
        reviews: 2100,
      },
    ]

    const allProducts = [mockProduct, ...mockAlternatives]
    const cheapest = allProducts.reduce((min, p) => (p.price < min.price ? p : min))

    // Store search in database
    const supabase = await createClient()
    const { data: searchRecord, error: dbError } = await supabase
      .from('search_history')
      .insert({
        user_id: userId,
        query: sanitizedQuery,
        type: isUrlInput ? 'url' : 'keyword',
        url_type: urlType,
        result_count: allProducts.length,
        cheapest_price: cheapest.price,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[DB Error]:', dbError)
      // Continue even if DB insert fails
    }

    const response: SearchResponse = {
      query: sanitizedQuery,
      type: isUrlInput ? 'url' : 'keyword',
      urlType,
      product: mockProduct,
      alternatives: mockAlternatives,
      cheapest,
      searchId: searchRecord?.id || 'search_' + Date.now(),
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    return handleApiError(error)
  }
}