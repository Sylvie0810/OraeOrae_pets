# OraeOrae 🐾

포메라니안 두 마리(레오·아이)를 위한 개인 케어 앱. 매일 체중/사료/산책/배변을 기록하고,
체중 타임라인과 AI 인사이트로 actionable insight를 제공합니다.

## 개발

```bash
npm install
cp .env.example .env   # DATABASE_URL 등 채우기
npm run db:push        # 스키마 적용 (Postgres 필요)
npm run dev            # http://localhost:5000
```

`npm run check` 로 타입 검사, `npm test` 로 단위 테스트(순수 로직, DB 불필요)를 실행합니다.

## 스택

React + Vite · Express · Drizzle + PostgreSQL · Vertex AI (Gemini) · Cloud Run

- 설계 문서: `docs/superpowers/specs/2026-06-16-oraeorae-mvp.md`
- 구현 계획: `docs/superpowers/plans/2026-06-16-oraeorae-mvp.md`

## 배포

Cloud Build → Cloud Run (`cloudbuild.yaml`). 필요한 환경변수: `DATABASE_URL`,
`JWT_SECRET`, `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`. `GOOGLE_CLOUD_PROJECT`가
없으면 AI 인사이트는 규칙 기반 폴백으로 동작합니다.
