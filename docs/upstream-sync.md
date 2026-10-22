# Pulling in upstream Redirection updates

DSuite Redirects is a git fork of [johngodley/redirection](https://github.com/johngodley/redirection). Our history contains theirs (we forked at `811f440`, Redirection 5.10.1), so upstream fixes come in with a normal `git merge`, not by copying files.

## One-time setup (per clone)

```sh
git remote add upstream https://github.com/johngodley/redirection.git
git remote set-url --push upstream DISABLED   # we never push to upstream
```

## Check for updates

```sh
git fetch upstream
git log --oneline trunk..upstream/trunk       # what's new upstream
git diff --stat trunk...upstream/trunk        # which files it touches
```

Nothing listed means we're up to date. Check when Redirection ships a release, or monthly.

## Merge an update

```sh
git checkout trunk && git checkout -b upstream-sync-<version>
git merge upstream/trunk          # or a tag: git merge 5.10.2
```

Only a security fix you need right now and can't wait on the rest of a release for? Cherry-pick just that commit: `git cherry-pick <sha>`.

## Resolving conflicts

Where conflicts come from, most to least common:

1. **Text domain** (~56 PHP files differ only by our rename). Take upstream's version, then re-apply the rename:
   ```sh
   git checkout --theirs <file>
   sed -i '' "s/, 'redirection' )/, 'dsuite-redirects' )/g" <file>
   ```
   After the merge, this should print nothing outside the legacy files (`redirection-admin.php`, `models/`, `matches/`, `modules/`, `actions/`):
   `grep -rln "'redirection' )" includes dsuite-redirects.php`
2. **UI (`src/`)**: we rebuilt every page. Upstream changes to its old page files (`src/page/*` table pages, `component/table`, `component/log-page`) don't apply: keep ours (`git checkout --ours`), then read upstream's diff and port any real behaviour fix by hand. Shared logic (`lib/`, `stores/`, `types/`, API hooks) usually merges cleanly or needs a small manual fix.
3. **Branding**: plugin header, menu, readme, support links. Keep ours.
4. **Schema**: upstream bumps `REDIRECTION_DB_VERSION` and adds its own migrations. Take them. Ours live separately (`dsr_db_version`, `includes/database/class-dsr-upgrader.php`) and never collide.

**Submodules.** `src/wp-plugin-components` and `src/wp-plugin-lib` are git submodules owned by the upstream author. Never edit files inside them: we can't push those changes, so a fresh clone would lose them. Customise from our side (props, wrappers, `lib/`). After a merge that moves them, run `git submodule update --init`.

Things we deliberately keep unchanged so merges stay cheap: the `Redirection\` namespace, DB table names, option keys, the `redirection/v1` REST namespace. Don't rename them.

## Before merging the sync branch into trunk

```sh
pnpm lint:ts && pnpm test:js && pnpm build
pnpm test:unit:env && pnpm test:integration
```

Then load every page in wp-env, check a redirect and a 404 still log, and merge with `git merge --no-ff`. Ship it: bump the version (`package.json`, `dsuite-redirects.php` header and `REDIRECTION_VERSION`, `readme.txt`), merge to trunk, push, then `pnpm release`. Our tags are `vX.Y.Z`; upstream's are bare numbers, so they never collide.
