# Fetch rpi-imager snippet

Fetches an rpi-imager.json from the latest GitHub release matching parameters provided in the action inputs.

Supposed to be used in tandem with [OctoPrint/actions/package-rpi-image](https://github.com/OctoPrint/actions/tree/main/package-rpi-image#readme).

## Inputs

### `token`

**Required** The GitHub token to use, should usually be set to `secrets.GITHUB_TOKEN`.

### `owner`

**Required** The owner of the repository to monitor.

### `repo`

**Required** The name of the repository to monitor.

### `output`

**Required** The name of the output file to write the snippet to.

### `includePrereleases`

If set to `true`, prereleases will also be considered for the latest release.

### `matchRegex`

If set and doesn't match either a release's name or description, the release will be ignored.

### `ignoreRegex`

If set and matches either a release's name or description, the release will be ignored.

## Usage

```yaml
- name: "🆕 Fetch rpi-imager.json snippet"
    uses: OctoPrint/actions/fetch-rpi-imager-snippet@main
    with:
        token: "${{ secrets.GITHUB_TOKEN }}"
        owner: OctoPrint
        repo: OctoPi-UpToDate
        ignoreRegex: "rc|branch|mark:ignored|mark:untested"
        output: ./files/rpi-imager-latest.json
```
