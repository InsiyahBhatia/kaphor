"""Typography audit / snapper for the Kaphor app.

Usage (from kaphor-frontend):
  python scripts/audit-typography.py          # report off-scale font sizes
  python scripts/audit-typography.py --fix    # snap them to the nearest scale step

Scale (keep in sync with `fontSizes` in src/theme/index.ts):
  10 11 12 13 14 15 16 18 20 22 24 28 32
"""
import glob, re, sys

SCALE = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32]
fix = '--fix' in sys.argv


def snap(v):
    return min(SCALE, key=lambda s: (abs(s - v), s))


bad = 0
for f in glob.glob('app/**/*.tsx', recursive=True) + glob.glob('src/**/*.tsx', recursive=True):
    s = open(f, encoding='utf8', newline='').read()
    def sub(m):
        global bad
        v = float(m.group(1))
        if v in SCALE:
            return m.group(0)
        bad += 1
        print(f'{f}: fontSize {m.group(1)} -> {snap(v)}')
        return 'fontSize: ' + str(snap(v)) if fix else m.group(0)
    n = re.sub(r'fontSize: *([\d.]+)', sub, s)
    if fix and n != s:
        open(f, 'w', encoding='utf8', newline='').write(n)
print(f'{bad} off-scale sizes' + (' fixed' if fix else ''))
