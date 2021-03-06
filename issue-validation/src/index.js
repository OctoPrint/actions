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
    path: path
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
      //return isMemberOfTeam(client, user, check);
      return false;
    } else {
      return await isMemberOfOrg(client, user, check);
    }
  } else {
    core.debug("Checking user " + user + " against " + check);
    return user === check;
  }
}

async function isMemberOfOrg(client, user, org) {
  if (org.startsWith("@")) {
    org = org.slice(1);
  }
  core.debug("Checking membership of " + user + " in org " + org);

  let member;
  
  member = await client.orgs.checkPublicMembershipForUser({ 
    "org": org, 
    "username": user 
  })
  .catch(error => { member = error });
  
  return member && member.status && member.status === 204;
}

//async function isMemberOfTeam(client, user, team) {
//  if (!team.includes("/")) {
//    return false;
//  }
//  core.debug("Checking membership of user " + user + " in org team " + team);
//
//  if (team.startsWith("@")) {
//    team = team.slice(1);
//  }
//
//  let org;
//  [org, team] = team.split("/", 1);
//
//  const query = `query($cursor: String, $org: String!, $userLogins: [String!], $username: String!) {
//    user(login: $username) {
//      id
//    }
//    organization(login: $org) {
//      teams (first:1, userLogins: $userLogins, after: $cursor) {
//        nodes {
//          name
//        }
//        pageInfo {
//          hasNextPage
//          endCursor
//        }
//      }
//    }
//  }`
//
//  let data;
//  let teams = [];
//  let cursor = null;
//
//  try {
//    do {
//      data = await client.graphql(query, {
//        "cursor": cursor,
//        "org": org,
//        "userLogins": [user],
//        "username": user
//      });
//      
//      teams = teams.concat(data.organization.teams.nodes.map((val) => val.name.toLowerCase()));
//      cursor = data.organization.teams.pageInfo.endCursor;
//    } while (!teams.includes(team) && data.organization.teams.pageInfo.hasNextPage);
//  } catch (error) {
//    console.log(error);
//    core.setFailed(error.message);
//  }
//
//  return teams.includes(team);
//}

async function isIgnored(client, issue, labels, config) {
  const title = issue.title.toLowerCase();
  const author = issue.user.login.toLowerCase();

  const ignored_labels = (config.ignored_labels || []).map((val) => val.toLowerCase());
  const ignored_titles = (config.ignored_titles || []).map((val) => val.toLowerCase());
  const ignored_authors = (config.ignored_authors || []).map((val) => val.toLowerCase());

  if (ignored_labels.some((l) => labels.includes(l))) {
    core.debug("Issue is ignored due to labels: " + labels.join(",") + " vs " + ignored_labels.join(","));
    return true;
  } else if (ignored_titles.some((t) => title.includes(t))) {
    core.debug("Issue is ignored due to title: '" + title + "' vs " + ignored_titles.join(","));
    return true;
  } else {
    for (a of ignored_authors) {
      if (await matchesUser(client, author, a)) {
        core.debug("Issue is ignored due to author: '" + author + "' vs " + a);
        return true;
      }
    }
    return false;
  }
}

function checkIssue(issue, config) {
  const phrase = config.keyphrase;

  if (!phrase) {
    return true;
  }

  return issue.body.includes(phrase);
}

async function validate_issue(client, config, dryrun) {
  try {

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    const number = getIssueNumber();
    if (!number) {
      console.log("Could not get issue number from context, exiting");
      return;
    }

    // Get current issue data (the data in the context might be outdated)
    const { data: issue } = await client.issues.get({
      owner: owner,
      repo: repo,
      issue_number: number
    });

    let labels = issue.labels.map((val) => val.name.toLowerCase());
    if (await isIgnored(client, issue, labels, config)) {
      console.log("Issue is ignored by validation");
      return;
    }

    const problem_label = config.problem_label;
    const approve_label = config.approve_label;
    if (!checkIssue(issue, config)) {
      // something's missing here, label & comment accordingly
      core.debug("Issue didn't pass validation");

      if (problem_label && !labels.includes(problem_label)) {
        if (dryrun) {
          core.info("Would now mark issue as incomplete");
        } else {
          core.debug("Adding problem_label: " + problem_label);

          await client.issues.addLabels({
            owner: owner,
            repo: repo,
            issue_number: number,
            labels: [problem_label]
          });

          if (config.validation_comment) {
            core.debug("Adding comment");
  
            client.issues.createComment({
              owner: owner,
              repo: repo,
              issue_number: number,
              body: config.validation_comment.replace("@@AUTHOR@@", issue.user.login)
            });
          }
        }
      }

      core.info("This issue has not passed validation");
    } else {
      // mark as approved
      core.debug("Issue passed validation");

      if (dryrun) {
        core.info("Would now mark issue as approved");
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
            labels: labels
          });
        }
      }
    }
  
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

async function run() {
  try {
    const token = core.getInput("repo-token", { required: true });
    const configPath = core.getInput("configuration-path", { required: true });
    const dryrun = core.getInput("dry-run") || false;

    const client = github.getOctokit(token);

    const config = await readConfig(client, configPath);
    if (!config) {
      console.log("Could not get configuration from repository, exiting");
      return;
    }
    
    if (github.context.eventName === "issues") {
      validate_issue(client, config, dryrun);
    }
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
