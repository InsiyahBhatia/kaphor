# Editorial asset pipeline

Everything illustrated in `assets/editorial/**` is cut from the sticker sheets in
`assets/_source/elements/` by ONE script: `extract_elements.py`.

    pip install pillow numpy scipy opencv-python-headless

    # rebuild everything listed in manifest.json (icons, figures, ribbons, botanicals, Indian pieces)
    python scripts/assets/extract_elements.py build
    # shrink for shipping (resize to <=1200px, 256-colour PNG when >300KB; use --max-kb 45 for icons)
    python scripts/assets/extract_elements.py fit assets/editorial
    python scripts/assets/extract_elements.py fit assets/editorial/icons --max-kb 45

Other sub-commands: `segment` (auto-cut a sparse sheet), `crop` (one box), `contact`
(labelled contact sheets for review), `audit` (size / alpha / edge-touch report), `icons`.

## How it works
Objects have inked outlines, the sheet background is a smooth blur. Background = whatever is
reachable from the border without crossing a strong Lab edge; enclosed smooth gaps matching the
extrapolated background colour are removed too. Alpha is shaved 1px, feathered and defringed;
fragments of neighbours touching the crop box are dropped. Sheets with a real alpha channel use it.

## manifest.json
Each item: `out` (path under assets/), `sheet` (file in assets/_source/elements), then either
`box` [x0,y0,x1,y1] (dense sheets; options `keep_frac`, `exclude` boxes, `close`, `bg_delta`, `flip`,
`max_side`) or `at` [x,y] + `auto` (nearest auto-segmented object, optional `merge`), or
`from_file` (already-clean cut-out under assets/_source). `kind: "icon"` centres it on a 256x256
transparent canvas. Output names must stay stable: src/components/editorial/EditorialAssets.ts requires them.

`assets/_source` holds originals (sheets, original style-guide, old crops) and is excluded via .easignore.
