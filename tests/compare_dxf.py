"""
Compare a generated DXF against the reference CNC file.
Usage: python tests/compare_dxf.py <generated.dxf> <reference.dxf>

Outputs JSON metrics:
- shape_count_match: bool
- shape_count_generated / shape_count_reference
- bounding_box_overlap: 0-100%
- slot_count_match: bool
- slot_dimensions_accuracy: 0-100%
- overall_score: 0-100%
"""
import sys
import json
import ezdxf
from collections import defaultdict


def parse_shapes(filepath):
    """Parse a DXF and return shape descriptors."""
    doc = ezdxf.readfile(filepath)
    msp = doc.modelspace()
    
    shapes = []
    for e in msp:
        dtype = e.dxftype()
        if dtype not in ('POLYLINE', 'LWPOLYLINE', 'LINE', 'CIRCLE', 'ARC', 'ELLIPSE'):
            continue
        
        pts = []
        bulges = []
        
        if dtype == 'POLYLINE':
            for v in e.vertices:
                loc = v.dxf.location
                pts.append((loc.x, loc.y))
                b = v.dxf.bulge if hasattr(v.dxf, 'bulge') and v.dxf.bulge is not None else 0
                bulges.append(b)
        elif dtype == 'LWPOLYLINE':
            for row in e.get_points(format='xyseb'):
                pts.append((row[0], row[1]))
                bulges.append(row[4])
        elif dtype == 'LINE':
            pts.append((e.dxf.start.x, e.dxf.start.y))
            pts.append((e.dxf.end.x, e.dxf.end.y))
        elif dtype == 'CIRCLE':
            cx, cy = e.dxf.center.x, e.dxf.center.y
            r = e.dxf.radius
            pts = [(cx - r, cy - r), (cx + r, cy + r)]
        elif dtype == 'ARC':
            cx, cy = e.dxf.center.x, e.dxf.center.y
            r = e.dxf.radius
            pts = [(cx - r, cy - r), (cx + r, cy + r)]
            bulges = [1.0]
        elif dtype == 'ELLIPSE':
            cx, cy = e.dxf.center.x, e.dxf.center.y
            pts = [(cx, cy)]
        
        if not pts:
            continue
        
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        w = max(xs) - min(xs)
        h = max(ys) - min(ys)
        has_bulge = any(abs(b) > 0.001 for b in bulges)
        
        layer = e.dxf.layer if hasattr(e.dxf, 'layer') else '0'
        
        shapes.append({
            'type': dtype,
            'layer': layer,
            'width': round(w, 2),
            'height': round(h, 2),
            'min_x': round(min(xs), 2),
            'min_y': round(min(ys), 2),
            'max_x': round(max(xs), 2),
            'max_y': round(max(ys), 2),
            'cx': round((min(xs) + max(xs)) / 2, 2),
            'cy': round((min(ys) + max(ys)) / 2, 2),
            'has_bulge': has_bulge,
            'area': round(w * h, 1),
            'num_pts': len(pts),
        })
    
    return shapes


def classify_shapes(shapes):
    """Classify shapes into sheets, rybs, slots, and markers."""
    sheets = [s for s in shapes if s['width'] > 1000 and s['height'] > 2000]
    
    # Slots: narrow shapes (one dimension ~12mm) with bulge
    slots = [s for s in shapes 
             if (abs(s['width'] - 12) < 5 or abs(s['height'] - 12) < 5)
             and s['has_bulge']
             and s['area'] < 10000]
    
    # Ryb profiles: medium shapes not in sheets or slots
    slot_set = set(id(s) for s in slots)
    sheet_set = set(id(s) for s in sheets)
    rybs = [s for s in shapes 
            if id(s) not in slot_set 
            and id(s) not in sheet_set
            and s['area'] > 100  # minimum area
            and s['width'] > 20 and s['height'] > 20]
    
    return {
        'sheets': sheets,
        'rybs': rybs,
        'slots': slots,
        'total': len(shapes),
    }


