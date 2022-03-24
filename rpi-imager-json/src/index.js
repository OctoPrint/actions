const core = require('@actions/core');
const github = require('@actions/github');
const fs = require("fs");
const fetch = require("node-fetch");
const semver = require("semver");

const PEP440_REGEX = /(?<epoch>\d!)?(?<release>\d+(\.\d+)*)(?<prerelease>(?<prerelease_id>a|b|rc)(?<prerelease_no>\d+))?(?<postrelease>\.post(?<postrelease_no>\d+))?(?<development>\.dev\d+)?(?<local>\+.*)?/

function getVersions(tag, versionRegex) {
    if (versionRegex === null) return [];

    const match = tag.match(versionRegex);
    if (match === null) return [];

    const versions = Object.keys(match.groups).sort().map(key => semver.parse(pep440ToSemver(match.groups[key])));
    if (versions.includes(null)) return [];

    return versions;
}

function isNewerThan(a, b) {
    if (a === null || b === null || a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (semver.gt(a[i], b[i])) return true;
    }
    return false;
}

function pep440ToSemver(version) {
    const match = version.match(PEP440_REGEX);
    if (match === null) return version;

    const groups = match.groups;

    let output = "";
    if (groups.epoch) {
        output += groups.epoch + ".";
    }
    output += groups.release;

    if (groups.prerelease) {
        output += "-" + groups.prerelease_id + "." + groups.prerelease_no;
    }
    if (groups.dev) {
        output += "-dev." + groups.dev_no;
    }
    return output;
}

async function fetchReleases(token, owner, repo, ignoreRegex, versionRegex) {
    const octokit = github.getOctokit(token);
    const query = `query {
        repository(owner:"${owner}", name:"${repo}") {
          releases(first:100, orderBy: {field:CREATED_AT, direction:DESC}) {
            nodes {
              name
              description
              tag {
                name
              }
              isPrerelease
              releaseAssets(first:1, name:"rpi-imager.json") {
                nodes {
                  downloadUrl
                }
              }
            }
          }
        }
      }`;
      
    const result = await octokit.graphql(query);

    let stable = null;
    let prerelease = null;
    let stableVersions = null;
    let versions = null;
    for (const release of result.repository.releases.nodes) {
        if ((release.name && release.name.match(ignoreRegex)) || (release.description && release.description.match(ignoreRegex))) {
            // name or description includes ignore marker, we skip this release
            continue;
        }

        versions = getVersions(release.tag.name, versionRegex);

        if (prerelease === null && release.isPrerelease && (stable === null || (stableVersions && isNewerThan(versions, stableVersions)))) {
            // newer prerelease than current stable, we take the latest
            prerelease = release;
            core.info(`Found prerelease: ${release.tag.name}, versions: ${versions}`);
        } else if (stable === null && !release.isPrerelease) {
            // latest stable
            stable = release;
            stableVersions = versions;
            core.info(`Found stable: ${release.tag.name}, versions: ${versions}`);
        }
    }

    return { stable, prerelease };
}

function adjust(release, name, initFormat) {
    if (name !== null) {
        release.description = release.name;
        release.name = name;
    }
    if (initFormat !== null) {
        release.init_format = initFormat;
    }
    return release;
}

async function generate(releases, nameStable, namePrerelease, initFormat) {
    const { stable, prerelease } = releases;
    if (stable === null || stable.releaseAssets.nodes.length === 0) {
        return null;
    }

    const stableData = adjust(await fetch(stable.releaseAssets.nodes[0].downloadUrl).then(r => r.json()), nameStable, initFormat);

    const data = { 
        os_list : [
            stableData
        ] 
    };
    
    if (prerelease !== null && prerelease.releaseAssets.nodes.length > 0) {
        const prereleaseData = adjust(await fetch(prerelease.releaseAssets.nodes[0].downloadUrl).then(r => r.json()), namePrerelease, initFormat);
        data.os_list.push(prereleaseData);
    }

    return data;
}

async function serialize(data, output) {
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(output, serialized);
    core.info(`Generated rpi-imager.json: ${serialized}`);
}

async function run() {
    const token = core.getInput("token", { required: true });
    const owner = core.getInput('owner', { required: true });
    const repo = core.getInput('repo', { required: true });
    const output = core.getInput('output', { required: true });
    const nameStable = core.getInput('nameStable') || null;
    const namePrerelease = core.getInput('namePrerelease') || null;
    const ignoreRegex = core.getInput('ignoreRegex') || null;
    const versionRegex = core.getInput('versionRegex') || null;
    const initFormat = core.getInput('initFormat') || null;

    const releases = await fetchReleases(token, owner, repo, ignoreRegex, versionRegex);
    const data = await generate(releases, nameStable, namePrerelease, initFormat);
    if (data !== null) {
        await serialize(data, output);
    }
}

run();