/**
 * Unit tests for ExportService
 *
 * Tests that SVG/DXF generation produces non-empty, format-correct output
 * from a minimal makerjs model. Validates the ExportService abstraction
 * layer over makerjs without exercising the full CNC layout engine.
 */
import { describe, it, expect } from 'vitest';
import makerjs from 'makerjs';
import { ExportService } from '../ExportService';

/** Minimal valid makerjs model: a 100x100mm rectangle */
function makeTestModel(): makerjs.IModel {
  return new makerjs.models.Rectangle(100, 100);
}

describe('ExportService.generateSVG', () => {
  it('returns a non-empty SVG string', () => {
    const svg = ExportService.generateSVG(makeTestModel());

    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('SVG contains expected stroke styling', () => {
    const svg = ExportService.generateSVG(makeTestModel());

    expect(svg).toContain('stroke');
  });
});

describe('ExportService.generateDXF', () => {
  it('returns a non-empty DXF string', () => {
    const dxf = ExportService.generateDXF(makeTestModel());

    expect(typeof dxf).toBe('string');
    expect(dxf.length).toBeGreaterThan(0);
    // DXF files always start with the section header
    expect(dxf).toContain('SECTION');
  });

  it('DXF contains entity data', () => {
    const dxf = ExportService.generateDXF(makeTestModel());

    expect(dxf).toContain('ENTITIES');
  });
});

describe('ExportService.generateSVG vs generateDXF', () => {
  it('generates different formats from the same model', () => {
    const model = makeTestModel();
    const svg = ExportService.generateSVG(model);
    const dxf = ExportService.generateDXF(model);

    expect(svg).not.toBe(dxf);
  });
});
