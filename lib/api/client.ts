// Client-side API wrapper for SaveAI backend endpoints

export interface Product {
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

export interface SearchResponse {
  query: string
  type: 'url' | 'keyword'
  urlType?: 'amazon' | 'other'
  product: Product
  alternatives: Product[]
  cheapest: Product
  searchId: string
}

export interface AnalysisResult {
  summary: string
  pros: string[]
  cons: string[]
  suggestedAlternatives: Array<{
    name: string
    reason: string
  }>
  aiProvider: 'openai' | 'manus'
}

export interface AffiliateResponse {
  affiliateUrl: string
  originalUrl: string
  store: string
  tracked: boolean
}

export interface SavedProduct {
  id: string
  user_id: string
  product_name: string
  product_url: string
  product_price: number
  product_currency: string
  product_image?: string
  store: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface SearchHistoryItem {
  id: string
  query: string
  type: 'url' | 'keyword'
  url_type?: 'amazon' | 'other'
  result_count: number
  cheapest_price: number
  created_at: string
}

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'API request failed')
    }

    if (!data.success) {
      throw new Error(data.error || 'Request unsuccessful')
    }

    return data.data
  }

  // Search API
  async search(query: string): Promise<SearchResponse> {
    return this.request<SearchResponse>('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  }

  // AI Analysis API
  async analyze(productData: {
    productName: string
    productPrice: number
    productUrl: string
    productDescription?: string
  }): Promise<AnalysisResult> {
    return this.request<AnalysisResult>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(productData),
    })
  }

  // Affiliate Links API
  async getAffiliateLink(productUrl: string, store: string, productId?: string): Promise<AffiliateResponse> {
    return this.request<AffiliateResponse>('/api/affiliate', {
      method: 'POST',
      body: JSON.stringify({ productUrl, store, productId }),
    })
  }

  // Search History API
  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    return this.request<SearchHistoryItem[]>('/api/history', {
      method: 'GET',
    })
  }

  async deleteSearchHistory(id?: string): Promise<{ deleted: number }> {
    const url = id ? `/api/history?id=${id}` : '/api/history'
    return this.request<{ deleted: number }>(url, {
      method: 'DELETE',
    })
  }

  async retrySearch(historyId: string): Promise<{ query: string; redirectUrl: string }> {
    return this.request<{ query: string; redirectUrl: string }>('/api/history/retry', {
      method: 'POST',
      body: JSON.stringify({ historyId }),
    })
  }

  // Saved Products API
  async getSavedProducts(): Promise<SavedProduct[]> {
    return this.request<SavedProduct[]>('/api/saved', {
      method: 'GET',
    })
  }

  async saveProduct(productData: {
    productName: string
    productUrl: string
    productPrice: number
    productCurrency: string
    productImage?: string
    store: string
    notes?: string
  }): Promise<SavedProduct> {
    return this.request<SavedProduct>('/api/saved', {
      method: 'POST',
      body: JSON.stringify(productData),
    })
  }

  async updateSavedProduct(id: string, notes?: string): Promise<SavedProduct> {
    return this.request<SavedProduct>('/api/saved', {
      method: 'PATCH',
      body: JSON.stringify({ id, notes }),
    })
  }

  async deleteSavedProduct(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/api/saved?id=${id}`, {
      method: 'DELETE',
    })
  }
}

export const apiClient = new ApiClient()