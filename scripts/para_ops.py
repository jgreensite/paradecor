import os
import sys
import glob
import json
import subprocess
from pathlib import Path

def debug_dxf_shapes(dxf_path):
    """Parses a DXF file using the test tools and prints the largest shapes by area."""
    try:
        from tests.compare_dxf import parse_shapes
    except ImportError:
        print("Error: Could not import tests.compare_dxf. Ensure you are running from the project root.")
        return

    if not os.path.exists(dxf_path):
        print(f"Error: File {dxf_path} not found.")
        return

    shapes = parse_shapes(dxf_path)
    shapes.sort(key=lambda s: s["area"], reverse=True)
    
    print(f"Top 20 largest shapes in {dxf_path}:")
    for i, s in enumerate(shapes[:20]):
        print(f"{i+1}. {s['type']} - {s['width']:.2f}x{s['height']:.2f} = Area {s['area']:.2f} (Layer: {s['layer']}, Points: {s['num_pts']})")

    shapes.sort(key=lambda s: s["width"])
    print(f"\nPotential Slots by dimension in {dxf_path}:")
    count = 0
    for s in shapes:
        if s['width'] < 20 and s['has_bulge']:
            print(f"Slot? {s['type']} - min(W,H):{min(s['width'], s['height']):.2f}x{max(s['width'], s['height']):.2f} = Area {s['area']:.2f} (Bulge: {s['has_bulge']})")
            count += 1
            if count > 15:
                print("... (showing first 15)")
                break

def get_latest_dxf(output_dir='test-output', prefix='accuracy-'):
    """Finds the latest DXF file in the test output directory."""
    search_pattern = os.path.join(output_dir, f'{prefix}*.dxf')
    files = glob.glob(search_pattern)
    if not files:
        return None
    return max(files, key=os.path.getmtime)

def run_dxf_tests():
    """Runs the Playwright DXF accuracy tests."""
    print("Running Playwright DXF accuracy tests...")
    env = os.environ.copy()
    env["CI"] = ""
    result = subprocess.run(
        "npx playwright test tests/dxf-accuracy.spec.ts -g score --project=chromium --reporter=list",
        env=env,
        capture_output=True,
        text=True,
        shell=True
    )
    print(result.stdout)
    if result.returncode != 0:
        print("Playwright tests failed (this might be expected if the accuracy score < 80%).")
    return result.returncode

def check_dxf_score():
    """Evaluates the latest DXF and prints a clear breakdown of the metrics."""
    latest_dxf = get_latest_dxf()
    if not latest_dxf:
        print("Error: No accuracy DXF found in test-output. Run tests first.")
        sys.exit(1)
    
    reference_dxf = "examples/CNC_FILE_105_12MM.dxf"
    if not os.path.exists(reference_dxf):
        print(f"Error: Reference file {reference_dxf} not found.")
        sys.exit(1)

    print(f"Comparing generated DXF: {latest_dxf}")
    print(f"Against reference DXF: {reference_dxf}")
    
    cmd = [sys.executable, "tests/compare_dxf.py", latest_dxf, reference_dxf]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print("Error running compare_dxf.py:")
        print(result.stderr)
        sys.exit(1)

    try:
        metrics = json.loads(result.stdout)
    except json.JSONDecodeError:
        print("Failed to parse JSON output from compare_dxf.py:")
        print(result.stdout)
        sys.exit(1)

    print("\n" + "="*40)
    print("DXF ACCURACY METRICS")
    print("="*40)
    print(f"Overall Score:                {metrics.get('overall_score')}%")
    print(f"Shape Count Match:            {'[Yes]' if metrics.get('shape_count_match') else '[No]'} ({metrics.get('shape_count_generated')} vs {metrics.get('shape_count_reference')})")
    print(f"Ryb Count Match:              {'[Yes]' if metrics.get('ryb_count_match') else '[No]'} ({metrics.get('ryb_count_generated')} vs {metrics.get('ryb_count_reference')})")
    print(f"Slot Count Match:             {'[Yes]' if metrics.get('slot_count_match') else '[No]'} ({metrics.get('slot_count_generated')} vs {metrics.get('slot_count_reference')})")
    print(f"Sheet Count:                  {metrics.get('sheet_count_generated')} vs {metrics.get('sheet_count_reference')}")
    print(f"Has Backplane (Area >500k):   {'[Yes]' if metrics.get('has_backplane_generated') else '[No]'}")
    print(f"Slot Width Consistency:       {'[Yes]' if metrics.get('slot_width_consistency') else '[No]'}")
    print(f"Size Distribution Match:      {metrics.get('size_distribution_match')}%")
    
    print("\nAnalysis & Next Steps:")
    if metrics.get('overall_score', 0) >= 80:
        print("SUCCESS! Accuracy is >= 80%.")
    else:
        print("WARNING: Accuracy is below 80%. Consider fixing:")
        if not metrics.get('has_backplane_generated'):
            print("  - The backplane polygon area is less than 500,000mm^2.")
        if not metrics.get('slot_width_consistency'):
            print("  - Some slots have widths deviating from the 12mm material thickness.")
        if metrics.get('size_distribution_match', 0) < 50:
            print("  - Ryb sizes (area distribution) differ significantly from the reference. Is the wave height/ratio configured correctly?")
            
def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/para_ops.py [command]")
        print("Commands:")
        print("  test-dxf    Run the Playwright DXF tests and print the latest metrics score")
        print("  check-dxf   Print the score breakdown of the most recently generated DXF")
        print("  debug-dxf [file]  Print shapes and areas parsed from the specified DXF file")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "test-dxf":
        run_dxf_tests()
        check_dxf_score()
    elif cmd == "check-dxf":
        check_dxf_score()
    elif cmd == "debug-dxf":
        target = sys.argv[2] if len(sys.argv) > 2 else "examples/CNC_FILE_105_12MM.dxf"
        debug_dxf_shapes(target)
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)

if __name__ == '__main__':
    main()
