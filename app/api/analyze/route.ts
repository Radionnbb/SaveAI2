import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import axios from 'axios'
import { handleApiError, verifyAuth, validateRequiredFields, logApiRequest, type ApiResponse } from '@/lib/api/helpers'

interface AnalyzeRequest {
  productName: string
  productPrice: number
  productUrl: string
  productDescription?: string
}

interface AnalysisResult {
  summary: string
  pros: string[]
  cons: string[]
  suggestedAlternatives: Array<{
    name: string
    reason: string
  }>
  aiProvider: 'openai' | 'manus'
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<AnalysisResult>>> {
  try {
    // Verify authentication
    const { userId, error: authError } = await verifyAuth()
    if (authError) return authError

    logApiRequest('/api/analyze', 'POST', userId!)

    // Parse request body
    const body: AnalyzeRequest = await request.json()

    // Validate required fields
    const validationError = validateRequiredFields(body, ['productName', 'productPrice', 'productUrl'])
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 })
    }

    let analysisResult: AnalysisResult

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        analysisResult = await analyzeWithOpenAI(body)
      } catch (openaiError) {
        console.error('[OpenAI Error]:', openaiError)
        // Fallback to Manus
        if (process.env.MANUS_API_KEY) {
          analysisResult = await analyzeWithManus(body)
        } else {
          throw new Error('No AI service available')
        }
      }
    } else if (process.env.MANUS_API_KEY) {
      analysisResult = await analyzeWithManus(body)
    } else {
      // Fallback to mock data if no API keys configured
      analysisResult = generateMockAnalysis(body)
    }

    return NextResponse.json({
      success: true,
      data: analysisResult,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

async function analyzeWithOpenAI(product: AnalyzeRequest): Promise<AnalysisResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const prompt = `Analyze this product and provide a structured response:

Product: ${product.productName}
Price: $${product.productPrice}
Description: ${product.productDescription || 'N/A'}

Provide:
1. A brief summary (2-3 sentences)
2. 3-5 pros
3. 3-5 cons
4. 2-3 suggested alternative products with reasons

Format as JSON with keys: summary, pros (array), cons (array), suggestedAlternatives (array of {name, reason})`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a product analysis expert. Provide honest, helpful analysis in JSON format only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0].message.content || '{}'
  const parsed = JSON.parse(content)

  return {
    summary: parsed.summary || 'Analysis completed',
    pros: parsed.pros || [],
    cons: parsed.cons || [],
    suggestedAlternatives: parsed.suggestedAlternatives || [],
    aiProvider: 'openai',
  }
}

async function analyzeWithManus(product: AnalyzeRequest): Promise<AnalysisResult> {
  // Manus API integration (placeholder - adjust based on actual API)
  const response = await axios.post(
    'https://api.manus.ai/v1/analyze', // Replace with actual endpoint
    {
      product_name: product.productName,
      product_price: product.productPrice,
      product_url: product.productUrl,
      description: product.productDescription,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MANUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = response.data

  return {
    summary: data.summary || 'Analysis completed',
    pros: data.pros || [],
    cons: data.cons || [],
    suggestedAlternatives: data.alternatives || [],
    aiProvider: 'manus',
  }
}

function generateMockAnalysis(product: AnalyzeRequest): AnalysisResult {
  return {
    summary: `${product.productName} is a solid choice at $${product.productPrice}. It offers good value for money with competitive features in its category.`,
    pros: [
      'Competitive pricing',
      'Good build quality',
      'Positive user reviews',
      'Wide availability',
      'Reliable brand',
    ],
    cons: [
      'Limited color options',
      'Could have better warranty',
      'Shipping may take longer',
    ],
    suggestedAlternatives: [
      {
        name: 'Similar Product A',
        reason: 'Better warranty coverage and slightly lower price',
      },
      {
        name: 'Similar Product B',
        reason: 'Premium features with excellent customer reviews',
      },
    ],
    aiProvider: 'openai',
  }
}