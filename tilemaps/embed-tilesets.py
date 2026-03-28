#!/usr/bin/env python3
"""
Embed external .tsx tileset references into Tiled JSON exports.
Run after exporting from Tiled:
    python3 tilemaps/embed-tilesets.py tilemaps/farm.json
    python3 tilemaps/embed-tilesets.py tilemaps/challenge-bg.json
"""
import json, xml.etree.ElementTree as ET, os, sys

def embed(json_path):
    with open(json_path) as f:
        data = json.load(f)

    base_dir = os.path.dirname(json_path)
    changed = 0
    new_tilesets = []
    for ts in data['tilesets']:
        if 'source' in ts:
            tsx_path = os.path.join(base_dir, ts['source'])
            if os.path.exists(tsx_path):
                tree = ET.parse(tsx_path)
                root = tree.getroot()
                img = root.find('image')
                embedded = {
                    'firstgid': ts['firstgid'],
                    'name': root.get('name'),
                    'tilewidth': int(root.get('tilewidth')),
                    'tileheight': int(root.get('tileheight')),
                    'tilecount': int(root.get('tilecount')),
                    'columns': int(root.get('columns')),
                    'margin': 0, 'spacing': 0,
                    'image': 'tilesets/' + os.path.basename(img.get('source')),
                    'imagewidth': int(img.get('width')),
                    'imageheight': int(img.get('height')),
                }
                new_tilesets.append(embedded)
                changed += 1
                print(f"  Embedded: {embedded['name']}")
            else:
                print(f"  MISSING: {tsx_path}")
                new_tilesets.append(ts)
        else:
            new_tilesets.append(ts)

    if changed:
        data['tilesets'] = new_tilesets
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=1)
        print(f"Done: embedded {changed} tilesets in {json_path}")
    else:
        print(f"No external tilesets found in {json_path}")

if __name__ == '__main__':
    for path in sys.argv[1:]:
        embed(path)