def compute_bounding_box_overlap(shapes_a, shapes_b):
    """Compute how well the bounding boxes of two shape sets overlap."""
    if not shapes_a or not shapes_b:
        return 0.0
    
    # Overall bounding box
    all_a_min_x = min(s['min_x'] for s in shapes_a)
    all_a_max_x = max(s['max_x'] for s in shapes_a)
    all_a_min_y = min(s['min_y'] for s in shapes_a)
    all_a_max_y = max(s['max_y'] for s in shapes_a)
    
    all_b_min_x = min(s['min_x'] for s in shapes_b)
    all_b_max_x = max(s['max_x'] for s in shapes_b)
    all_b_min_y = min(s['min_y'] for s in shapes_b)
    all_b_max_y = max(s['max_y'] for s in shapes_b)
    
    # Overlap rectangle
    ox1 = max(all_a_min_x, all_b_min_x)
    ox2 = min(all_a_max_x, all_b_max_x)
    oy1 = max(all_a_min_y, all_b_min_y)
    oy2 = min(all_a_max_y, all_b_max_y)
    
    if ox2 <= ox1 or oy2 <= oy1:
        return 0.0
    
    overlap = (ox2 - ox1) * (oy2 - oy1)
    area_a = (all_a_max_x - all_a_min_x) * (all_a_max_y - all_a_min_y)
    area_b = (all_b_max_x - all_b_min_x) * (all_b_max_y - all_b_min_y)
    union = area_a + area_b - overlap
    
    return round(overlap / max(union, 1) * 100, 1)


def compare_dxfs(generated_path, reference_path):
    """Compare two DXF files and return accuracy metrics."""
    gen_shapes = parse_shapes(generated_path)
    ref_shapes = parse_shapes(reference_path)
    
    gen_classified = classify_shapes(gen_shapes)
    ref_classified = classify_shapes(ref_shapes)
    
    metrics = {
        'generated_path': generated_path,
        'reference_path': reference_path,
        'shape_count_generated': gen_classified['total'],
        'shape_count_reference': ref_classified['total'],
        'shape_count_match': gen_classified['total'] == ref_classified['total'],
        
        'ryb_count_generated': len(gen_classified['rybs']),
        'ryb_count_reference': len(ref_classified['rybs']),
        'ryb_count_match': len(gen_classified['rybs']) == len(ref_classified['rybs']),
        
        'slot_count_generated': len(gen_classified['slots']),
        'slot_count_reference': len(ref_classified['slots']),
        'slot_count_match': len(gen_classified['slots']) == len(ref_classified['slots']),
        
        'sheet_count_generated': len(gen_classified['sheets']),
        'sheet_count_reference': len(ref_classified['sheets']),
        
        'has_backplane_generated': any(s['area'] > 500000 for s in gen_classified['rybs']),
        'has_backplane_reference': any(s['area'] > 500000 for s in ref_classified['rybs']),
        
        'bounding_box_overlap_rybs': compute_bounding_box_overlap(
            gen_classified['rybs'], ref_classified['rybs']),
        'bounding_box_overlap_slots': compute_bounding_box_overlap(
            gen_classified['slots'], ref_classified['slots']),
    }
    
    # Size distribution similarity
    gen_sizes = sorted([round(s['area'], -2) for s in gen_classified['rybs']])
    ref_sizes = sorted([round(s['area'], -2) for s in ref_classified['rybs']])
    
    if gen_sizes and ref_sizes:
        # Compare size distributions (how many unique sizes match)
        gen_set = set(gen_sizes)
        ref_set = set(ref_sizes)
        common = len(gen_set & ref_set)
        total = len(gen_set | ref_set)
        metrics['size_distribution_match'] = round(common / max(total, 1) * 100, 1)
    else:
        metrics['size_distribution_match'] = 0.0
    
    # Slot dimension accuracy
    if gen_classified['slots'] and ref_classified['slots']:
        gen_slot_ws = sorted([s['width'] for s in gen_classified['slots']])
        ref_slot_ws = sorted([s['width'] for s in ref_classified['slots']])
        # Check if slot widths are consistent (should all be ~12mm)
        gen_consistent = all(abs(w - 12) < 3 for w in gen_slot_ws)
        ref_consistent = all(abs(w - 12) < 3 for w in ref_slot_ws)
        metrics['slot_width_consistency'] = gen_consistent and ref_consistent
    else:
        metrics['slot_width_consistency'] = False
    
    # Overall score (weighted combination)
    has_slots = 20 if metrics['slot_count_generated'] > 0 else 0
    has_rybs = 20 if metrics['ryb_count_generated'] > 0 else 0
    has_backplane = 15 if metrics['has_backplane_generated'] else 0
    ryb_count_score = min(15, 15 * min(metrics['ryb_count_generated'], metrics['ryb_count_reference']) / max(metrics['ryb_count_reference'], 1))
    slot_score = min(15, 15 * min(metrics['slot_count_generated'], metrics['slot_count_reference']) / max(metrics['slot_count_reference'], 1))
    size_score = metrics['size_distribution_match'] * 0.15
    
    metrics['overall_score'] = round(has_slots + has_rybs + has_backplane + ryb_count_score + slot_score + size_score, 1)
    
    return metrics


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python compare_dxf.py <generated.dxf> <reference.dxf>")
        sys.exit(1)
    
    result = compare_dxfs(sys.argv[1], sys.argv[2])
    print(json.dumps(result, indent=2))
