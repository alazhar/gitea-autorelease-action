import * as core from '@actions/core'
import Tag from './lib/tag.js'
import Regex from './lib/regex.js'
import Release from './lib/release.js'

function getIsTrue(v) {
  const trueValue = ['true', 'True', 'TRUE']
  return trueValue.includes(v)
}

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
    
    core.info(`version ${ version } detectedss`)

    version = Tag.parseVersion(version)

    core.info(`version translated to ${ version }`)

    // Configure a tag using the identified version
    const tag = new Tag(
      core.getInput('tag_prefix', { required: false }),
      version
    )

    core.notice(`Recognized "${version}"`)
    core.setOutput('version', version)
    core.debug(`Detected version ${version}`)

    tag.sha = process.env.GITHUB_SHA

    if (!await tag.exists()) {
      await tag.push()
    }
    
    const release_name = core.getInput('release_name', { required: false })
    const draft = core.getInput('draft', { required: false })

    const release = new Release(
      release_name,
      tag.name,
      draft,
      tag.prerelease
    )
    release.body = await tag.message
    await release.createorupdate()

    const release_attachment = core.getInput('release_attachment', { required: false })
    const md5sum = getIsTrue(core.getInput("md5sum"))
    const sha256sum = getIsTrue(core.getInput("sha256sum"))
    await release.uploadAttachment(release_attachment, md5sum, sha256sum)

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