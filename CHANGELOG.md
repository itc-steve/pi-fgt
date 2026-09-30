# Changelog

All notable changes to this project.

## [1.5.1] - 2026-09-30

### Fixed
- Filters no longer strip UUID catalogs, policy SNAT flags, IPsec diagnostics, or WiFi RF/auth evidence
- FortiOS 7.6 session count, empty SD-WAN health-check, and monitor download/backup dumps are handled

### Changed
- Agent can turn session filtering off without writing config; secrets and size caps stay on
- `typebox` moved from runtime dependency to optional peer/dev dependency
