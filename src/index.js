import * as core from '@actions/core'
import os from 'os'
import semver from 'semver'
import Tag from './lib/tag.js'
import Regex from './lib/regex.js'
import Release from './lib/release.js'

async function run () {
  try {
    // Identify the root directory to use for auto-identifying a tag version
    const filepath = core.getInput('filepath', { required: true })

    // Retrieve the Regex pattern
    const pattern = core.getInput('regex_pattern', { required: true })

    core.info(`filepath : ${ filepath }`)
    core.info(`regex_pattern : ${ pattern }`)

    // Extract the version number using the supplied Regex    
    let version = (new Regex(filepath, new RegExp(pattern, 'gim'))).version

    if (!version) {
      throw new Error(`No version identified extraction with the /${ pattern }/gim pattern.`)
    }
    
    core.info(`version ${ version } detected`)

    const [major, minor, patch, pre] = version.split(".")
    version = `${major}.${minor}.${patch}${pre ? (pre == 0 ? "" : "-beta." + pre) : ""}`

    core.info(`version translated to ${ version }`)

    // Configure a tag using the identified version
    const tag = new Tag(
      core.getInput('tag_prefix', { required: false }),
      version
    )

    // Get min
    const minVersion = await tag.previous
    
    core.info(`Previous version ${ minVersion }`)

    // Ensure that version and minVersion are valid SemVer strings
    const versionSemVer = semver.coerce(version, { includePrerelease: pre})
    const minVersionSemVer = semver.coerce(minVersion , { includePrerelease: pre})

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

    core.notice(`Recognized "${version}"`)
    core.setOutput('version', version)
    core.debug(` Detected version ${version}`)

    // Check for existance of tag and abort (short circuit) if it already exists.
    if (await tag.exists()) {
      core.warning(`"${tag.name}" tag already exists.` + os.EOL)
      core.setOutput('tagname', '')
      return
    }

    await tag.push()

    const release = new Release()
    await release.create()
    await release.uploadAttachment()

    // The tag setter will autocorrect the message if necessary.
    core.setOutput('changelog', await tag.message)
    core.setOutput('prerelease', tag.prerelease ? 'yes' : 'no')
    core.setOutput('tagname', tag.name)
  } catch (error) {
    core.setFailed(error.message + '\n' + error.stack)
    core.setOutput('tagname', '')
  }
}

run()