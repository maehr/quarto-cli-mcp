# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [0.2.0] - 2026-08-30

### Added

- Add pure core primitives (#8)
- Add the project registry and quarto_create_project (#10)
- Add quarto_render (#14)
- Add quarto_inspect (#12)
- Add the MCP server and the stdio entry point (#13)
- Remember project metadata defaults (#20)

### Documentation

- Add specification and agent instructions
- Make AGENTS.md match the repository (#18)
- Document the merge rules and limits of the metadata defaults (#27)

### Fixed

- Read the server version from package.json (#25)
- Remove temporary projects when the client closes the pipe (#26)

### Misc

- Bootstrap TypeScript toolchain and CI (#7)
- Drop the visibility guards now that the repository is public (#9)

### Tests

- Remove the temporary directories the exec tests create (#16)


