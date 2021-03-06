#!/usr/bin/env node
const program = require('commander');
const appInfo = require('./../package.json');
const simpleGit = require('simple-git');
const homedir = require('homedir')();
const https = require('https');
const fs = require('fs');
const mkdirp = require('mkdirp');
const util = require('util');
const isThere = require("is-there");
const md5 = require('js-md5');
const log = console.log

const reposDir = homedir + '/.cocoapods/repos';
const podSpecPathFmt = 'Specs/%s/%s';
const podSpecFilePostfix = ".podspec.json";
const githubBaseUrl = "https://raw.githubusercontent.com/CocoaPods/Specs/master";

function getGithubRawContentUrl(podName, podVersion) {
  return githubBaseUrl + getOfficalPodSpecPath(podName, podVersion);
}

function getLocalSpecPatch(repoName, podName, podVersion) {
  return getRepoDir(repoName) + getPodSpecPath(podName, podVersion);
}

function getLocalSpecDir(repoName, podName, podVersion) {
  return getRepoDir(repoName) + "/" +util.format(podSpecPathFmt, podName, podVersion);
}

/* cocoapods use md5 digest prefix */
/* private repo do not need this, it's not obviously if some pod is installed or not */
function getOfficalPodSpecPath(podName, podVersion) {
  const md5Str = md5(podName)
  var pathFmt = "/" + podSpecPathFmt + '/%s/%s/%s/%s' + podSpecFilePostfix;
  return util.format(pathFmt, md5Str.charAt(0), md5Str.charAt(1), md5Str.charAt(2), podName, podVersion, podName);
}

function getPodSpecPath(podName, podVersion) {
  var pathFmt = "/" + podSpecPathFmt + '/%s' + podSpecFilePostfix;
  return util.format(pathFmt, podName, podVersion, podName);
}

function getRepoDir(repoName) {
  return reposDir + '/' + repoName;
}

function downloadSpecAndUpdate(repoName, podName, podVersion) {
  const git = simpleGit(getRepoDir(repoName));
  const podDir = getLocalSpecDir(repoName, podName, podVersion);
  
  git.pull(function(){
    fs.access(podDir, fs.F_OK, function(err) {
      mkdirp(podDir, function(err) {
        if(err) {
          console.error(err);
          return;
        }
        
        const specDownloadUrl = getGithubRawContentUrl(podName, podVersion);
        const podFilePath = getLocalSpecPatch(repoName, podName, podVersion);
        var file = fs.createWriteStream(podFilePath);
        var request = https.get(specDownloadUrl, function(response) {
          if(response.statusCode === 404){
            log("pod "+podName+"["+podVersion+"] not exists!");
            return
          }

          if (response.statusCode !== 200){
            log("pod "+podName+"["+podVersion+"] download failure");
            return
          }
          response.pipe(file);
          log("pod "+podName+"["+podVersion+"] download success");

          git.add(".", function(){
            git.commit("add " + podName + "[" + podVersion + "]", function(){
              git.push(function(){
                log("pod " + podName + "[" + podVersion + "] install success");
                // TODO use promise
              });
            });
          });
        });
      });
    });
  }); 
}

program
  .version(appInfo.version)
  .usage('add <podName> <podVersion> [-r repoName]')
  .option('-r, --repo <repoName>', 'repo name under ~/.cocoapods/repos folder')
  .arguments('<cmd> <podName> <podVersion>')
  .action(function(cmd, podName, podVersion, options) {
    if (cmd !== 'add' && cmd !== 'config') {
      program.help();
      return;
    }

    const repoName = options.repo
    if (!isThere(getRepoDir(repoName))) {
      log("repo["+repoName+"] not exist in ~/.cocoapods/repos")
      return;
    }

    downloadSpecAndUpdate(repoName, podName, podVersion);
  });

program
  .on('--help', function() {
    log('  Examples:');
    log();
    log('    $ minipod add AFNetworking 3.1.0');
    log('    $ minipod add AFNetworking 3.1.0 -r 18plan');
    log();
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

