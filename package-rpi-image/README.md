# Package RPi image

Packages an RPi image as a zip, generates a .md5 and .sha256 files for image and zip and provides
various metadata as outputs.

## Inputs

### `image_path`

**Required** The path to the image.

## Outputs

### `image_name`

The name of the image file.

### `image_sha256`

The SHA256 hash of the image.

### `image_size`

The size of the image in bytes.

### `zip_name`

The name of the zip file.

### `zip_path`

The path to the zip file.

### `zip_sha256`

The SHA256 hash of the zip file.

### `zip_size`

The size of the zip file in bytes.

## Usage

```yaml
- name: "📦 Package the image"
    id: package-image
    uses: OctoPrint/actions/package-rpi-image@main
    with:
        image_path: "build/${{ env.IMAGE }}"
```
