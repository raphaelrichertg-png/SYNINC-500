# SYNINC-500

**SYN**thetic **INC**isor dataset — a collection of 500 synthetic maxillary central incisor surfaces.

The shapes are generated with DeepSDF latent interpolation: a DeepSDF model trained on natural incisor scans is used to interpolate between pairs of morphologically similar specimens (t-SNE nearest neighbours), producing new anatomically plausible tooth surfaces.

## Contents

- `meshes/` — the 500 surfaces (`.ply`)
- `docs/` — online 3D viewer (GitHub Pages)

## Visualisation

> https://raphaelrichertg-png.github.io/SYNINC-500/

Static three.js viewer: browse the surfaces, rotate/zoom, adjust opacity and wireframe, compare two surfaces side by side.

## Citation

See `CITATION.cff`.

## License

Data: CC BY 4.0 — Code (viewer): MIT.
