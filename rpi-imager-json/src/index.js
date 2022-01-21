const core = require('@actions/core');
const github = require('@actions/github');
const fs = require("fs");
const fetch = require("node-fetch");

async function fetchReleases(token, owner, repo, ignoreRegex) {
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
    for (const release of result.repository.releases.nodes) {
        if ((release.name && release.name.match(ignoreRegex)) || (release.description && release.description.match(ignoreRegex))) {
            // name or description includes ignore marker, we skip this release
            continue;
        }

        if (stable === null && prerelease === null && release.isPrerelease) {
            // newer prerelease than current stable, we take the latest
            prerelease = release;
            core.info(`Found prerelease: ${release.tag.name}`);
        } else if (stable === null && !release.isPrerelease) {
            // latest stable
            stable = release;
            core.info(`Found stable: ${release.tag.name}`);
        }
    }

    return { stable, prerelease };
}

function rename(release, name) {
    if (name !== null) {
        release.description = release.name;
        release.name = name;
    }
    return release;
}

async function generate(releases, nameStable, namePrerelease) {
    const { stable, prerelease } = releases;
    if (stable === null || stable.releaseAssets.nodes.length === 0) {
        return null;
    }

    const stableData = rename(await fetch(stable.releaseAssets.nodes[0].downloadUrl).then(r => r.json()), nameStable);
    
    const data = { 
        os_list : [
            stableData
        ] 
    };
    
    if (prerelease !== null && prerelease.releaseAssets.nodes.length > 0) {
        const prereleaseData = rename(await fetch(prerelease.releaseAssets.nodes[0].downloadUrl).then(r => r.json()), namePrerelease);
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

    const releases = await fetchReleases(token, owner, repo, ignoreRegex);
    const data = await generate(releases, nameStable, namePrerelease);
    if (data !== null) {
        await serialize(data, output);
    }
}

run();