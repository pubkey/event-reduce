// Sets the version of all implementations to the version of the JavaScript implementation.
// Runs on every release (see .github/workflows/release.yml), run it locally with
// `node scripts/set-version.mjs` after changing the version in javascript/package.json.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const version = JSON.parse(readFileSync(join(root, 'javascript/package.json'), 'utf8')).version;
const major = Number(version.split('.')[0]);

function replace(file, regex, replacement) {
    const path = join(root, file);
    const content = readFileSync(path, 'utf8');
    if (!regex.test(content)) {
        throw new Error(`set-version: no match for ${regex} in ${file}`);
    }
    writeFileSync(path, content.replace(regex, replacement));
}

replace('rust/Cargo.toml', /^version = ".*"$/m, `version = "${version}"`);
replace('dart/pubspec.yaml', /^version: .*$/m, `version: ${version}`);
replace('kotlin/build.gradle.kts', /^version = ".*"$/m, `version = "${version}"`);
replace('csharp/src/RxDB.EventReduce/RxDB.EventReduce.csproj', /<Version>.*<\/Version>/, `<Version>${version}</Version>`);
replace('python/pyproject.toml', /^version = ".*"$/m, `version = "${version}"`);
replace('swift/README.md', /from: "\d+\.0\.0"/, `from: "${major}.0.0"`);

// Go needs the major version in the module path from v2 on, https://go.dev/ref/mod#major-version-suffixes
// Swift and Go have no version in a file, they use the git tags of the release.
const goModule = 'github.com/pubkey/event-reduce/go' + (major >= 2 ? `/v${major}` : '');
const goModuleRegex = /github\.com\/pubkey\/event-reduce\/go(\/v\d+)?(?![\w.-])/g;
const goFiles = readdirSync(join(root, 'go'))
    .filter(file => file === 'go.mod' || file.endsWith('.go') || file.endsWith('.md'))
    .map(file => 'go/' + file);
for (const file of goFiles) {
    const path = join(root, file);
    const content = readFileSync(path, 'utf8');
    writeFileSync(path, content.replace(goModuleRegex, goModule));
}

console.log(`set-version: ${version}`);
