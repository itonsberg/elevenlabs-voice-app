'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { isAuthenticated, setAuthenticated, logout, validateCredentials } from '@/lib/auth'

interface AuthContextType {
  authenticated: boolean
  login: (password: string, code: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthState] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuthState(isAuthenticated())
    setLoading(false)
  }, [])

  const login = (password: string, code: string) => {
    if (validateCredentials(password, code)) {
      setAuthenticated()
      setAuthState(true)
      return true
    }
    return false
  }

  const handleLogout = () => {
    logout()
    setAuthState(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ authenticated, login, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
