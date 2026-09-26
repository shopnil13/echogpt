# EchoGPT Backend

Backend REST API for the EchoGPT multi-AI chat Chrome extension, built with NestJS, PostgreSQL, Prisma and Swagger.

> Work in progress. Full setup and architecture documentation arrives with the release.

## Quick start

```bash
nvm use                      # Node 22
npm install
cp .env.example .env
docker compose up -d postgres
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Swagger UI: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/v1/health

## Scripts

| Script                               | Purpose             |
| ------------------------------------ | ------------------- |
| `npm run start:dev`                  | Run with watch mode |
| `npm run build`                      | Compile to `dist/`  |
| `npm run lint` / `npm run typecheck` | Static checks       |
| `npm test`                           | Unit tests          |
| `npm run test:e2e`                   | End-to-end tests    |

## License

MIT
