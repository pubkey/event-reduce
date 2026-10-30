# Releasing

A release is started by running the [Release workflow](../.github/workflows/release.yml) from the Actions tab of GitHub.
It releases all implementations with the same version:

1. It bumps the version of the JavaScript implementation and runs `node scripts/set-version.mjs`,
   which gives every other implementation that version.
2. It publishes the JavaScript implementation to npm, commits the versions and pushes the tags `v<version>` and `go/v<version>`.
3. One job per implementation tests the code of the tag and publishes it:

| Implementation | Package manager | Package | Authentication |
| --- | --- | --- | --- |
| JavaScript | [npm](https://www.npmjs.com/package/event-reduce-js) | `event-reduce-js` | trusted publishing |
| Rust | [crates.io](https://crates.io/crates/rxdb-event-reduce) | `rxdb-event-reduce` | trusted publishing |
| Dart | [pub.dev](https://pub.dev/packages/rxdb_event_reduce) | `rxdb_event_reduce` | automated publishing (OIDC) |
| Kotlin | [Maven Central](https://central.sonatype.com/artifact/info.rxdb/event-reduce) | `info.rxdb:event-reduce` | token and GPG key secrets |
| C# | [NuGet](https://www.nuget.org/packages/RxDB.EventReduce) | `RxDB.EventReduce` | trusted publishing |
| Python | [PyPI](https://pypi.org/project/rxdb-event-reduce/) | `rxdb-event-reduce` | trusted publishing |
| Swift | Swift Package Manager | product `RxDBEventReduce`, from the `v<version>` tag and the root `Package.swift` | none |
| Go | Go modules | the `go/v<version>` tag | none |

If one publish job fails, fix the cause and re-run the failed job: it checks out the release tag, so it publishes the released code.

Go needs the major version in the module path from v2 on (`github.com/pubkey/event-reduce/go/v7`).
`scripts/set-version.mjs` updates it on a major release, so the imports of Go users change with each major version.

## One-time setup

Trusted publishing uses the GitHub OIDC token of the workflow, so it needs no secrets.
Register the repository `pubkey/event-reduce` with the workflow file `release.yml` on each site.

- **crates.io**: crates.io only allows trusted publishing for existing crates.
  Publish the first version by hand with `cargo publish` in `./rust`.
  Then add a trusted publisher in the settings of the crate.
- **pub.dev**: pub.dev only allows automated publishing for existing packages.
  Publish the first version by hand with `dart pub publish` in `./dart`.
  Then, in the admin tab of the package:
  - enable automated publishing from GitHub Actions for the repository;
  - set the tag pattern to `v{{version}}`;
  - enable publishing from `workflow_dispatch` events, because the release workflow is started by hand.

  Optionally, create the verified publisher `rxdb.info` on pub.dev and move the package to it.
- **Maven Central**: in the [Central Portal](https://central.sonatype.com), add the namespace `info.rxdb`
  and verify it with the DNS TXT record the portal shows for the domain `rxdb.info`. Then add these repository secrets:
  - `MAVEN_CENTRAL_USERNAME` and `MAVEN_CENTRAL_PASSWORD`: a user token of the Central Portal.
  - `MAVEN_SIGNING_KEY`: an ASCII armored GPG private key (`gpg --armor --export-secret-keys <key id>`).
    Its public key must be on a key server, for example with `gpg --keyserver keyserver.ubuntu.com --send-keys <key id>`.
  - `MAVEN_SIGNING_KEY_PASSWORD`: the passphrase of that key.
- **NuGet**: add a trusted publishing policy on nuget.org.
  Add the nuget.org user name (not the email address) as the repository secret `NUGET_USER`.
  Optionally, [reserve the ID prefix](https://learn.microsoft.com/en-us/nuget/nuget-org/id-prefix-reservation) `RxDB.` so the package shows as verified.
- **PyPI**: add a pending trusted publisher for the project `rxdb-event-reduce`.
  PyPI then creates the project on the first release.
- **Swift**: add the repository once to the [Swift Package Index](https://swiftpackageindex.com/add-a-package) to make the package easy to find.
- **Go**: nothing to set up. The release job asks the Go proxy for the new version, so it shows up on [pkg.go.dev](https://pkg.go.dev).
