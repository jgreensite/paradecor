/**
 * Architecture Boundary Tests (EPIC-15)
 *
 * Enforces the Ports & Adapters (Hexagonal) architecture using dependency-cruiser.
 * These tests act as a CI gate — any violation fails the build.
 *
 * Rules enforced (see .dependency-cruiser.cjs):
 *   - core/ must not import from infrastructure/
 *   - core/ must not import vendor SDKs (@clerk, @supabase, stripe)
 *   - core/domain/ must not import React or UI modules
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture boundaries (dependency-cruiser)', () => {
  it('should not violate any dependency-cruiser rules across src/', { timeout: 20_000 }, () => {
    try {
      const result = execSync('npx depcruise src --config .dependency-cruiser.cjs', {
        encoding: 'utf8',
        cwd: process.cwd(),
      });
      expect(result).toBeDefined();
    } catch (error: any) {
      throw new Error(`Architecture boundary violation:\n${error.stdout || error.message}`);
    }
  });
});

describe('Application layer vendor isolation (static analysis)', () => {
  const applicationDir = path.join(process.cwd(), 'src', 'core', 'application');

  it('application layer directory exists', () => {
    expect(fs.existsSync(applicationDir)).toBe(true);
  });

  it('application layer files must not directly import vendor SDKs', () => {
    if (!fs.existsSync(applicationDir)) return;

    const files = fs.readdirSync(applicationDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    const forbiddenPatterns = ['@clerk/', '@supabase/', "from 'stripe'", 'from "stripe"'];

    for (const file of files) {
      const content = fs.readFileSync(path.join(applicationDir, file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        const violation = content.includes(pattern);
        if (violation) {
          throw new Error(
            `Vendor SDK import found in application layer: ${file} contains "${pattern}". ` +
            'Vendor access must go through ports/adapters only.',
          );
        }
      }
    }

    expect(files.length).toBeGreaterThanOrEqual(1); // Ensure the test is actually meaningful
  });

  it('core/domain/types.ts must not import React or vendor SDKs', () => {
    const typesFile = path.join(process.cwd(), 'src', 'core', 'domain', 'types.ts');
    expect(fs.existsSync(typesFile)).toBe(true);

    const content = fs.readFileSync(typesFile, 'utf8');
    const forbidden = ['react', '@clerk', '@supabase', 'stripe'];

    for (const lib of forbidden) {
      expect(content).not.toContain(`from '${lib}`);
    }
  });
});
