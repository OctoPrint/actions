const core = require('@actions/core');
const github = require('@actions/github');
const yaml = require('js-yaml');

function getPrNumber() {
  const pr = github.context.payload.pull_request;
  if (!pr) {
    return undefined;
  }

  return pr.number;
}

async function fetchContent(client, path) {
  const response = await client.repos.getContents({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: path,
    ref: github.context.sha
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
}

async function readConfig(client, path) {
  const content = await fetchContent(client, path);
  console.log(content);

  const config = yaml.load(content);
  console.log(config);

  return config;
}

function checkPr(pr, allowed_targets, forbidden_sources) {
  const source = pr.head.ref;
  const target = pr.base.ref;
  console.log("PR source is " + source);
  console.log("PR target is " + target);

  let problems = [];

  if (pr.body.trim() === "") {
    problems.push("The PR does have an empty description. Please explain what "
                + "the PR does, how you've tested your changes, etc.");
    core.error("PR has an empty description");
  }

  if (forbidden_sources.includes(source)) {
    problems.push("The PR's source branch `" + source + "` is among the "
                + "forbidden source branches: " + blacklisted_sources.join(", ")
                + ". Please always create PRs from a custom branch in your "
                + "repository to avoid accidental commits making it into "
                + "your PR.");
    core.error("PR's source branch is among the forbidden source branches");
  }

  if (!allowed_targets.includes(target)) {
    problems.push("The PR's target branch `" + target + "` is not among the "
                + "allowed target branches: " + allowed_targets.join(", ")
                + ". Please only create PRs against these.");
    core.error("PR's target branch is not among the allowed target branches");
  }

  return problems;
}

async function run() {
  const token = core.getInput("repo-token", { required: true });
  const configPath = core.getInput("configuration-path", { required: true });

  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;

  const number = getPrNumber();
  if (!number) {
    console.log("Could not get pull request number from context, exiting");
    return;
  }

  const client = new github.GitHub(token);

  const config = await readConfig(client, configPath);
  if (!config) {
    console.log("Could not get configuration from repository, existing");
    return;
  }
  console.log(config);
  
  // Get current PR data (the data in the context might be outdated)
  const { data: pr } = await client.pulls.get({
    owner: owner,
    repo: repo,
    pull_number: number
  });

  const problem_label = config.problem_label;
  const approve_label = config.approve_label;
  let allowed_targets = config.allowed_targets;
  let forbidden_sources = config.forbidden_sources;

  console.log("Allowed targets: " + allowed_targets.join(", "));
  console.log("Forbidden sources: " + forbidden_sources.join(", "));

  let labels = [];
  pr.labels.forEach(label => { labels.push(label.name) });
  console.log("PR labels are " + labels.join(", "));

  if (config.labels) {
    for (const label in config.labels) {
      if (labels.includes(label)) {
        const c = config.labels[label];

        if (c.allowed_targets) {
          allowed_targets = c.allowed_targets;
        }
        if (c.forbidden_sources) {
          forbidden_sources = c.forbidden_sources;
        }
        if (c.additional_allowed_targets) {
          allowed_targets = allowed_targets.concat(c.additional_allowed_targets);
        }
        if (c.additional_forbidden_sources) {
          forbidden_sources = forbidden_sources.concat(c.additional_forbidden_sources);
        }
      }
    }
  }

  console.log("Allowed targets: " + allowed_targets.join(", "));
  console.log("Forbidden sources: " + forbidden_sources.join(", "));

  const problems = checkPr(config, pr, allowed_targets, forbidden_sources);

  if (problems.length) {
    // Problems were detected, post comment and label accordingly
    let comment = "**Automatic PR Validation failed**\n\n"
                + "There were one or more problems detected with this PR:\n\n";

    problems.forEach(problem => {
      comment += "  * " + problem + "\n";
    });

    comment += "\n\nPlease take a look at the "
              + "Contribution Guidelines of this repository "
              + "and make sure that the PR follows them. Thank you!\n\n"
              + "*I'm just a bot 🤖 that does automatic checks, a human will intervene if I've made a mistake.*";

    client.issues.createComment({
      owner: owner,
      repo: repo,
      issue_number: number,
      body: comment
    });

    if (problem_label && !labels.includes(problem_label)) {
      client.issues.addLabels({
        owner: owner,
        repo: repo,
        issue_number: number,
        labels: [problem_label]
      });
    }

    core.setFailed("This PR has not passed validation");
  } else {
    let setLabels = false;

    if (problem_label && labels.includes(problem_label)) {
      labels = labels.filter(label => label !== problem_label);
      setLabels = true;
    }
    if (approve_label && !labels.includes(approve_label)) {
      labels.push(approve_label);
      setLabels = true;
    }

    if (setLabels) {
      client.issues.setLabels({
        owner: owner,
        repo: repo,
        issue_number: number,
        label: labels
      });
    }
  }
}

run();
