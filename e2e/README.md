# E2E

This action takes care of checking out OctoPrint in the specified `ref`, installing it, starting it up with an
e2e test configuration and then running its Playwright based e2e test suite against it. 

If there are any errors detected in the test suite, or found in `octoprint.log` after running the test suite, 
the action will fail. The Playwright reports will be uploaded as artifacts, as will the log in case of logged 
errors. The artifacts will use a suffix if configured, to support matrix setups. 

To reduce runtime, the action takes care of caching Playwright's dependencies.

To support e2e testing of fresh OctoPrint builds, the OctoPrint package to install can also be changed from the 
checkout to a build.

To support e2e testing plugins, additional dependencies can also be installed along side OctoPrint before the
test suite is run.

To support e2e testing against already running servers, a server endpoint can also be provided, in which case
OctoPrint won't be installed and run.

## Inputs

### `ref`

The OctoPrint ref to checkout, install and run tests from. `master` if not set.

### `octoprint`

The OctoPrint package to install. `.` if not set, so the checkout defined by `ref`. Can also be a freshly built wheel, official pypi release or similar.

### `deps`

Additional reps to install via `pip` alongside OctoPrint, e.g. plugins.

### `python`

Python version to use. `3.12` if not set.

### `suffix`

Suffix to use for the generated artifacts.

### `server`

URL of existing server to test, instead of installing and running OctoPrint from the checkout.

## Usage

### Testing a fresh OctoPrint build against multiple Python versions

```yaml
  test-e2e:
    name: 🧪 E2E tests
    needs: build
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ["3.9", "3.10", "3.11", "3.12", "3.13"]
    steps:
      - name: ⬇ Download build result
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist

      - name: 🎭 Run E2E
        uses: OctoPrint/actions/e2e@main
        with:
          ref: ${{ github.ref }}
          octoprint: ${{ github.workspace }}/dist/*.whl
          python: ${{ matrix.python }}
          suffix: "-py${{ matrix.python }}"
```

### Testing various OctoPrint versions with a custom plugin installed

```yaml
  e2e:
    name: 🧪 E2E tests
    needs: build
    runs-on: ubuntu-latest
    strategy:
      matrix:
        octoprint: ["master", "maintenance"]
    steps:
      - name: ⬇ Download build result
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist

      - name: 🎭 Run OctoPrint's E2E Tests
        uses: OctoPrint/actions/e2e@main
        with:
          ref: ${{ matrix.octoprint }}
          deps: ${{ github.workspace }}/dist/*.whl
          suffix: "-${{ matrix.octoprint }}"
```

### Testing an already running OctoPrint

```yaml
  e2e:
    name: "🧪 E2E"
    runs-on: ubuntu-latest
    needs: deploy
    steps:

    - name: "🎭 Run E2E tests"
      uses: OctoPrint/actions/e2e@main
      with:
        server: http://octoprint.example.com
```
