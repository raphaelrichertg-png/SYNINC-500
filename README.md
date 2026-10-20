# SYNINC-500

**SYN**thetic **INC**isor dataset — 500 synthetic maxillary central incisor surfaces generated with DeepSDF by interpolation between morphologically similar specimens in the latent space (t-SNE neighbour pairs).

Associated paper: *Synthetic Data: can we really differentiate AI Generated from original incisor scans?*

## Contents

```
SYNINC-500/
├── meshes/          500 surfaces (.obj)
├── docs/            GitHub Pages viewer (3D visualisation)
├── index.json       Optional manifest (id, source, t-SNE coordinates...)
└── README.md
```

## Visualisation

The dataset can be explored online via GitHub Pages:

> https://raphaelrichertg-png.github.io/SYNINC-500/

The viewer is a static page (three.js). It lists the meshes automatically from the `meshes/` folder (or from `index.json` if present). Features: rotation/zoom, opacity slider, wireframe mode, and side-by-side comparison of two surfaces.

## Adding the meshes

Place the 500 `.obj` files in the `meshes/` folder, one file per tooth:

```bash
git add meshes/*.obj
git commit -m "Add SYNINC-500 surfaces"
git push
```

GitHub blocks files larger than 100 MB. Individual incisor OBJ files are typically a few MB, so this should be fine. If the total exceeds ~1–2 GB, consider a Git LFS setup or a Zenodo mirror with DOI.

## Citation

A `CITATION.cff` file is provided. If you use SYNINC-500 in your research, please cite both the dataset and the original paper.

## License

Data: CC BY 4.0 — Code (viewer): MIT.
