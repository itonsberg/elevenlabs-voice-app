import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserMenu } from '@/components/auth/user-menu'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
          ElevenLabs Voice AI
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/chat"
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Chat
              </Link>
              <Link
                href="/voice"
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Voice
              </Link>
              <UserMenu email={user.email || 'User'} />
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
