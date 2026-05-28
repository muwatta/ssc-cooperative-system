import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import type { LoginRequest } from '@/types'
import { AxiosError } from 'axios'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>()

  const onSubmit = async (data: LoginRequest) => {
    setServerError('')
    try {
      const result = await login(data)
      if (result.is_first_login) {
        navigate('/set-password')
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      const error = err as AxiosError<Record<string, string[]>>
      const detail = error.response?.data
      if (detail?.detail) {
        setServerError(detail.detail as unknown as string)
      } else if (detail?.staff_id) {
        setServerError(detail.staff_id[0])
      } else if (detail?.non_field_errors) {
        setServerError(detail.non_field_errors[0])
      } else {
        setServerError('Invalid credentials. Please check your Staff ID and password.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <span className="text-3xl font-black text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Solace Staff Cooperative</h1>
          <p className="text-primary-200 text-sm mt-1">Management System</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">Use your school Staff ID to access the system.</p>

          {serverError && (
            <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-lg px-4 py-3 mb-4">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Staff ID */}
            <div className="mb-4">
              <label className="label">Staff ID</label>
              <input
                {...register('staff_id', {
                  required: 'Staff ID is required',
                  pattern: {
                    value: /^S\d{2}-\d{4}$/,
                    message: 'Format must be S{YY}-{NNNN} e.g. S43-0094',
                  },
                })}
                className={`input uppercase ${errors.staff_id ? 'input-error' : ''}`}
                placeholder="S43-0094"
                autoFocus
                autoComplete="username"
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
              />
              {errors.staff_id && (
                <p className="field-error">{errors.staff_id.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {errors.password && (
                <p className="field-error">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-2.5"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            First time? Your Admin will provide your Staff ID.
          </p>
        </div>

        <p className="text-center text-primary-300 text-xs mt-4">
          SSC Cooperative Management System v1.2
        </p>
      </div>
    </div>
  )
}
