import AuthForm from '@/components/auth-form'

export const metadata = {
  title: 'Login',
}

export default function LoginPage({ searchParams }) {
  return (
    <AuthForm
      initialEmail={typeof searchParams?.email === 'string' ? searchParams.email : ''}
      mode="login"
      showSignupSuccess={searchParams?.signup === 'success'}
      showExpiredWarning={searchParams?.expired === 'true'}
    />
  )
}
