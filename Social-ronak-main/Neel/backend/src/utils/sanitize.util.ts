/**
 * Input sanitization utilities to prevent XSS, SQL injection, and other attacks.
 * Used across the platform for user-submitted content.
 */

// Strips dangerous HTML tags but preserves basic formatting
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
    .replace(/<embed\b[^>]*\/?>/gi, '') // Remove embed tags
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Remove inline event handlers (double quotes)
    .replace(/on\w+\s*=\s*'[^']*'/gi, '') // Remove inline event handlers (single quotes)
    .replace(/javascript\s*:/gi, '') // Remove javascript: protocol
    .replace(/data\s*:\s*text\/html/gi, '') // Remove data:text/html
    .trim();
}

// Strip ALL HTML for plain text
export function stripAllHtml(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// Sanitize for safe database queries (prevents NoSQL injection patterns)
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/[${}]/g, '') // Remove MongoDB-style operators
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

// Validate and sanitize URLs
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    // If it's a relative path starting with /, allow it
    if (url.startsWith('/') && !url.includes('..')) {
      return url;
    }
    return null;
  }
}
