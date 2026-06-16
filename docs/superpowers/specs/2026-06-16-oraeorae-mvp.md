# 오래오래(OraeOrae) — 강아지 케어 앱 설계 문서 (MVP)

> 작성일: 2026-06-16
> 상태: 합의 완료, 구현 대기
> 작성 배경: 예전 Replit+Firebase로 만들다 만 앱을 GCP 스택으로 재구축. 예전 앱의 화면/기능은 검증된 UX 레퍼런스로만 사용(코드 재사용 X).

---

## 0. 한 줄 요약

포메라니안 두 마리(레오·아이)의 일상·건강을 매일 기록하고, **체중과 식이/활동의 관계를 한눈에 보며, AI가 "다음 행동"을 제안**하는 개인용 케어 앱. 나 혼자 여러 기기에서 쓰다가 나중에 public build로 공유.

핵심 차별점: 단순 기록/시각화가 아니라 **actionable insight**(목표 대비 갭 + 식이/활동/약물 연결 → 구체적 행동 제안)를 제공한다.

---

## 1. 사용자 & 맥락

- **사용자**: 나 혼자(여러 기기). 미래엔 public build로 공유 → 처음부터 클라우드 동기화 + 로그인 + 다중 사용자 대비 데이터 격리.
- **반려 대상**: 포메라니안 2마리
  - 한 마리는 **갑상선 기능 저하증** → 약물 투여 중 (체중 증가와 직결되는 질환)
  - 둘 다 **알로페시아(피부 문제)** → 주간 스파샵 방문, 피부 사진 추적 필요
- **입력 방식**: "오늘의 기록" **한 화면에서 몰아서** 입력 (데일리 로그 중심).

---

## 2. 기능 우선순위 (사용자 확정)

전체 6개 기능 중 우선순위: **2+3 > 6 > 5 > 4 > 1**

1. 프로필 (견종, 생년월일, 성별, 중성화, 등록번호) — 다른 기능의 토대라 MVP에 최소 포함
2. **체중 추적** (목표 체중 + 일별 입력 → 추세) — 가장 중요
3. **식이·활동 로그** (사료/간식, 산책, 활동, 배변) → 2번과 상관/인과 분석
4. 의료·약물 기록 (병원 방문, 백신/구충제, 만성 약물=갑상선약 용량/날짜)
5. 피부 추적 (사진 업로드/비교/코멘트, 스파샵 원장 코멘트·사진)
6. 비용 추적 (카테고리별 + 구매처/브랜드)

### MVP 범위 (1차)
- **1 프로필** (최소) + **2 체중** + **3 데일리 로그** + **6 비용**
- 체중은 단순 시각화가 아니라 **AI actionable insight** 제공
- 상관분석은 **겹쳐 보는 타임라인**(체중 그래프 위에 식이/산책/배변 마커)

### MVP 이후 (우선순위순)
- **5 피부 사진** → **4 의료·약물**

---

## 3. 기술 스택 & 배포

K-Sleep Care(`~/Projects/ksleep-app`) 패턴을 따르되 **가볍게**. HIPAA/평가 하네스/복잡한 CI 등 무거운 건 제외.

| 층 | 기술 | 비고 |
|---|---|---|
| 프론트 | React + Vite + TypeScript | K-Sleep과 동일 |
| UI | Tailwind + 차트 라이브러리(Recharts 등) | 타임라인 그래프 |
| 백엔드 | Express + TypeScript (Node 22) | REST API |
| ORM/DB | Drizzle + Cloud SQL (PostgreSQL) | `db:push`로 스키마 관리 |
| 사진 저장 | Cloud Storage (GCS) | MVP는 거의 미사용, 5번(피부) 때 본격 |
| AI | **Vertex AI (Gemini)** | 인사이트. 모델 교체 가능하게 추상화 |
| 인증 | 이메일 로그인 (JWT 세션) | 가벼움. user_id로 데이터 격리 |
| 배포 | Cloud Build → Cloud Run | Dockerfile 1개, 단순 파이프라인 |
| 나중에 | Capacitor | iOS/안드로이드 → 앱스토어/플레이스토어 public build |

### 프로젝트 구조
```
OraeoOrae/
├── client/          # React (Vite)
│   ├── pages/        # 홈/오늘/체중/비용 + 로그인/프로필
│   ├── components/
│   └── lib/
├── server/          # Express
│   ├── routes/       # dogs, weights, daily-logs, expenses, insights, auth
│   ├── db/           # Drizzle 스키마 (9개 테이블)
│   └── ai/           # Gemini 인사이트 (집계 코드 + 프롬프트)
├── shared/          # 클라/서버 공용 타입
├── Dockerfile
└── cloudbuild.yaml
```

