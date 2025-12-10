/**
 * Simple client-side authentication
 * Password: HelloAi2025@
 * Code: 3117
 */

const VALID_PASSWORD = 'HelloAi2025@'
const VALID_CODE = '3117'
const AUTH_KEY = 'voice-ai-auth'

export function validateCredentials(password: string, code: string): boolean {
  return password === VALID_PASSWORD && code === VALID_CODE
}

export function setAuthenticated(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_KEY, 'true')
  }
}

export function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_KEY) === 'true'
  }
  return false
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_KEY)
  }
}
