import core from '@actions/core'
import os from 'os'
import { giteaApi } from 'gitea-js'

const gitea = giteaApi(process.env.GITEA_URL, {
  token: process.env.GITEA_TOKEN, // generate one at https://gitea.example.com/user/settings/applications
  customFetch: fetch,
});

// Get owner and repo from context of payload that triggered the action
const [ owner, repo ] = process.env.GITHUB_REPOSITORY.split('/')

export default class Tag {
  constructor (prefix, version) {
    this.prefix = prefix
    this.version = version
    this._tags = null
    this._exists = null
  }

  get name () {
    return `${this.prefix.trim()}${this.version.trim()}`
  }

  get message() {
    return (async () => {
      try {
        let tags = await this.getTags()
  
        if (tags.length === 0) {
          return `Version ${this.version}`
        }
  
        const changelog = await gitea.repos.repoCompareDiff(owner, repo, tags.shift().name + "..." + process.env.GITHUB_REF_NAME ?? 'main' )
  
        const tpl = (core.getInput('log_template', { required: false }) || '').trim()
  
        return changelog.data.commits
          .map(
            (commit, i) => {
              if (tpl.length > 0) {
                return tpl
                  .replace(/\{\{\s?(number)\s?\}\}/gi, i + 1)
                  .replace(/\{\{\s?(message)\s?\}\}/gi, commit.commit.message)
                  .replace(/\{\{\s?(author)\s?\}\}/gi, commit.hasOwnProperty('author') ? (commit.author.hasOwnProperty('login') ? commit.author.login : '') : '')
                  .replace(/\{\{\s?(sha)\s?\}\}/gi, commit.sha)
                  .trim() + '\n'
              } else {
                return `${i === 0 ? '\n' : ''}${i + 1}) ${commit.commit.message}${
                  commit.hasOwnProperty('author')
                    ? commit.author.hasOwnProperty('login')
                      ? ' (' + commit.author.login + ')'
                      : ''
                    : ''
                }\n(SHA: ${commit.sha})\n`
              }
            })
          .join('\n')
      } catch (e) {
        core.warning('Failed to generate changelog from commits: ' + e.message + os.EOL)
        return `Version ${this.version}`
      }
    })();
  }

  get prerelease () {
    return /([0-9\.]{5}(-[\w\.0-9]+)?)/i.test(this.version)
  }

  get previous () {
    return (async () => {
      try {
        const tags = await this.getTags()

        return tags.shift().name;
      } catch(e) {
        return "0.0.0";
      }
    })();
  }

  async getTags () {
    if (this._tags !== null) {
      return this._tags.data
    }

    this._tags = await gitea.repos.repoListTags(owner, repo)

    return this._tags.data
  }

  async exists () {
    if (this._exists !== null) {
      return this._exists
    }
    const currentTag = this.name
    const tags = await this.getTags()

    for (const tag of tags) {
      if (tag.name === currentTag) {
        this._exists = true
        return true
      }
    }

    this._exists = false
    return false
  }
}
