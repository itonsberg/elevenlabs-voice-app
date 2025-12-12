'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface UserMenuProps {
  email: string
}

export function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
      >
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">
          {email[0].toUpperCase()}
        </span>
        <span className="text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate">
          {email}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-20">
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 truncate">{email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
