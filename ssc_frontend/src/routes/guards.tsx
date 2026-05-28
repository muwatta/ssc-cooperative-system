import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'

// ── Spinner shown while auth state is loading 
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

// ── Requires authentication 
export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}

// ── Requires specific role(s) 
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}

// ── Redirects already-logged-in users away from /login 
export function GuestOnly() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
