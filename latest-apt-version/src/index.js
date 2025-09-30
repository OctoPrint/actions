const core = require("@actions/core");
const axios = require("axios");
const apt_parser = require("apt-parser");
const util = require("util");
const zlib = require("zlib");
const gunzip = util.promisify(zlib.gunzip);

async function run() {
  try {
    const package = core.getInput("package", { required: true });
    const url = core.getInput("url", { required: true });

    let { data } = await axios.get(url, { responseType: "arraybuffer" });
    if (url.endsWith(".gz")) {
      core.debug("Decompressing gzipped data");
      data = await gunzip(data);
    }
    const packages = new apt_parser.Packages(data.toString("utf8"), {
      skipValidation: true,
    });

    core.debug(`Found ${packages.length} packages`);

    const versions = [];
    for (const pkg of packages) {
      if (pkg.package == package) {
        core.debug(`Found ${package} version ${pkg.version}`);
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
