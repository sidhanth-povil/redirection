# DSuite Redirects

DSuite Redirects is a WordPress redirect manager for marketing teams, built by [DSuite](https://designsuite.ai). It manages redirects, schedules campaign redirects, catches 404s and finds redirect chains and loops.

It is a fork of [Redirection](https://github.com/johngodley/redirection) by John Godley. See `docs/upstream-sync.md` for how upstream changes are brought in.

## Installation

Download `dsuite-redirects.zip` from the [latest release](https://github.com/sidhanth-povil/redirection/releases/latest), then go to Plugins > Add New > Upload Plugin in WordPress. Deactivate Redirection first; your redirects carry over.

Later versions appear in Dashboard > Updates.

## Customisation

The plugin keeps Redirection's action and filter hooks, documented on the [Redirection Hooks](https://redirection.me/developer/wordpress-hooks/) page.

### Permissions

Access to the admin interface is given to users who can `manage_options`. You can change this with the permission filters described on the [Redirection permissions](https://redirection.me/developer/permissions/) page.

## Building

DSuite Redirects is mostly a PHP plugin, but does contain files that need to be built. For this you'll need Node and pnpm installed.

### Requirements

- Node.js >= 12.14.0
- pnpm
- Composer (for PHP development)

### Setup

Install JavaScript dependencies:

```bash
pnpm install
```

Install PHP dependencies (for linting and testing):

```bash
composer install
```

### Development

The UI is built with React using `@wordpress/scripts`. To start development with hot-reload:

```bash
pnpm start
```

To create a production build:

```bash
pnpm build
```

### Linting

Run all linters:

```bash
pnpm lint
```

Or run individually:

- `pnpm lint:php` - PHP linting (PHPCS and PHPStan)
- `pnpm lint:js` - JavaScript linting
- `pnpm lint:css` - CSS linting
- `pnpm lint:ts` - TypeScript type checking

PHP code can be auto-formatted with:

```bash
composer format
```

### Testing

**PHP Unit tests:**

```bash
pnpm test:unit
```

Or directly via Composer:

```bash
composer test-unit
```

**PHP Integration tests (requires WordPress):**

First, start the WordPress environment:

```bash
pnpm wp-env:start
```

Then run the integration tests:

```bash
pnpm test:integration
```

To stop the environment:

```bash
pnpm wp-env:destroy
```

**JavaScript tests:**

```bash
pnpm test:js
```

**End-to-end tests:**

```bash
pnpm test:e2e
```

**Run all tests:**

```bash
pnpm test
```

### Releasing

1. Bump the version in `dsuite-redirects.php` (the header and `REDIRECTION_VERSION`), `package.json` and `readme.txt` (`Stable tag` and the changelog), and commit on `trunk`.
2. Push `trunk`, then run:

```bash
pnpm release
```

This builds `release/dsuite-redirects.zip`, tags `vX.Y.Z`, pushes the tag and creates the GitHub release with the zip attached. The dashboard updater only installs an asset named `dsuite-redirects.zip` from this repository.

To build the zip without releasing:

```bash
pnpm plugin:zip
```

### API Documentation

Generate API documentation:

```bash
pnpm doc
```

## Support

DSuite Redirects is a private plugin. Report problems to the DSuite team at [designsuite.ai](https://designsuite.ai).
