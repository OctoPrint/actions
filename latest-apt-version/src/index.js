const core = require('@actions/core');
const axios = require('axios');
const apt_parser = require('apt-parser');

async function run() {
  try {
    const package = core.getInput("package", { required: true });
    const url = core.getInput("url", { required: true });

    const { data } = await axios.get(url);
    const packages = new apt_parser.Packages(data);

    core.debug(`Found ${packages.length} packages`);

    const versions = [];
    for (const pkg of packages) {
        if (pkg.package == package) {
            core.debug(`Found version ${pkg.version}`);
            versions.push(pkg.version);
        }
    }

    if (versions.length > 0) {
        versions.sort();
        core.setOutput("version", versions[versions.length - 1]);
    } else {
        core.setFailed(`Could not find package ${package} in ${url}`);
    }
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
