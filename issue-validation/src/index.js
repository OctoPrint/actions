const core = require('@actions/core');
const github = require('@actions/github');
const yaml = require('js-yaml');

function getIssueNumber() {
  const issue = github.context.payload.issue;
  if (!issue) {
    return undefined;
  }

  return issue.number;
}

async function fetchContent(client, path) {
  const response = await client.repos.getContent({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: path,
    ref: github.context.sha
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
}

async function readConfig(client, path) {
  const content = await fetchContent(client, path);

  const config = yaml.load(content);

  return config;
}

async function matchesUser(client, user, check) {
  if (check.startsWith("@")) {
    if (check.includes("/")) {
      return await isMemberOfTeam(client, user, check);
    } else {
      return await isMemberOfOrg(client, user, check);
    }
  } else {
    return user === check;
  }
}

async function isMemberOfOrg(client, user, org) {
  if (org.startsWith("@")) {
    org = org.slice(1);
  }

  let member = await client.orgs.checkPublicMembershipForUser({ org, user });
  console.log("is member? " + member);
  return member;
}

async function isMemberOfTeam(client, user, team) {
  if (!team.includes("/")) {
    return false;
  }
  if (team.startsWith("@")) {
    team = team.slice(1);
  }

  let org;
  [org, team] = team.split("/", 1);

  const query = `query($cursor: String, $org: String!, $userLogins: [String!], $username: String!) {
    user(login: $username) {
      id
    }
    organization(login: $org) {
      teams (first:1, userLogins: $userLogins, after: $cursor) {
        nodes {
          name
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }`

  let data;
  let teams = [];
  let cursor = null;

  try {
    do {
      data = await client.graphql(query, {
        "cursor": cursor,
        "org": org,
        "userLogins": [user],
        "username": user
      });
      
      teams = teams.concat(data.organization.teams.nodes.map((val) => val.name));
      cursor = data.organization.teams.pageInfo.endCursor;
    } while (!teams.includes(team) && data.organization.teams.pageInfo.hasNextPage);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }

  return teams.includes(team);
}

function isIgnored(client, issue, config) {
  const labels = issue.labels.map((val) => val.name);
  const title = issue.title;
  const author = issue.user.login;

  const ignored_labels = config.ignored_labels || [];
  const ignored_titles = config.ignored_titles || [];
  const ignored_authors = config.ignored_authors || [];

  return ignored_labels.some((l) => labels.includes(l))
      || ignored_titles.some((t) => title.includes(t))
      || ignored_authors.some((a) => matchesUser(client, author, a));
}

function checkIssue(issue, config) {
  const phrase = config.keyphrase;

  if (!phrase) {
    return true;
  }

  return issue.body.includes(phrase);
}

async function run() {
  try {

    const token = core.getInput("repo-token", { required: true });
    const configPath = core.getInput("configuration-path", { required: true });

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    const number = getIssueNumber();
    if (!number) {
      console.log("Could not get issue number from context, exiting");
      return;
    }

    const client = new github.getOctokit(token);

    const config = await readConfig(client, configPath);
    if (!config) {
      console.log("Could not get configuration from repository, existing");
      return;
    }
    
    // Get current issue data (the data in the context might be outdated)
    const { data: issue } = await client.issues.get({
      owner: owner,
      repo: repo,
      issue_number: number
    });

    if (isIgnored(client, issue, config)) {
      console.log("Issue is ignored by validation");
      return;
    }

    if (!checkIssue(issue)) {
      // something's missing here, label & comment accordingly
      if (config.problem_label) {
        client.issues.addLabels({
          owner: owner,
          repo: repo,
          issue_number: number,
          labels: [config.problem_label]
        });
      }

      if (config.text_reminder) {
        client.issues.createComment({
          owner: owner,
          repo: repo,
          issue_number: number,
          body: config.text_reminder.replace("@@AUTHOR@@", issue.user.login)
        });
      }
    
      core.setFailed("This issue has not passed validation");
    } else {
      // mark as approved
      if (config.problem_label) {
        client.issues.removeLabel({
          owner: owner,
          repo: repo,
          issue_number: number,
          label: config.problem_label
        });
      }
    }
  
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
