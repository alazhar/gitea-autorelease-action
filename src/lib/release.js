import fs from "fs";
import path from 'path';
import { Blob } from "buffer";
import * as glob from "glob";
import { giteaApi } from 'gitea-js'
import CryptoJS from 'crypto-js';

const gitea = giteaApi(process.env.GITEA_URL, {
  token: process.env.GITEA_TOKEN, // generate one at https://gitea.example.com/user/settings/applications
  customFetch: fetch,
});

const [ owner, repo ] = process.env.GITHUB_REPOSITORY.split('/')

function paths(patterns) {
  return patterns.reduce((acc, pattern) => {
    return acc.concat(
      glob.sync(pattern).filter((path) => fs.statSync(path).isFile())
    );
  }, []);
};

export default class Release {
    constructor (name, tagname, draft, prerelease) {
      this._id = null
      this._name = name
      this._body = ''
      this._isdraft = draft
      this._isprerelease = prerelease
      this._tagname = tagname
      this._target_commitish = ''
      this._attachament = null
      this._sha = false
    }

    set body (value) {
      this._body = value
    }

    set isprerelease (value) {
      this._isprerelease = value
    }

    set isdraft (value) {
      this._isdraft = value
    }
    
    async createorupdate(){
      let release = undefined
      try {
        release = await gitea.repos.repoGetReleaseByTag(owner, repo, 'tag')
      } catch (error) {
        if (!(error instanceof gitea.ApiError) || error.status !== 404) {
          throw error
        }
      }

      if (release) {
        const release_id = release.id;
        let target_commitish = release.target_commitish;
        if (body.target_commitish && body.target_commitish !== release.target_commitish) {
          console.log(`Updating commit from "${release.target_commitish}" to "${body.target_commitish}"`);
        }
        target_commitish = body.target_commitish;
        release = await gitea.repos.repoEditRelease(
          owner,
          repo, 
          release_id,
          {
            body: this._body || release.body,
            draft: this._isdraft !== undefined ? this._isdraft : release.draft,
            name: this._name || release.name,
            prerelease: this._isprerelease !== undefined ? this._isprerelease : release.prerelease,
            tag_name: this._tagname || release.tag_name,
            target_commitish: target_commitish,
          }
        )
      }
      else {
        let commit_message = "";
        if (body.target_commitish) {
          commit_message = ` using commit "${body.target_commitish}"`;
        }
        console.log(`👩‍🏭 Creating new release for tag ${body.tag_name}${commit_message}...`);
        release = await gitea.repos.repoCreateRelease(
          owner, 
          repo,
          {
            body: this._body,
            draft: this._isdraft,
            name: this._name,
            prerelease: this._isprerelease,
            tag_name: this._tagname,
            target_commitish: target_commitish,
          }
        )
      }

      this._id = release.id
    }

    async uploadAttachment(files, md5sum, sha256sum) {
      const file_patterns = files.split('\n')
      const all_files = paths(file_patterns);
      if (all_files.length == 0) {
        console.warn(`${file_patterns} not include valid file.`);
      }
      const attachments = await gitea.repos.repoListReleaseAttachments(owner, repo, this._id)
      for (const filepath of all_files) {
        for (const attachment of attachments) {
          let will_deleted = [path.basename(filepath), `${path.basename(filepath)}.md5`, `${path.basename(filepath)}.sha256`]
          if (will_deleted.includes(attachment.name)) {
            await gitea.repos.repoDeleteReleaseAttachment(owner, repo, this._id, attachment.id)
            console.log(`Successfully deleted old release attachment ${attachment.name}`)
          }
        }
        const content = fs.readFileSync(filepath);
        let blob = new Blob([content]);
        await gitea.repo.repoCreateReleaseAttachment(
          owner, 
          repo, 
          this._id,
          {
            attachment: blob,
            name: path.basename(filepath),
          }
        )

        if (md5sum) {
          let wordArray = CryptoJS.lib.WordArray.create(content);
          let hash = CryptoJS.MD5(wordArray).toString();
          blob = new Blob([hash], { type : 'plain/text' });
          await gitea.repo.repoCreateReleaseAttachment(
            owner, 
            repo, 
            this._id,
            {
              attachment: blob,
              name: `${path.basename(filepath)}.md5`,
            }
          )
        }
        
        if (sha256sum) {
          let wordArray = CryptoJS.lib.WordArray.create(content);
          let hash = CryptoJS.SHA256(wordArray).toString();
          blob = new Blob([hash], { type : 'plain/text' });
          await gitea.repo.repoCreateReleaseAttachment(
            owner, 
            repo, 
            this._id,
            {
              attachment: blob,
              name: `${path.basename(filepath)}.sha256`,
            }
          )
        }
        console.log(`Successfully uploaded release attachment ${filepath}`)
      }          
    }
}