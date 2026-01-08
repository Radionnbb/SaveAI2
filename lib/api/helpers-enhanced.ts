import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface ApiError {
  error: string
  details?: string
  code?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: string
}

/**
 * Enhanced centralized error handler for API routes
 */
export function handleApiError(error: unknown): NextResponse<ApiError> {
  // Log error without sensitive data
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  console.error('[API Error]:', {
    message: errorMessage,
    timestamp: new Date().toISOString(),
  })

  if (error instanceof Error) {
    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production'
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: isProduction ? 'An error occurred' : error.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      error: 'Unknown error occurred',
    },
    { status: 500 }
  )
}

/**
 * Enhanced authentication verification with better error handling
 */
export async function verifyAuth(): Promise<{ userId: string | null; error?: NextResponse }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        userId: null,
        error: NextResponse.json(
          { error: 'Unauthorized', details: 'Please sign in to continue' },
          { status: 401 }
        ),
      }
    }

    return { userId: user.id }
  } catch (error) {
    console.error('[Auth Error]:', {
      message: error instanceof Error ? error.message : 'Unknown',
      timestamp: new Date().toISOString(),
    })
    return {
      userId: null,
      error: NextResponse.json({ error: 'Authentication failed' }, { status: 401 }),
    }
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body: any, requiredFields: string[]): string | null {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`
    }
  }
  return null
}

/**
 * Enhanced input sanitization to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000) // Limit length
}

/**
 * Detect if input is a URL
 */
export function isUrl(input: string): boolean {
  try {
    const url = new URL(input)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * Detect URL type (Amazon, etc.)
 */
export function detectUrlType(url: string): 'amazon' | 'other' {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('amazon.com') || lowerUrl.includes('amzn.to')) {
    return 'amazon'
  }
  return 'other'
}

/**
 * Structured logging for API requests (without sensitive data)
 */
export function logApiRequest(endpoint: string, method: string, userId?: string) {
  console.log(
    JSON.stringify({
      type: 'api_request',
      endpoint,
      method,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString(),
    })
  )
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}
