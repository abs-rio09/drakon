import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { LogoContent } from '../../components/Logo'
import { AlertIcon } from '../../components/icons'
import { inputClass } from '../../components/ui/Field'
import { button } from '../../components/ui/styles'
import { useAdmin } from '../../features/admin/AdminContext'
import { login } from '../../features/admin/adminApi'
import { ApiError } from '../../lib/api'

// /admin/login, styled like the customer Sign in screen
// (docs/design/screens/SignIn.dc.html): form on the left, photo on the right.
export default function AdminLogin() {
  const { admin, loggedIn } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  if (admin) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setSending(true)
    setError('')
    try {
      const a = await login(email, password)
      setPassword('')
      loggedIn(a)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <title>Log in · DRAKON Admin</title>
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-18 w-full max-w-page items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2">
            <LogoContent />
          </span>
          <span className="text-label text-ink-subtle">Admin</span>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-page flex-1 gap-10 px-4 pt-12 pb-24 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20 lg:px-8 lg:pb-32"
      >
        <section aria-labelledby="login-h" className="flex max-w-[440px] flex-col justify-center gap-10">
          <div className="flex flex-col gap-3">
            <h1 id="login-h" className="text-heading-2 text-ink-strong sm:text-heading-1">
              Log in
            </h1>
            <p className="text-body-lg text-ink-muted">The DRAKON admin. Only the owner account can log in here.</p>
          </div>

          <form onSubmit={onSubmit} noValidate aria-label="Log in" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-email" className="text-label text-ink-muted">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="login-password" className="text-label text-ink-muted">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  className={inputClass + ' pr-18'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  className="absolute top-0.5 right-1 h-11 min-w-15 rounded-lg px-3 text-label text-ink-muted transition-colors duration-fast ease-out-drakon hover:text-ink-strong"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p id="login-error" role="alert" className="flex items-start gap-2 text-label font-normal text-danger-text">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <div className="pt-2">
              <button type="submit" disabled={sending} className={button('primary', 'lg') + ' w-full'}>
                {sending ? 'Checking…' : 'Log in'}
              </button>
            </div>
          </form>

          <p className="border-t border-line pt-6 text-label font-normal text-ink-subtle">
            Forgot the password? On the server, run <code className="text-ink-muted">make reset-password EMAIL=…</code> in{' '}
            <code className="text-ink-muted">api/</code>.
          </p>
        </section>

        <div aria-hidden="true" className="relative hidden min-h-[640px] overflow-hidden rounded-3xl bg-field lg:block">
          <img
            src="/img/p-hoodie02-tag.webp"
            alt=""
            className="absolute inset-0 size-full object-cover object-[50%_35%] motion-safe:animate-fade-in"
          />
        </div>
      </main>
    </div>
  )
}
