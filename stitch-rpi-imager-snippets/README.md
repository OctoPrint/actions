# Stitch rpi-imager snippets

Stitches rpi-imager snippets together into a single `rpi-imager.json` file.

## Inputs

### `output`

**Required** The name of the output file to write.

### `snippets`

**Required** Space separated list of snippets to stitch together.

## Usage

```yaml
- name: "🆕 Stitch rpi-imager.json together"
    uses: OctoPrint/actions/stitch-rpi-imager-snippets@main
    with:
        output: ./files/rpi-imager-latest.json
        snippets: /tmp/snippet1.json /tmp/snippet2.json
```
