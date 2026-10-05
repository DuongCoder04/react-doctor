---
"react-doctor": patch
---

Fix false new findings in `--baseline` and `--scope changed` after formatting or editing existing flagged code. Compare finding counts per file and rule, then use fingerprints, messages, and Git line shifts to identify added findings. Skip location matching when counts do not increase. Apply portable config filters to saved baseline findings and reject reports with missing or incompatible source-dependent filter settings; regenerate those base reports with the current version and settings.
