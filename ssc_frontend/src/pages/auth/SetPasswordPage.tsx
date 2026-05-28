import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { authApi } from '@/api/services'
import { useAuth } from '@/context/AuthContext'

interface FormData {
  password: string
  password_confirm: string
}

export default function SetPasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      await authApi.setInitialPassword({
        staff_id: user?.staff_id ?? '',
        password: data.password,
        password_confirm: data.password_confirm,
      })
      navigate('/dashboard', { replace: true })
    } catch {
      setServerError('Failed to set password. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Set your password</h1>
          <p className="text-sm text-gray-500 mb-6">
            Welcome to SSC. Choose a secure password to continue.
          </p>

          {serverError && (
            <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-lg px-4 py-3 mb-4">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-4">
              <label className="label">New Password</label>
              <input
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                })}
                type="password"
                className={`input ${errors.password ? 'input-error' : ''}`}
                placeholder="At least 8 characters"
              />
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            <div className="mb-6">
              <label className="label">Confirm Password</label>
              <input
                {...register('password_confirm', {
                  required: 'Please confirm your password',
                  validate: (val) => val === watch('password') || 'Passwords do not match',
                })}
                type="password"
                className={`input ${errors.password_confirm ? 'input-error' : ''}`}
                placeholder="Repeat password"
              />
              {errors.password_confirm && (
                <p className="field-error">{errors.password_confirm.message}</p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? 'Setting password...' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
