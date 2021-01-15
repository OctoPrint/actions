# Issue Validation Action

This action performs some validation checks against incoming issues.

Currently only the presence of a configured `keyphrase` in the issue's OP is checked.

Issues can be excluded from validation through present labels, snippets in their
title or author (exact match or public organization membership). Ignore matching
is not case sensitive.

## Inputs

### `repo-token`

**Required** The GitHub token to use, should usually be set to `secrets.GITHUB_TOKEN`

### `configuration-path`

The path to the yml configuration file.

### `dry-run`

If set, no actual action will be performed, the action will perform a dry-run only.

## Usage

`.github/workflows/issue-validation.yml`:

```yaml
name: "Issue validator"
on:
  issues:
    types: ["opened", "edited"]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
    - uses: OctoPrint/actions/issue-validation@main
      with:
        repo-token: "${{ secrets.GITHUB_TOKEN }}"
```

`.github/issue-validation.yml`:

```yaml
approve_label: approved
problem_label: incomplete
ignored_labels: 
  - bug
  - request
  - improvement
  - brainstorming
  - task
  - rc feedback
  - awaiting information
  - not octoprint
  - approved
  - done
ignored_titles:
  - '[Request]'
  - '[Brainstorming]'
  - '[RC Feedback]'
  - 'Feature Request'
ignored_authors:
  - @octoprint
  - sentry-io
  - FormerLurker
  - bzed

validation_comment: >
  Hi @@@AUTHOR@@, 


  it looks like there is some **information missing** from your bug report that will
  be needed in order to solve the problem. Read the [Contribution Guidelines](https://github.com/OctoPrint/OctoPrint/blob/master/CONTRIBUTING.md)
  which will provide you with a template to fill out here so that your bug report
  is ready to be investigated (I promise I'll go away then too!).


  If you did not intend to report a bug but wanted to **request a feature or brain
  storm** about some kind of development, please take special note of the title format
  to use as described in the [Contribution Guidelines](https://github.com/OctoPrint/OctoPrint/blob/master/CONTRIBUTING.md).


  **Please do not abuse the bug tracker as a support forum** - that can be found at
  [community.octoprint.org](https://community.octoprint.org). Go there for any kind
  of issues with network connectivity, webcam functionality, printer detection or
  any other kind of such support requests or general questions.


  Also **make sure you are at the right place** - this is the bug tracker of the official
  version of OctoPrint, not the Raspberry Pi image OctoPi nor any unbundled third
  party OctoPrint plugins or unofficial versions. Make sure too that you have **read
  through the [Frequently Asked Questions](http://faq.octoprint.org)** and searched
  the [**existing tickets**](https://github.com/OctoPrint/OctoPrint/search?q=&ref=cmdform&type=Issues)
  for your problem - try multiple search terms please.


  I'm marking this one now as needing some more information. Please understand that
  if you do not provide that information within the next two weeks
  I'll close this ticket so it doesn't clutter the bug tracker. This is nothing
  personal, it's needed to keep this project manageable. Please just be considerate 
  and help the maintainers solve this problem
  quickly by following the guidelines linked above. Remember, the less time the devs
  have to spend running after information on tickets, the more time they have to actually
  solve problems and add awesome new features. Thank you!


  *I'm just a bot 🤖, not a human being, so don't expect any replies
  from me :) Your ticket is read by humans too, I'm just not one of them.*
```
