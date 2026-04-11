import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/architecture.spec.ts',
      'tests/runtime-contracts.spec.ts',
    ],
    exclude: [
      'tests/shelf-creator.spec.ts',
      'tests/dxf-accuracy.spec.ts',
      'tests/auth-gate.spec.ts',
      'tests/checkout.spec.ts',
    ],
  },
})
