import fs from 'node:fs';
import crypto from 'node:crypto';

const ZIP = '/tmp/ops-build-report.zip';
const NAME = 'ops-build-report';

const token = process.env.ACTIONS_RUNTIME_TOKEN;
const resultsUrl = process.env.ACTIONS_RESULTS_URL;
if (!token || !resultsUrl) {
  console.log('missing ACTIONS_RUNTIME_TOKEN / ACTIONS_RESULTS_URL');
  process.exit(1);
}

const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
const scope = (payload.scp || '').split(' ').find((s) => s.startsWith('Actions.Results:'));
if (!scope) {
  console.log('no Actions.Results scope: ' + payload.scp);
  process.exit(1);
}
const [, runBackendId, jobBackendId] = scope.split(':');
console.log('scope parts', JSON.stringify(scope.split(':')));
const base = new URL(resultsUrl).origin;
const zip = fs.readFileSync(ZIP);

async function twirp(method, body) {
  const encoded = JSON.stringify(body);
  console.log('REQUEST', method, encoded);
  const res = await fetch(`${base}/twirp/github.actions.results.api.v1.ArtifactService/${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: encoded,
  });
  const text = await res.text();
  console.log(method, res.status, text.slice(0, 400));
  if (!res.ok) throw new Error(`${method} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const created = await twirp('CreateArtifact', {
  workflow_run_backend_id: runBackendId,
  workflow_job_run_backend_id: jobBackendId,
  name: NAME,
  version: 7,
  mime_type: { value: 'application/zip' },
});

const put = await fetch(created.signed_upload_url, {
  method: 'PUT',
  headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': 'application/zip' },
  body: zip,
});
console.log('PUT', put.status, put.statusText);

const hash = crypto.createHash('sha256').update(zip).digest('hex');
const fin = await twirp('FinalizeArtifact', {
  workflow_run_backend_id: runBackendId,
  workflow_job_run_backend_id: jobBackendId,
  name: NAME,
  size: String(zip.length),
  hash: { value: `sha256:${hash}` },
});
console.log('finalized artifact_id=' + fin.artifact_id);
