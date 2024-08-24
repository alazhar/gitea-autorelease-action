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
    constructor () {
      this._name = ''
      this._body = ''
      this._isdraft = undefined
      this._isprerelease = undefined
      this._tagname = ''
      this._target_commitish = ''
      this._attachament = null
      this._sha = false

    }
    
    async create(){
      try {
        let release = await gitea.repos.repoGetReleaseByTag(owner, repo, 'tag')
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
        return release
      } catch (error) {
        if (!(error instanceof gitea.ApiError) || error.status !== 404) {
          throw error
        }
      }

      let commit_message = "";
      if (body.target_commitish) {
        commit_message = ` using commit "${body.target_commitish}"`;
      }
      console.log(`👩‍🏭 Creating new release for tag ${body.tag_name}${commit_message}...`);
      let release = await gitea.repos.repoCreateRelease(
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
      return release 
    }

    async uploadAttachment(release_id) {
      params = params || {};
      const attachments = await gitea.repos.repoListReleaseAttachments(owner, repo, release_id)
      for (const filepath of all_files) {
        for (const attachment of attachments) {
          let will_deleted = [path.basename(filepath), `${path.basename(filepath)}.md5`, `${path.basename(filepath)}.sha256`]
          if (will_deleted.includes(attachment.name)) {
            await gitea.repos.repoDeleteReleaseAttachment(owner, repo, release_id, attachment.id)
            console.log(`Successfully deleted old release attachment ${attachment.name}`)
          }
        }
        const content = fs.readFileSync(filepath);
        let blob = new Blob([content]);
        await gitea.repo.repoCreateReleaseAttachment(
          owner, 
          repo, 
          release_id,
          {
            attachment: blob,
            name: path.basename(filepath),
          }
        )

        if (params.md5sum) {
          let wordArray = CryptoJS.lib.WordArray.create(content);
          let hash = CryptoJS.MD5(wordArray).toString();
          blob = new Blob([hash], { type : 'plain/text' });
          await gitea.repo.repoCreateReleaseAttachment(
            owner, 
            repo, 
            release_id,
            {
              attachment: blob,
              name: `${path.basename(filepath)}.md5`,
            }
          )
        }
        
        if (params.sha256sum) {
          let wordArray = CryptoJS.lib.WordArray.create(content);
          let hash = CryptoJS.SHA256(wordArray).toString();
          blob = new Blob([hash], { type : 'plain/text' });
          await gitea.repo.repoCreateReleaseAttachment(
            owner, 
            repo, 
            release_id,
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