### 가볍게 가는 결정
- 테스트는 핵심 로직(인사이트 집계 계산)만. 전수 테스트 X.
- CI는 빌드+배포만. 복잡한 게이트 X.
- 모니터링/평가 하네스 X.
- GCP 프로젝트는 배포 단계에서 결정(신규 or 재활용).

---

## 4. 데이터 모델 (9개 테이블)

핵심 멘탈 모델: **"하루 = daily_log 1개"(날짜 서랍)에 사료/산책/배변 엔트리를 매단다.** 체중과 목표는 별도 테이블.

| 테이블 | 역할 | 주요 컬럼 |
|---|---|---|
| `users` | 보호자 | id, email, password_hash, name, created_at |
| `dogs` | 강아지 프로필(1) | id, user_id, name, breed, birth_date, sex, neutered(bool), registration_no, photo_url, created_at, updated_at |
| `weight_goals` | 목표 체중 이력(시기별 변경 가능) | id, dog_id, target_kg, effective_from(date), note, created_at |
| `weight_logs` | 체중 기록(2) | id, dog_id, date, weight_kg, note, created_at |
| `daily_logs` | 하루 단위 컨테이너(3) | id, dog_id, **date (dog_id+date UNIQUE)**, summary_note, created_at, updated_at |
| `feeding_entries` | 사료/간식 | id, daily_log_id, kind('food'\|'treat'), name, amount_g(numeric), fed_at(time), created_at |
| `walk_entries` | 산책 | id, daily_log_id, slot('morning'\|'afternoon'\|'evening'), duration_min(int), distance_km(numeric, nullable), created_at |
| `poop_entries` | 배변 | id, daily_log_id, pooped_at(time, nullable), status('normal'\|'soft'\|'constipation'\|'diarrhea' 등), created_at |
| `expenses` | 비용(6) | id, user_id, dog_id(nullable=공용), date, category('food'\|'treat'\|'toy'\|'hospital'\|'clothing'\|'grooming'\|'etc'), amount(numeric), vendor, brand, note, created_at |

### 설계 포인트
1. **daily_logs가 하루를 대표** (dog_id+date UNIQUE) → "오늘의 기록" 화면은 그날 daily_log 1개 + 매달린 엔트리를 한 번에 로드/편집.
2. **체중은 별도**(weight_logs) → 매일 안 잴 수도/여러 번 잴 수도 있음. 타임라인 주축.
3. **목표 체중은 weight_goals로 분리** → 시기별 목표 변경 이력 보존(여름 3.3kg → 겨울 3.5kg). 타임라인의 목표선.
4. **엔트리를 숫자로 쪼갬**(사료 g, 산책 분 등) → AI가 집계·분석할 수 있는 구조화 데이터. actionable insight의 재료.
5. **expenses.dog_id nullable** → 공용 지출(공용 장난감 등) 허용. user_id로도 묶음.
6. 모든 테이블 created_at/updated_at, user_id 기반 데이터 격리(미래 다중 사용자 대비).

---

## 5. 화면 구조

**하단 탭 4개** + 상단 강아지 토글. 예전 앱(홈/탭바)을 레퍼런스로, 우선순위(체중 insight 중심)에 맞춰 재구성.

```
┌─────────────────────────────────────┐
│   [레오 ▾]            ⚙️             │  ← 상단: 강아지 전환 + 설정
│         (화면 본문)                  │
├──────────────────────────────────────┤
│  🏠홈   📝오늘   📊체중   💰비용     │  ← 하단 탭 4개
└─────────────────────────────────────┘
```

### 🏠 홈 (대시보드) — 앱 진입 첫 화면
- 오늘의 **AI 인사이트 카드**(🔴🟡🟢) ← 앱의 심장
- 두 아이 요약(오늘 체중, 목표 대비, 오늘 기록 여부)
- 빠른 진입 버튼

### 📝 오늘 (데일리 로그) — "한 화면에서 몰아 입력"
- 날짜 선택(기본=오늘) + 강아지 선택
- 체중 한 줄 입력 + 사료/간식 + 산책 + 배변을 카드 섹션으로 → 탭 몇 번에 완료
- 과거 날짜로 이동해 지난 기록 보기/수정

### 📊 체중 (타임라인) — 분석 핵심
- 체중 라인 차트 + **목표선** 겹쳐 보기
- 차트 아래 그날의 사료량·산책·배변 마커(겹쳐 보는 타임라인)
- 목표 체중 설정/변경(weight_goals)
- 기간 토글(1주/1개월/3개월)

### 💰 비용 — 지출 분석
- 카테고리별 합계(파이/바)
- 지출 목록(날짜·금액·구매처/브랜드)
- 지출 추가

