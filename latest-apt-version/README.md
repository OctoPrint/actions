# Get latest apt version

This action gets the latest version of a package from apt. It requires the name of the package to check and the URL of the package list to check against.

## Inputs

### `package`

**Required** The package name.

### `url`

**Required** The URL of the package list.

## Outputs

### `version`

The latest version of the package.

## Usage

```yaml
- name: "Lookup libcamera0 version"
  id: libcamera0_version
  uses: OctoPrint/actions/latest-apt-version@main
  with:
    package: libcamera0
    url: http://archive.raspberrypi.org/debian/dists/bullseye/main/binary-armhf/Packages
```

## Local testing

```bash
export INPUT_PACKAGE=libcamera0
export INPUT_URL=http://archive.raspberrypi.org/debian/dists/bullseye/main/binary-armhf/Packages
node src/index.js
```

## Build

```bash
npm run build
```
