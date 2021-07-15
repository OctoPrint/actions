# PR Validation Action

This action performs some validation checks against incoming PRs.

It will check whether a non-empty description has been provided and
whether a set of allowed PR targets and forbidden PR sources is matched
which can optionally be modified based on labels already applied on
the PR through earlier steps.

## Inputs

### `repo-token`

**Required** The GitHub token to use, should usually be set to `secrets.GITHUB_TOKEN`

### `configuration-path`

The path to the yml configuration file that configures the validation. Defaults to `.github/pr-validation.yml`.

### `dry-run`

If set, no actual action will be performed, the action will perform a dry-run only.

## Usage

`.github/workflows/pr-validation.yml`:

```yaml
name: "PR validator"
on:
  pull_request_target:
    types: ["opened", "synchronize", "reopened", "edited", "labeled", "unlabeled"]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
    - uses: OctoPrint/actions/pr-validation@main
      with:
        repo-token: "${{ secrets.GITHUB_TOKEN }}"
```

`.github/pr-validation.yml`:

```yaml
approve_label: 'approved'
problem_label: 'needs some work'
ignore_label: 'skip validation'

forbidden_targets: ['master']
forbidden_sources: ['master', 'maintenance', 'devel']

labels:
  docs:
    forbidden_targets: []
  meta:
    forbidden_targets: []
  ci/cd:
    forbidden_targets: []
```
