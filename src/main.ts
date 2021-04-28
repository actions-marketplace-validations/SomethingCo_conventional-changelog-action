import * as core from '@actions/core'
import * as github from '@actions/github'
import { DateTime } from 'luxon'
import parser from 'conventional-commits-parser'
import groupBy from 'lodash/groupBy'

const emojis: Record<string, string> = {
  feat: `:sparkles:`,
  fix: `:bug:`,
  docs: `:books:`,
  style: `:gem:`,
  refactor: `:hammer:`,
  perf: `:rocket:`,
  test: `:rotating_light:`,
  build: `:package:`,
  ci: `:construction_worker:`,
  chore: `:wrench:`
}

const titles: Record<string, string> = {
  feat: `Features`,
  fix: `Bug Fixes`,
  docs: `Docs`,
  style: `Styling`,
  refactor: `Refactor`,
  perf: `Performance`,
  test: `Tests`,
  build: `Build`,
  ci: `CI`,
  chore: `Chores`
}

function createChangelog(
  commits: parser.Commit<string | number | symbol>[]
): string {
  const grouped = groupBy(commits, commit => commit.type)

  return Object.keys(grouped)
    .map(type => {
      const title = titles[type] ?? 'Others'
      const emoji = emojis[type] ?? ':question:'
      const commitsList = grouped[type]
        .map(commit => `- ${commit.subject || commit.header}`)
        .join('\n')

      return `### ${emoji} ${title}:\n${commitsList}`
    })
    .join(`\n\n`)
}

async function run(): Promise<void> {
  try {
    const repoName = github.context.payload.repository?.name
    const tagName = github.context.payload.release?.tag_name
    const releaseId = github.context.payload.release?.id
    const owner = github.context.payload.repository?.owner.login

    const { GITHUB_TOKEN } = process.env

    if (!repoName || !tagName || !owner || !releaseId) {
      throw new Error('Only possible to run this action in a release event')
    }

    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN is required.')
    }

    const octokit = github.getOctokit(GITHUB_TOKEN)
    const allReleases = await octokit.request(
      `GET /repos/{owner}/{repo}/releases`,
      {
        owner,
        repo: repoName,
        per_page: 15
      }
    )

    if (allReleases.data.length < 2) {
      core.debug('First release. Not really possible to create a changelog.')
      return
    }

    const sortedReleases = allReleases.data.sort(
      (a, b) =>
        DateTime.fromISO(b.created_at).toMillis() -
        DateTime.fromISO(a.created_at).toMillis()
    )

    core.debug(`${sortedReleases[0].id}`)
    const tagNameToCompare = sortedReleases[1].tag_name

    const commitsResponse = await octokit.request(
      `GET /repos/{owner}/{repo}/compare/{base}...{head}`,
      {
        owner,
        repo: repoName,
        base: tagNameToCompare,
        head: tagName
      }
    )

    const mappedCommits = commitsResponse.data.commits.map(data =>
      parser.sync(data.commit.message)
    )

    const changelogBody = createChangelog(mappedCommits)
    await octokit.request(`PATCH /repos/{owner}/{repo}/releases/{release_id}`, {
      repo: repoName,
      owner,
      release_id: releaseId,
      body: changelogBody
    })

    core.setOutput('changelog', changelogBody)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
