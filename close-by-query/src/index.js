const core = require('@actions/core');
const github = require('@actions/github');

async function search(client, query, per_page) {
  per_page = per_page || 100;

  let page = 1;
  let issues = [];
  let result;

  core.info("Running query: " + query);

  try {
    do {
      result = await client.search.issuesAndPullRequests({
        "q": query,
        "sort": "created",
        "order": "asc",
        "per_page": per_page,
        "page": page
      });

      issues = issues.concat(result.data.items);
      page += 1;
    } while (result.data.incomplete_results);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }

  return issues;
}

async function cleanup_issues(client, query, comment, dryrun) {
  try {

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    const q = `repo:${owner}/${repo} ` + query;

    const issues = await search(client, q);

    core.info("Found " + issues.length + " issues to close");

    for (const issue of issues) {
      const number = issue.number;

      if (dryrun) {
        core.info("Would close issue #" + number);
        continue;
      }

      if (comment) {
        await client.issues.createComment({
          owner: owner,
          repo: repo,
          issue_number: number,
          body: comment
        })
      }

      await client.issues.update({
        owner: owner,
        repo: repo,
        issue_number: number,
        state: "closed"
      });

      core.info("Closed #" + number);
    };

  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

async function run() {
  try {
    const token = core.getInput("repo-token", { required: true });
    const query = core.getInput("query", { required: true });
    const comment = core.getInput("comment");
    const dryrun = core.getInput("dry-run") || false;

    const client = github.getOctokit(token);

    cleanup_issues(client, query, comment, dryrun);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
