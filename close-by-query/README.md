# Close issues by query Action

This action performs closes issues matching a search query and optionally
adds a comment.

Inspired by [lee-dohm/close-matching-issues](https://github.com/lee-dohm/close-matching-issues).

## Inputs

### `repo-token`

**Required** The GitHub token to use, should usually be set to `secrets.GITHUB_TOKEN`

### `query`

**Required** The query to run

### `comment`

A comment to post upon closing. No comment will be posted if left unset.

### `dry-run`

If set, no actual action will be performed, the action will perform a dry-run only.

## Usage

`.github/workflows/issue-cleanup.yml`:

```yaml
name: "Issue cleanup"
on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
    - id: date
      run: |
        echo "CUTOFF=`date --date='14 days ago' +'%Y-%m-%d'`" >> $GITHUB_OUTPUT
    - uses: OctoPrint/actions/close-by-query@main
      with:
        repo-token: "${{ secrets.GITHUB_TOKEN }}"
        query: 'is:issue is:open label:incomplete created:<${{ steps.date.outputs.CUTOFF }}'
        comment: >
          Since apparently some of the required information is still missing, this will be
          closed now, sorry. Feel free to request a reopen of this or create a new issue
          once you can provide **all** 
          [required information](https://github.com/OctoPrint/OctoPrint/blob/master/CONTRIBUTING.md#how-to-file-a-bug-report).
        

          This is nothing personal. Thank you for your collaboration.
```
