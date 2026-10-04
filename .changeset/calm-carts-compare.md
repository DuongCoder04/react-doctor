---
"react-doctor": patch
---

Fix false new findings in `--baseline` and `--scope changed` after formatting or editing existing flagged code. Compare finding counts per file and rule, then use fingerprints, messages, and Git line shifts to identify added findings. Apply current config filters to saved baseline findings before comparison.
