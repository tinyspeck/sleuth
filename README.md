# Sleuth

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/tinyspeck/sleuth/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/tinyspeck/sleuth/tree/main)

A Slack Log Viewer.

## Development

Sleuth requires [git](https://git-scm.com/) and [Node.js](https://nodejs.org/) for development.
We recommend installing [nvm](https://github.com/nvm-sh/nvm) to install Node.js on your machine.

To start the app in development mode, run the following commands:

```sh
git clone https://github.com/tinyspeck/sleuth
cd sleuth
git submodule update --init --recursive
nvm install
corepack enable
yarn
yarn start
```

## Releases

Releases are now fully automated and happen entirely within CircleCI.
To release a new version, follow the following steps:

1. Create a new version (for instance with `yarn version`). This should
   update the version number in `package.json` and create a new `git` tag.
2. Push the updated `package.json` and new `git` tag (`git push && git push --tags`).
3. CircleCI will automatically build Sleuth for all platforms and "draft"
   [a new release](https://github.com/tinyspeck/sleuth/releases).
4. Check the draft and make sure that all expected assets are there. A quick and
   easy way to do that is to check if the drafted release has the same assets
   as the latest published release.
5. If things look good, "publish" the draft. Sleuth's autoupdater will automatically
   push it out to people.