### 그 외 (탭 아님)
- 프로필/설정 — 상단 ⚙️ (프로필 편집, 강아지 추가, 로그아웃)
- 로그인 화면 — 앱 진입 시(이메일 기반)

---

## 6. AI 인사이트 설계 (앱의 심장)

"보여주기"를 넘어 **"그래서 뭘 해야 하나"**를 제안.

### 작동 흐름
```
1. 데이터 수집 (코드, AI 아님)
   최근 N일 DB 집계: 체중 오늘값/7일추세/목표갭, 사료 일평균g/변화,
   산책 횟수·분, 배변 무름·변비 빈도, (나중) 갑상선약 복용여부
        ↓
2. AI에게 "해석"만 (Gemini)
   정확한 집계 숫자 + 강아지 맥락(견종/나이/질환) → LLM은 판단/제안만
        ↓
3. 구조화 카드 출력
   { severity: 🔴|🟡|🟢, title, evidence, recommended_action, related_metrics }
        ↓
4. 홈 화면 카드 표시 + 기록 저장
```

### 핵심 원칙: 집계는 코드, 해석만 AI
- LLM은 산수에 약함 → "+0.3kg", "7일 평균 65g" 같은 수치는 **코드가 정확히 계산**.
- AI는 그 정확한 숫자를 받아 **판단·제안**(맥락 이해 = LLM 강점)만.
- 결과: 숫자는 항상 정확, 제안은 AI 강점 활용.

### 신뢰성 장치 (반려동물 건강이라 중요)
1. **의료 면책** — 약물·질환 관련 인사이트엔 항상 "참고용, 수의사 상담 대체 아님" 명시.
2. **근거 표시** — 모든 카드에 어떤 숫자를 보고 말하는지 표시 → 사용자가 검증 가능.
3. **데이터 부족 시 침묵** — 기록 3일 미만이면 "데이터가 더 쌓이면 분석"만. 억측 금지.
4. **하루 1회 자동 갱신 + 수동 새로고침** — API 비용 절감.

### 인사이트 예시
- 🔴 "레오, 목표(3.3kg) 대비 +0.3kg. 최근 7일 사료 평균 65g으로 권장보다 많음. 일일 5g 줄여보세요."
- 🟡 "아이, 체중 안정적인데 최근 3일 산책 0회. 활동 부족이 정체 원인일 수 있어요."
- 🟢 "레오, 2주 연속 목표 구간 유지. 현재 루틴(사료 60g + 산책 2회) 잘 맞아요."
- ⚠️ "(나중) 갑상선 약 복용 중 — 기능 저하는 체중 증가와 직결. 최근 +0.2kg, 다음 진료 때 용량 점검 권장." (+의료 면책)

### 모델 추상화
인사이트 생성기는 인터페이스 뒤에 둠(`server/ai/`) → Gemini를 기본 구현으로 하되, 나중에 다른 모델로 교체 시 한 군데만 수정.

---

## 7. 예전 앱과의 관계

- 예전 오래오래 앱: Replit + Firebase, 로그인/홈/프로필/빠른기록(체중·식사·산책·추억·비용·건강·접종·병원) 화면이 있었음.
- 회고에서 배운 점: Replit↔Firebase 연동 복잡, 오류 수정 과정 설명 요청 필요, PRD 부재로 잦은 번복.
- **이번 결정**: 화면/기능은 검증된 UX 레퍼런스로 참고, 코드는 재사용 안 함. GCP 스택으로 새로 + 이 문서가 그 PRD 역할.

---

## 8. 구현 순서 (개략 — 상세는 plan 문서에서)

1. 프로젝트 스캐폴딩(client/server/shared, Vite, Express, Drizzle, Tailwind)
2. DB 스키마(9개 테이블) + 마이그레이션
3. 인증(이메일 로그인, JWT)
4. 프로필 CRUD(dogs) + 강아지 토글
5. 체중 + 목표(weight_logs, weight_goals) + 타임라인 차트
6. 데일리 로그("오늘" 화면, 사료/산책/배변 엔트리)
7. 겹쳐 보는 타임라인(체중 차트에 마커)
8. 비용(expenses) + 카테고리 분석
9. AI 인사이트(집계 코드 + Gemini + 홈 카드)
10. 배포(Dockerfile, cloudbuild.yaml, Cloud Run)

MVP 이후: 피부 사진(5) → 의료·약물(4) → Capacitor 래핑.

---

## 9. 미해결/구현 중 결정할 것 (블로커 아님)
- 차트 라이브러리 확정(Recharts vs 대안)
- GCP 프로젝트 신규 vs 재활용 + Cloud SQL 인스턴스
- 인증 세부(세션 저장 방식)
- Gemini 모델 버전/리전
