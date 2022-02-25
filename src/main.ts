import * as core from '@actions/core'
import * as github from '@actions/github'
import { DateTime } from 'luxon'
import parser from 'conventional-commits-parser'
import groupBy from 'lodash/groupBy'
import capitalize from 'lodash/capitalize'

interface TypeMap {
  emoji: string
  title: string
  order: number
}

const types: Record<string, TypeMap> = {
  feat: {
    emoji: `:sparkles:`,
    title: 'Features',
    order: 0
  },
  fix: {
    emoji: `:bug:`,
    title: 'Bug Fixes',
    order: 1
  },
  docs: {
    emoji: `:books:`,
    title: 'Docs',
    order: 3
  },
  style: {
    emoji: `:gem:`,
    title: 'Styling',
    order: 2
  },
  refactor: {
    emoji: `:hammer:`,
    title: 'Refactor',
    order: 10
  },
  perf: {
    emoji: `:rocket:`,
    title: 'Performance Improvements',
    order: 10
  },
  test: {
    emoji: `:rotating_light:`,
    title: 'Tests',
    order: 10
  },
  build: {
    emoji: `:package:`,
    title: 'Build',
    order: 10
  },
  ci: {
    emoji: `:construction_worker:`,
    title: 'CI',
    order: 10
  },
  chore: {
    emoji: `:wrench:`,
    title: 'Chores',
    order: 10
  },
  unknown: {
    emoji: ':question:',
    title: 'Others',
    order: 10
  }
}

function createChangelog(
  commits: parser.Commit<string | number | symbol>[]
): string {
  const grouped = groupBy(commits, commit => commit.type)

  return Object.keys(grouped)
    .sort((a, b) => {
      return (
        (types[a ?? 'unknown']?.order ?? 10) -
        (types[b ?? 'unknown']?.order ?? 10)
      )
    })
    .map(type => {
      const map = types[type ?? 'unknown'] ?? types.unknown
      const commitsList = grouped[type]
        .map(commit => {
          const message = capitalize(commit.subject || commit.header || '')
            .replace('[ci skip]', '')
            .trim()
          return `- ${message}`
        })
        .join('\n')

      return `### ${map.emoji} ${map.title}:\n${commitsList}`
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
    core.setFailed((error as Error).message)
  }
}

run()
