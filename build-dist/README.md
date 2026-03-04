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
    - uses: actions/checkout@v6
      with:
        fetch-depth: 0
        persist-credentials: false
    - name: 🏗 Set up Python
      uses: actions/setup-python@v6
    - name: 🔨 Build dist
      uses: OctoPrint/actions/build-dist@main
```
