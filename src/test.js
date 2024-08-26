import Tag from './lib/tag.js'
import Regex from './lib/regex.js'
import * as core from '@actions/core'
import { giteaApi } from 'gitea-js'

const gitea = giteaApi(process.env.GITEA_URL, {
  token: process.env.GITEA_TOKEN, // generate one at https://gitea.example.com/user/settings/applications
  customFetch: fetch,
});

async function run () {
    // let r = undefined
    // try {
    //   r = await gitea.repos.repoGetReleaseByTag("alazhar","WindowsForm35","v0.21")
    //   console.log(r)
    // }
    // catch (error) {
    //   console.log(error)
    // }

    // if (r) {
    //   console.log("update release")
    // }
    // else {
    //   console.log("create release")
    // }

    let versionfile = 'sample-version'
    let pattern = core.getInput('regex_pattern', { required: false })
    let version = (new Regex(versionfile, new RegExp(pattern, 'gim'))).version

    //version = "0.17.0.3"

    if (!version) {
      throw new Error(`No version identified${msg}`)
    }

    let version2 = Tag.parseVersion(version)

    const [major, minor, patch, pre] = version.split(".")
    version = `${major}.${minor}.${patch}${pre ? (pre > 0 ? "-" + pre  : "") : ""}`
    version = `${major}.${minor}.${patch}${pre ? (pre > 0 ? "-pre." + pre : "") : ""}`
    version = `${major}.${minor}.${patch}${pre ? (pre > 0 ? (pre <= 10 ? "-alpha." : "-beta.") + pre % 10 : "") : ""}`
    
    const tag = new Tag(
      "",
      version,
      ""
    )

    const minVersion = await tag.previous

    //const a = semver.valid(version)
    const versionSemVer = semver.coerce(version, { includePrerelease: pre})
    const minVersionSemVer = semver.coerce(minVersion)
    
    if (!minVersionSemVer) {
      core.info(`Skipping min version check. ${minVersion} is not valid SemVer`)
    }

    if(!versionSemVer) {
      core.info(`Skipping min version check. ${version} is not valid SemVer`)
    }

    if (minVersionSemVer && versionSemVer && semver.lt(versionSemVer, minVersionSemVer)) {
      core.info(`Version "${version}" is lower than minimum "${minVersion}"`)
      return
    }

    if (await tag.exists()) {
      return
    }

    const message = await tag.getMessage()
    console.log(message)
    //await tag.push()
}

run()