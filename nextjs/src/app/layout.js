import { Manrope } from 'next/font/google'
import { AppProviders } from '@/components/providers'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
})

const themeScript = `
  (() => {
    try {
      const theme = window.localStorage.getItem('budgetbuddy.theme') === 'dark' ? 'dark' : 'light'
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    } catch (error) {
      document.documentElement.dataset.theme = 'light'
      document.documentElement.style.colorScheme = 'light'
    }
  })();
`

export const metadata = {
  title: {
    default: 'BudgetBuddy',
    template: '%s | BudgetBuddy',
  },
  description: 'A soft, focused money-tracking app for students.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={manrope.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
