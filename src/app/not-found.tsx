import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-black">
      <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
        Page Not Found
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        Go Home
      </Link>
    </div>
  )
}
