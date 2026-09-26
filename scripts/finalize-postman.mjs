// Post-processes the Postman collection generated from docs/openapi.json:
// - sets a usable baseUrl and token variables
// - stores tokens automatically after register, login and refresh
// - marks public endpoints as no-auth
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? 'postman/echogpt.postman_collection.json';
const collection = JSON.parse(readFileSync(file, 'utf8'));

const flatten = (items) => items.flatMap((item) => (item.item ? flatten(item.item) : [item]));
const pathOf = (request) => '/' + request.url.path.join('/');

const STORE_AUTH_RESULT = [
  'const body = pm.response.json();',
  'const tokens = body.tokens ?? body;',
  'if (tokens.accessToken) pm.collectionVariables.set("bearerToken", tokens.accessToken);',
  'if (tokens.refreshToken) pm.collectionVariables.set("refreshToken", tokens.refreshToken);',
];
const TOKEN_ENDPOINTS = ['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/refresh'];

for (const item of flatten(collection.item)) {
  const path = pathOf(item.request);
  if (!item.request.auth) item.request.auth = { type: 'noauth' };
  if (TOKEN_ENDPOINTS.includes(path)) {
    item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: STORE_AUTH_RESULT } }];
  }
  if (path === '/api/v1/auth/refresh' && item.request.body?.raw) {
    item.request.body.raw = JSON.stringify({ refreshToken: '{{refreshToken}}' }, null, 2);
  }
}

collection.info.description =
  'Generated from docs/openapi.json (npm run postman:export). Run "Sign in with email and password" first; ' +
  'the access and refresh tokens are stored automatically in collection variables.';
collection.variable = [
  { key: 'baseUrl', value: 'http://localhost:3000' },
  { key: 'bearerToken', value: '' },
  { key: 'refreshToken', value: '' },
];
writeFileSync(file, `${JSON.stringify(collection, null, 2)}\n`);
process.stdout.write(`Postman collection finalized: ${file}\n`);
