# UCI public regression snapshots

This directory contains numeric CSV adaptations of three datasets distributed under CC BY 4.0. Full attribution, source and download URLs, transformations, row counts and SHA-256 checksums are in `manifest.json`.

- Wine Quality (red subset): Cortez et al. (2009), DOI 10.24432/C56S3T.
- Auto MPG: Quinlan (1993), DOI 10.24432/C5859H. Six records with missing horsepower are omitted; vehicle names are excluded.
- Concrete Compressive Strength: Yeh (1998), DOI 10.24432/C5PK67.

License: https://creativecommons.org/licenses/by/4.0/ . These are teaching datasets, not current production prediction services.

Regenerate with `python scripts/fetch_datasets.py` (`xlrd` is needed for the original concrete spreadsheet). Application runtime reads the checked-in CSV files and works without dataset downloads.

Evaluation groups identical feature rows before splitting. Duplicate feature groups cannot occur in both training and evaluation sets. Scaling and categorical encoding are fitted on training only. Dataset MSE/RMSE values have different units and should not be ranked across datasets.
