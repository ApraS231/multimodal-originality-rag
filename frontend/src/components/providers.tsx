import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AbilityProvider, Can } from '@casl/react'
import { createAbility } from '../lib/ability'
import ToastProvider from './ui/toast-provider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 menit data fresh
      refetchOnWindowFocus: false,
    },
  },
})

// Sesi awal anonim (tanpa rules/ability kosong)
export const ability = createAbility([])

export { Can };

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AbilityProvider value={ability}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AbilityProvider>
    </QueryClientProvider>
  )
}

