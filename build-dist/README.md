# build-dist

This action builds a package's sdist & wheel (using `python -m build`) and checks them with `twine`, creates a source bundle through `git export` and
makes all of that available as an artifact.

## Inputs

### `artifact`

The name of the artifact to create, `dist` by default.

## Usage

```yaml
build:
  name: 🔨 Build distribution
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - name: 🏗 Set up Python
      uses: actions/setup-python@v5
    - name: 🔨 Build dist
      uses: OctoPrint/actions/build-dist@main
```
