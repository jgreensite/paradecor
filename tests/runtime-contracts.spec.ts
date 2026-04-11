import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Runtime contracts', () => {
  it('keeps the checked-in orders schema aligned with the runtime order contract', () => {
    const schemaPath = path.join(process.cwd(), 'server', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    expect(schema).toContain('customer_email TEXT')
    expect(schema).toContain('design_payload JSONB NOT NULL')
    expect(schema).toContain('is_custom_design BOOLEAN NOT NULL DEFAULT false')
    expect(schema).toContain("status IN ('awaiting_approval', 'approved', 'in_production', 'shipped')")
    expect(schema).toContain('stripe_payment_id TEXT')
    expect(schema).toContain("auth.jwt() ->> 'email' = customer_email")
  })

  it('uses lockfile-respecting installs in Render build commands', () => {
    const renderPath = path.join(process.cwd(), 'render.yaml')
    const renderConfig = fs.readFileSync(renderPath, 'utf8')

    expect(renderConfig).toContain('buildCommand: npm ci')
    expect(renderConfig).toContain('buildCommand: npm ci && npm run build')
    expect(renderConfig).not.toContain('buildCommand: npm install')
  })
})
