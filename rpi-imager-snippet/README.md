# Generate rpi-imager.json snippet

Generates an rpi-imager.json snippet based on given checksums, sizes and metadata.

Supposed to be used in tandem with [OctoPrint/actions/package-rpi-image](https://github.com/OctoPrint/actions/tree/main/package-rpi-image#readme).

## Inputs

### `name`

**Required** The name of the distribution.

### `description`

**Required** The description of the distribution.

### `icon`

**Required** The icon of the distribution.

### `url`

**Required** The download URL for the image zip.

### `output`

**Required** The path to the rpi-imager.json file.

### `image_sha256`

**Required** The SHA256 hash of the image.

### `image_size`

**Required** The size of the image in bytes.

### `zip_sha256`

**Required** The SHA256 hash of the zip file.

### `zip_size`

**Required** The size of the zip file in bytes.

### `devices`

**Optional** The devices the image is compatible with. Needs to be a comma separated list with device identifiers as found [here](https://downloads.raspberrypi.org/os_list_imagingutility_v3.json). If not provided, the `devices` field will be omitted from the generated snippet.

### `init_format`

**Optional** The init format of the image, defaults to systemd.

## Usage

```yaml
- name: "🆕 Generate rpi-imager.json snippet"
    uses: OctoPrint/actions/rpi-imager-snippet@main
    with:
        name: "${{ env.RELEASE_NAME }}"
        description: "A Raspberry Pi distribution for 3d printers. Ships OctoPrint ${{ env.OCTOPRINT_VERSION }} out-of-the-box."
        icon: "https://octopi.octoprint.org/rpi-imager.png"
        url: "https://github.com/OctoPrint/OctoPi-UpToDate/releases/download/${{ env.RELEASE_TAG }}/${{ steps.package-image.outputs.zip }}"
        output: "build/rpi-imager.json"
        image_sha256: ${{ steps.package-image.outputs.image_sha256 }}
        image_size: ${{ steps.package-image.outputs.image_size }}
        zip_sha256: ${{ steps.package-image.outputs.zip_sha256 }}
        zip_size: ${{ steps.package-image.outputs.zip_size }}
        devices: "pi4-32bit,pi3-32bit,pi2-32bit,pi1-32bit"
```
