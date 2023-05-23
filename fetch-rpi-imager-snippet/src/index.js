const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");
const fetch = require("node-fetch");

async function fetchLatestMatchingRelease(
  token,
  owner,
  repo,
  includePrereleases,
  matchRegex,
  ignoreRegex
) {
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

  for (const release of result.repository.releases.nodes) {
    if (includePrereleases === false && release.isPrerelease) {
      // we skip prereleases
      continue;
    }

    if (
      matchRegex &&
      ((release.name && !release.name.match(matchRegex)) ||
        (release.description && !release.description.match(matchRegex)))
    ) {
      // match regex set and neither name nor description match, we skip this release
      continue;
    }

    if (
      ignoreRegex &&
      ((release.name && release.name.match(ignoreRegex)) ||
        (release.description && release.description.match(ignoreRegex)))
    ) {
      // ignore regex set and either name or description match, we skip this release
      continue;
    }

    if (release.releaseAssets.nodes.length === 0) {
      // no rpi-imager.json, we skip this release
      continue;
    }

    return release;
  }

  return null;
}

async function downloadAs(url, output) {
  const data = await fetch(url).then((r) => r.json());
  fs.writeFileSync(output, JSON.stringify(data, null, 2));
}

async function run() {
  const token = core.getInput("token", { required: true });
  const owner = core.getInput("owner", { required: true });
  const repo = core.getInput("repo", { required: true });
  const output = core.getInput("output", { required: true });
  const includePrereleases =
    core.getBooleanInput("includePrereleases") || false;
  const matchRegex = core.getInput("matchRegex") || null;
  const ignoreRegex = core.getInput("ignoreRegex") || null;

  const release = await fetchLatestMatchingRelease(
    token,
    owner,
    repo,
    includePrereleases,
    matchRegex,
    ignoreRegex
  );

  if (release === null) {
    core.error("No matching release found");
    return;
  }

  core.info(`Found release ${release.tag.name}`);
  core.info(
    `Downloading rpi-imager.json from ${release.tag.name} to ${output}`
  );
  await downloadAs(release.releaseAssets.nodes[0].downloadUrl, output);
}

run();
