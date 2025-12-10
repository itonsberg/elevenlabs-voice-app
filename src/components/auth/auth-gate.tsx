'use client'

import { ReactNode } from 'react'
import { useAuth } from './auth-provider'
import { LoginForm } from './login-form'

export function AuthGate({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth()

  if (!authenticated) {
    return <LoginForm />
  }

  return <>{children}</>
}
