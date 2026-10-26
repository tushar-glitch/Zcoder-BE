# ZoyCoders Website & Admin Panel — Backend API Contract
| Field | Value |
|---|---|
| Version | 1.1 |
| Style | OpenAPI 3.0.3 (Swagger-compatible). The YAML in §3 can be saved as `apps/api/openapi.yaml` and loaded into Swagger UI, Postman or Redoc. |
| Base URL | `https://zoycoders.com/api/v1` (website: same-origin via Next.js rewrite; mobile app: calls it directly) · local `http://localhost:4000/api/v1` |
| Stack | NestJS (Express platform) · PostgreSQL · Prisma |
| Clients | Website (Next.js), admin panel (web only) and mobile app. The mobile app uses `/public/**` only. |
| Realtime | None. The admin panel polls `GET /admin/dashboard/stats`; new inquiries notify admins by email (§4). |
| Related | `Architecture.md` (design), `Business.md` (rules `BL-*`), `Functional.md` (requirements `FR-*`) |
---
## 1. Conventions
### 1.1 Authentication
| Zone | Paths | Auth |
|---|---|---|
| Public | `/health`, `/public/**` | None |
| Auth | `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password` | None (credentials / refresh cookie / emailed token) |
| Admin | `/auth/me`, `/auth/logout`, `/auth/change-password`, `/admin/**` | Cookie `zc_access` (JWT, 15 min, `HttpOnly; Secure; SameSite=Lax`) |
- `zc_refresh` (7 days, `Path=/api/v1/auth`) is used only by `/auth/refresh` and is rotated on each use.
- State-changing admin requests must carry an `Origin`/`Referer` matching `APP_URL`, otherwise `403 FORBIDDEN`.
- Content type is `application/json`, except `POST /admin/media` (`multipart/form-data`).
- Timestamps are ISO-8601 UTC strings. IDs are UUID v4.
- The admin panel is web-only, so admin auth is cookie-based. The mobile app calls `/public/**` only and sends no cookies.
- `/auth/logout` accepts either cookie, so it still works after the access token has expired, and it always clears both cookies.
- The first admin is created by a seed script, not by an endpoint. Password recovery uses `/auth/forgot-password` and `/auth/reset-password`.
### 1.2 Response envelope
```jsonc
// Success (single)        // Success (list)
{ "data": { } }            { "data": [ ], "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input",
             "details": [ { "path": "email", "message": "Invalid email" } ],
             "requestId": "b1c2…" } }
```
### 1.3 Error codes
| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Schema or business validation failed (`details[]` lists fields) |
| 401 | `UNAUTHENTICATED` | Missing, expired or invalid session |
| 403 | `FORBIDDEN` | Origin check failed or role not allowed |
| 404 | `NOT_FOUND` | Missing, or unpublished on the public API |
| 409 | `CONFLICT` | Duplicate slug, invalid state transition, item in use |
| 413 | `FILE_TOO_LARGE` | Upload over 5 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not JPEG, PNG or WebP |
| 423 | `ACCOUNT_LOCKED` | 5 failed logins; includes `retryAfterSeconds` |
| 429 | `RATE_LIMITED` | Too many requests; `Retry-After` header set |
| 500 | `INTERNAL_ERROR` | Generic message only |
### 1.4 Rate limits
| Scope | Limit |
|---|---|
| `POST /auth/login` | 5 / 15 min per IP + email |
| `POST /public/inquiries` | 5 / hour per IP |
| Other `/public/**` | 300 / 15 min per IP |
| `POST /auth/forgot-password` | 3 / hour per IP + email |
| `/admin/**` | 1000 / 15 min per admin |
| Server-to-server calls from Next.js (header `x-internal-secret`) | Not rate limited |
Responses include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

The API sits behind the Next.js rewrite and a reverse proxy, so limits use the visitor IP from `X-Forwarded-For` (trusted proxy). Next.js must forward the visitor IP on its own server-side fetches and send `x-internal-secret`, otherwise SSR/ISR traffic would share one IP and trip the public limit.
### 1.5 Pagination, sorting, filtering
`?page=1&pageSize=20&sort=createdAt:desc&q=text`. Public list default `pageSize=9`, max 50. Admin default 20, max 100.
### 1.6 Caching
- Public `GET` responses carry `ETag` and `Cache-Control: public, max-age=60, stale-while-revalidate=300`. Send `If-None-Match` to get `304 Not Modified`.
- `/health`, `/auth/**` and `/admin/**` responses carry `Cache-Control: no-store`.
### 1.7 Rich content
- Only blog bodies are rich text. The admin editor (Tiptap) sends `contentJson` only. The server validates it against the allowed node types and link protocols, generates sanitized HTML from it, and stores both.
- Public blog detail returns one format, chosen by `?format=html` (default, field `contentHtml`) or `?format=json` (field `contentJson`). The website uses `html`, the mobile app uses `json`.
- Short text fields (`description` on services and projects, `answer` on FAQs) are plain text. A blank line starts a new paragraph. No markup.
- Image URLs inside content and in `MediaRef` are absolute.
### 1.8 Partial updates
`PATCH` accepts any subset of the matching `*Input` fields. `required` in an `*Input` schema applies to `POST` only. An omitted field is unchanged, and `null` clears a nullable field.
### 1.9 Ordering
Services, projects, testimonials and FAQs have an integer `sortOrder` (lower first, ties by `createdAt`), set through `POST`/`PATCH`. There are no reorder endpoints.
---
## 2. Endpoint Index
### Public
| Method | Path | Purpose | Ref |
|---|---|---|---|
| GET | `/health` | Liveness + DB check | NFR-9 |
| GET | `/public/hero` | Published hero (or default flag) | FR-H-1 |
| GET | `/public/services` · `/public/services/{slug}` | Published services | FR-SV-* |
| GET | `/public/projects` · `/public/projects/{slug}` | Published projects | FR-PF-* |
| GET | `/public/blogs` · `/public/blogs/{slug}` | Published blogs | FR-BL-* |
| GET | `/public/categories` · `/public/tags` | Taxonomy with counts | FR-BL-2 |
| GET | `/public/testimonials` · `/public/faqs` | Published items | FR-H-7, FR-FQ-1 |
| GET | `/public/sitemap-entries` | Slugs + lastModified | FR-G-7 |
| POST | `/public/inquiries` | Contact / project inquiry | FR-CT-*, FR-PI-* |
### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Sign in, set cookies |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke session (works with either cookie) |
| GET | `/auth/me` | Current admin |
| POST | `/auth/change-password` | Change own password |
| POST | `/auth/forgot-password` | Email a reset link (always 204) |
| POST | `/auth/reset-password` | Set a new password with the emailed token |
### Admin
| Resource | Endpoints |
|---|---|
| Dashboard | `GET /admin/dashboard/stats` |
| Hero | `GET, POST /admin/hero` · `GET, PATCH, DELETE /admin/hero/{id}` · `POST /admin/hero/{id}/publish` · `POST /admin/hero/{id}/unpublish` |
| Blogs | `GET, POST /admin/blogs` · `GET, PATCH, DELETE /admin/blogs/{id}` · `POST …/publish` · `…/unpublish` · `GET /admin/blogs/slug-available` · `GET /admin/blogs/{id}/preview` |
| Categories / Tags / Authors | `GET, POST /admin/{categories\|tags\|authors}` · `PATCH, DELETE /admin/{…}/{id}` |
| Inquiries | `GET /admin/inquiries` · `GET, DELETE /admin/inquiries/{id}` · `PATCH …/status` · `POST …/replies` · `POST …/replies/{replyId}/retry` |
| Projects / Services / Testimonials / FAQs | `GET, POST /admin/{resource}` · `GET, PATCH, DELETE /admin/{resource}/{id}` · publish toggle and order via `PATCH` (`isPublished`, `sortOrder`) |
| Media | `POST, GET /admin/media` · `PATCH, DELETE /admin/media/{id}` |
| Audit | `GET /admin/audit-logs` |
### Internal (NestJS → Next.js)
| Method | Path | Purpose |
|---|---|---|
| POST | `{web}/api/revalidate` | Header `x-revalidate-secret`; body `{ "tags": ["blogs","blog:slug"] }`. Retried 3 times with backoff; a final failure is written to the audit log (`revalidate.failed`). |
---
## 3. OpenAPI 3.0 Specification
```yaml
openapi: 3.0.3
info:
  title: ZoyCoders Website & Admin API
  version: 1.0.0
  description: >
    REST API for the ZoyCoders public website, mobile app and admin panel.
    Business rules are documented in Business.md (BL-*).
servers:
  - url: https://zoycoders.com/api/v1
    description: Production (same-origin through Next.js rewrite)
  - url: http://localhost:4000/api/v1
    description: Local development
tags:
  - { name: Health }
  - { name: Public }
  - { name: Auth }
  - { name: Admin - Dashboard }
  - { name: Admin - Hero }
  - { name: Admin - Blogs }
  - { name: Admin - Taxonomy }
  - { name: Admin - Inquiries }
  - { name: Admin - Content }
  - { name: Admin - Media }
  - { name: Admin - Audit }
security:
  - cookieAuth: []
paths:
  # ───────────────────────── Health ─────────────────────────
  /health:
    get:
      tags: [Health]
      summary: Liveness and database check
      security: []
      responses:
        '200':
          description: Healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      status: { type: string, example: ok }
                      db: { type: string, example: up }
                      uptimeSeconds: { type: integer }
        '503': { $ref: '#/components/responses/InternalError' }
  # ───────────────────────── Public ─────────────────────────
  /public/hero:
    get:
      tags: [Public]
      summary: Currently published hero
      description: Returns `isDefault=true` with built-in copy when no hero is published (BL-H5).
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/PublicHero' }
  /public/services:
    get:
      tags: [Public]
      summary: List published services (ordered by sortOrder)
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/PublicService' }
  /public/services/{slug}:
    get:
      tags: [Public]
      summary: Service detail
      security: []
      parameters: [ { $ref: '#/components/parameters/Slug' } ]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/PublicService' }
        '404': { $ref: '#/components/responses/NotFound' }
  /public/projects:
    get:
      tags: [Public]
      summary: List published projects
      security: []
      parameters:
        - { name: featured, in: query, schema: { type: boolean }, description: "Home page uses featured=true (max 6)" }
        - { name: technology, in: query, schema: { type: string } }
        - { $ref: '#/components/parameters/Page' }
        - { $ref: '#/components/parameters/PageSize' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/ProjectSummary' }
                  meta: { $ref: '#/components/schemas/PageMeta' }
  /public/projects/{slug}:
    get:
      tags: [Public]
      summary: Project detail
      security: []
      parameters: [ { $ref: '#/components/parameters/Slug' } ]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/PublicProject' }
        '404': { $ref: '#/components/responses/NotFound' }
  /public/blogs:
    get:
      tags: [Public]
      summary: List published blogs (newest first)
      security: []
      parameters:
        - { name: category, in: query, schema: { type: string }, description: Category slug }
        - { name: tag, in: query, schema: { type: string }, description: Tag slug }
        - { name: q, in: query, schema: { type: string, maxLength: 100 }, description: Searches title and excerpt }
        - { $ref: '#/components/parameters/Page' }
        - { $ref: '#/components/parameters/PageSize' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/BlogSummary' }
                  meta: { $ref: '#/components/schemas/PageMeta' }
  /public/blogs/{slug}:
    get:
      tags: [Public]
      summary: Blog detail with related posts
      description: >
        Returns `contentHtml` when `format=html` (default) or `contentJson` when `format=json`, never both.
        If the slug was renamed, returns 200 with `{ "data": { "redirectTo": "<new-slug>" } }`
        and the client navigates to the new slug.
      security: []
      parameters:
        - { $ref: '#/components/parameters/Slug' }
        - { name: format, in: query, schema: { type: string, enum: [html, json], default: html } }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    oneOf:
                      - allOf:
                          - $ref: '#/components/schemas/Blog'
                          - type: object
                            properties:
                              related:
                                type: array
                                maxItems: 3
                                items: { $ref: '#/components/schemas/BlogSummary' }
                      - $ref: '#/components/schemas/BlogRedirect'
        '304': { description: Not modified (`ETag` matched) }
        '404': { $ref: '#/components/responses/NotFound' }
  /public/categories:
    get:
      tags: [Public]
      summary: Categories that have at least one published post
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/TaxonomyWithCount' }
  /public/tags:
    get:
      tags: [Public]
      summary: Tags that have at least one published post
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/TaxonomyWithCount' }
  /public/testimonials:
    get:
      tags: [Public]
      summary: Published testimonials (max 6, ordered)
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/PublicTestimonial' }
  /public/faqs:
    get:
      tags: [Public]
      summary: Published FAQs
      security: []
      parameters:
        - { name: home, in: query, schema: { type: boolean }, description: Only show_on_home items (max 6) }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/PublicFaq' }
  /public/sitemap-entries:
    get:
      tags: [Public]
      summary: URLs for sitemap.xml
      security: []
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      blogs:      { type: array, items: { $ref: '#/components/schemas/SitemapEntry' } }
                      projects:   { type: array, items: { $ref: '#/components/schemas/SitemapEntry' } }
                      categories: { type: array, items: { $ref: '#/components/schemas/SitemapEntry' } }
                      tags:       { type: array, items: { $ref: '#/components/schemas/SitemapEntry' } }
  /public/inquiries:
    post:
      tags: [Public]
      summary: Submit a contact or project inquiry
      description: >
        Rules BL-I1…I8. If the honeypot is filled or `renderedAt` shows a submit in under 3 seconds,
        the API still returns 201 but stores nothing. Identical email + message within 10 minutes
        is treated as a duplicate (201, no new record), so a mobile retry after a network failure is safe.
        `website` and `renderedAt` are optional (the mobile app may omit them). Both are weak signals;
        the rate limit does the real work.
        After the inquiry is stored, the API emails the admin address(es) from `ADMIN_NOTIFY_EMAIL` (§4).
        A mail failure never fails this request. Spam and duplicates send no email.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/InquiryCreate' }
            examples:
              contact:
                value:
                  type: CONTACT
                  name: Priya Sharma
                  email: priya@example.com
                  subject: Pricing for a web app
                  message: Hi, we would like to build an MVP web app. Can you share a rough estimate?
                  source: WEB
                  website: ""
                  renderedAt: 1761400000000
              project:
                value:
                  type: PROJECT
                  name: Rahul Verma
                  email: rahul@example.com
                  company: Acme Pvt Ltd
                  serviceInterest: web-application-development
                  budgetRange: 5K_15K
                  timeline: 1_3_MONTHS
                  message: We need a customer portal with role-based access and reporting dashboards.
                  source: MOBILE
      responses:
        '201':
          description: Accepted
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      message: { type: string, example: "Thanks! We usually reply within 1 business day." }
        '400': { $ref: '#/components/responses/ValidationError' }
        '429': { $ref: '#/components/responses/RateLimited' }
  # ───────────────────────── Auth ─────────────────────────
  /auth/login:
    post:
      tags: [Auth]
      summary: Admin login
      description: Sets `zc_access` and `zc_refresh` cookies. Lockout after 5 failures for 15 minutes (BL-A2).
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string, format: password }
      responses:
        '200':
          description: Logged in
          headers:
            Set-Cookie:
              schema: { type: string }
              description: "zc_access=…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900  and  zc_refresh=…; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=604800"
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Admin' }
        '401':
          description: Generic "Invalid email or password"
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
        '423':
          description: Account locked
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Error'
                  - type: object
                    properties:
                      error:
                        type: object
                        properties:
                          retryAfterSeconds: { type: integer, example: 840 }
        '429': { $ref: '#/components/responses/RateLimited' }
  /auth/refresh:
    post:
      tags: [Auth]
      summary: Rotate refresh token and issue a new access token
      description: Reuse of an already-rotated token revokes the whole token family (BL-A3).
      security: [ { refreshCookie: [] } ]
      responses:
        '200':
          description: New cookies set
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Admin' }
        '401': { $ref: '#/components/responses/Unauthenticated' }
  /auth/logout:
    post:
      tags: [Auth]
      summary: Revoke current session and clear cookies
      description: Accepts either cookie, so it works after the access token expired. Always clears both cookies.
      security: [ { cookieAuth: [] }, { refreshCookie: [] } ]
      responses:
        '204': { description: Logged out }
  /auth/me:
    get:
      tags: [Auth]
      summary: Current admin
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Admin' }
        '401': { $ref: '#/components/responses/Unauthenticated' }
  /auth/change-password:
    post:
      tags: [Auth]
      summary: Change own password (revokes other sessions, BL-A5)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [currentPassword, newPassword]
              properties:
                currentPassword: { type: string, format: password }
                newPassword: { type: string, format: password, minLength: 10 }
      responses:
        '204': { description: Changed }
        '400': { $ref: '#/components/responses/ValidationError' }
        '401': { $ref: '#/components/responses/Unauthenticated' }
  /auth/forgot-password:
    post:
      tags: [Auth]
      summary: Email a password-reset link
      description: >
        Always returns 204, whether or not the email belongs to an admin.
        The emailed link is single-use and valid for 30 minutes.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email: { type: string, format: email }
      responses:
        '204': { description: Accepted }
        '429': { $ref: '#/components/responses/RateLimited' }
  /auth/reset-password:
    post:
      tags: [Auth]
      summary: Set a new password with the emailed token
      description: Revokes every session of that admin and clears any login lock. An invalid or expired token is a 400 with `details[].path = token`.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token, newPassword]
              properties:
                token: { type: string }
                newPassword: { type: string, format: password, minLength: 10 }
      responses:
        '204': { description: Password changed }
        '400': { $ref: '#/components/responses/ValidationError' }
        '429': { $ref: '#/components/responses/RateLimited' }
  # ───────────────────────── Admin: Dashboard ─────────────────────────
  /admin/dashboard/stats:
    get:
      tags: [Admin - Dashboard]
      summary: Dashboard counters, latest inquiries and activity
      description: Polled by the admin UI every 60 seconds. Also drives the sidebar badge (`newInquiries`).
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/DashboardStats' }
        '401': { $ref: '#/components/responses/Unauthenticated' }
  # ───────────────────────── Admin: Hero ─────────────────────────
  /admin/hero:
    get:
      tags: [Admin - Hero]
      summary: List hero records (published one first)
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Hero' } }
    post:
      tags: [Admin - Hero]
      summary: Create hero (status DRAFT)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/HeroInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Hero' }
        '400': { $ref: '#/components/responses/ValidationError' }
  /admin/hero/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: [Admin - Hero]
      summary: Get hero
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Hero' }
        '404': { $ref: '#/components/responses/NotFound' }
    patch:
      tags: [Admin - Hero]
      summary: Update hero (editing the published hero revalidates the site)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/HeroInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Hero' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '404': { $ref: '#/components/responses/NotFound' }
    delete:
      tags: [Admin - Hero]
      summary: Delete hero (not allowed while published, BL-H4)
      responses:
        '204': { description: Deleted }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/hero/{id}/publish:
    post:
      tags: [Admin - Hero]
      summary: Publish hero; the previously published hero becomes DRAFT (BL-H2)
      parameters: [ { $ref: '#/components/parameters/Id' } ]
      responses:
        '200':
          description: Published
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Hero' }
        '400': { $ref: '#/components/responses/ValidationError' }
  /admin/hero/{id}/unpublish:
    post:
      tags: [Admin - Hero]
      summary: Unpublish hero (site falls back to default hero)
      parameters: [ { $ref: '#/components/parameters/Id' } ]
      responses:
        '200':
          description: Unpublished
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Hero' }
  # ───────────────────────── Admin: Blogs ─────────────────────────
  /admin/blogs:
    get:
      tags: [Admin - Blogs]
      summary: List all blogs
      parameters:
        - { name: status, in: query, schema: { $ref: '#/components/schemas/BlogStatus' } }
        - { name: categoryId, in: query, schema: { type: string, format: uuid } }
        - { name: q, in: query, schema: { type: string } }
        - { name: sort, in: query, schema: { type: string, example: "updatedAt:desc" } }
        - { $ref: '#/components/parameters/Page' }
        - { $ref: '#/components/parameters/PageSizeAdmin' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/AdminBlogRow' } }
                  meta: { $ref: '#/components/schemas/PageMeta' }
    post:
      tags: [Admin - Blogs]
      summary: Create blog draft (only title required)
      description: Minimum lengths (title 5, excerpt 50, seoDescription 50) and the rest of the BL-B3 checklist are enforced at publish, not when saving a draft.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BlogInput' }
      responses:
        '201':
          description: Created as DRAFT
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/AdminBlog' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/blogs/slug-available:
    get:
      tags: [Admin - Blogs]
      summary: Check slug availability (BL-B2)
      parameters:
        - { name: slug, in: query, required: true, schema: { type: string } }
        - { name: excludeId, in: query, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      available: { type: boolean }
                      suggestion: { type: string, nullable: true, example: my-post-2 }
  /admin/blogs/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: [Admin - Blogs]
      summary: Get blog for editing
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/AdminBlog' }
        '404': { $ref: '#/components/responses/NotFound' }
    patch:
      tags: [Admin - Blogs]
      summary: Update blog (HTML is generated and sanitized server-side from `contentJson`; renaming the slug of a previously published blog keeps the old slug as a redirect, BL-B6)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BlogInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/AdminBlog' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '409': { $ref: '#/components/responses/Conflict' }
    delete:
      tags: [Admin - Blogs]
      summary: Delete blog (only while DRAFT, BL-B7)
      responses:
        '204': { description: Deleted }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/blogs/{id}/publish:
    post:
      tags: [Admin - Blogs]
      summary: Publish blog (runs the BL-B3 checklist; `publishedAt` set on first publish only)
      parameters: [ { $ref: '#/components/parameters/Id' } ]
      responses:
        '200':
          description: Published
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/AdminBlog' }
        '400':
          description: Checklist failed; `details` lists every missing field
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/blogs/{id}/unpublish:
    post:
      tags: [Admin - Blogs]
      summary: Unpublish blog (status becomes DRAFT)
      parameters: [ { $ref: '#/components/parameters/Id' } ]
      responses:
        '200':
          description: Unpublished
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/AdminBlog' }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/blogs/{id}/preview:
    get:
      tags: [Admin - Blogs]
      summary: Render-ready draft preview (same shape as public Blog; never cached or indexed)
      parameters: [ { $ref: '#/components/parameters/Id' } ]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Blog' }
  # ───────────────────────── Admin: Taxonomy ─────────────────────────
  /admin/categories:
    get:
      tags: [Admin - Taxonomy]
      summary: List categories with post counts
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/TaxonomyWithCount' } }
    post:
      tags: [Admin - Taxonomy]
      summary: Create category
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TaxonomyInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/TaxonomyWithCount' }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/categories/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    patch:
      tags: [Admin - Taxonomy]
      summary: Update category
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TaxonomyInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/TaxonomyWithCount' }
    delete:
      tags: [Admin - Taxonomy]
      summary: Delete category (409 if in use, BL-T2)
      responses:
        '204': { description: Deleted }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/tags:
    get:
      tags: [Admin - Taxonomy]
      summary: List tags with post counts
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/TaxonomyWithCount' } }
    post:
      tags: [Admin - Taxonomy]
      summary: Create tag
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TaxonomyInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/TaxonomyWithCount' }
  /admin/tags/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    patch:
      tags: [Admin - Taxonomy]
      summary: Update tag
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TaxonomyInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/TaxonomyWithCount' }
    delete:
      tags: [Admin - Taxonomy]
      summary: Delete tag and detach it from all blogs (BL-T3)
      responses:
        '204': { description: Deleted }
  /admin/authors:
    get:
      tags: [Admin - Taxonomy]
      summary: List authors
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Author' } }
    post:
      tags: [Admin - Taxonomy]
      summary: Create author
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AuthorInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Author' }
  /admin/authors/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    patch:
      tags: [Admin - Taxonomy]
      summary: Update author
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AuthorInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Author' }
    delete:
      tags: [Admin - Taxonomy]
      summary: Delete author (409 if linked to blogs, BL-T4)
      responses:
        '204': { description: Deleted }
        '409': { $ref: '#/components/responses/Conflict' }
  # ───────────────────────── Admin: Inquiries ─────────────────────────
  /admin/inquiries:
    get:
      tags: [Admin - Inquiries]
      summary: List inquiries
      parameters:
        - { name: status, in: query, schema: { $ref: '#/components/schemas/InquiryStatus' } }
        - { name: type, in: query, schema: { $ref: '#/components/schemas/InquiryType' } }
        - { name: q, in: query, schema: { type: string }, description: Name, email or subject }
        - { name: sort, in: query, schema: { type: string, example: "createdAt:desc" } }
        - { $ref: '#/components/parameters/Page' }
        - { $ref: '#/components/parameters/PageSizeAdmin' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/InquirySummary' } }
                  meta: { $ref: '#/components/schemas/PageMeta' }
  /admin/inquiries/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: [Admin - Inquiries]
      summary: Inquiry detail with reply history (viewing does not change status, BL-I9)
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Inquiry' }
        '404': { $ref: '#/components/responses/NotFound' }
    delete:
      tags: [Admin - Inquiries]
      summary: Delete an inquiry and its replies (audited)
      responses:
        '204': { description: Deleted }
        '404': { $ref: '#/components/responses/NotFound' }
  /admin/inquiries/{id}/status:
    patch:
      tags: [Admin - Inquiries]
      summary: Change status (NEW ⇄ IN_PROGRESS, REPLIED → IN_PROGRESS). REPLIED cannot be set manually (BL-I10).
      parameters: [ { $ref: '#/components/parameters/Id' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [status]
              properties:
                status: { type: string, enum: [NEW, IN_PROGRESS] }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Inquiry' }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/inquiries/{id}/replies:
    post:
      tags: [Admin - Inquiries]
      summary: Send an email reply (BL-I11…I12)
      description: >
        Flow: store reply as PENDING → send through the email provider (10 s timeout) →
        SENT (inquiry becomes REPLIED) or FAILED (inquiry unchanged). The HTTP status is
        201 either way; read `data.reply.deliveryStatus` and `data.reply.errorMessage` to show success or failure.
        Project inquiries have no subject, so the client should prefill "Re: Your project inquiry".
      parameters: [ { $ref: '#/components/parameters/Id' } ]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [subject, body]
              properties:
                subject: { type: string, minLength: 3, maxLength: 150, example: "Re: Pricing for a web app" }
                body: { type: string, minLength: 10, maxLength: 10000 }
      responses:
        '201':
          description: Reply recorded
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      reply: { $ref: '#/components/schemas/InquiryReply' }
                      inquiryStatus: { $ref: '#/components/schemas/InquiryStatus' }
        '400': { $ref: '#/components/responses/ValidationError' }
  /admin/inquiries/{id}/replies/{replyId}/retry:
    post:
      tags: [Admin - Inquiries]
      summary: Retry a FAILED reply (max 3 attempts, BL-I13)
      parameters:
        - { $ref: '#/components/parameters/Id' }
        - { name: replyId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: Retry result
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      reply: { $ref: '#/components/schemas/InquiryReply' }
                      inquiryStatus: { $ref: '#/components/schemas/InquiryStatus' }
        '409': { $ref: '#/components/responses/Conflict' }
  # ───────────────────────── Admin: Content (projects/services/testimonials/faqs) ─────────────────────────
  /admin/projects:
    get:
      tags: [Admin - Content]
      summary: List projects
      parameters:
        - { name: published, in: query, schema: { type: boolean } }
        - { name: q, in: query, schema: { type: string } }
        - { $ref: '#/components/parameters/Page' }
        - { $ref: '#/components/parameters/PageSizeAdmin' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Project' } }
                  meta: { $ref: '#/components/schemas/PageMeta' }
    post:
      tags: [Admin - Content]
      summary: Create project
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ProjectInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Project' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/projects/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: [Admin - Content]
      summary: Get project
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Project' }
    patch:
      tags: [Admin - Content]
      summary: Update project (set `isPublished` to publish / unpublish; BL-C1)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ProjectInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Project' }
        '400': { $ref: '#/components/responses/ValidationError' }
    delete:
      tags: [Admin - Content]
      summary: Delete project
      responses:
        '204': { description: Deleted }
  /admin/services:
    get:
      tags: [Admin - Content]
      summary: List services
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Service' } }
    post:
      tags: [Admin - Content]
      summary: Create service
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ServiceInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Service' }
  /admin/services/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: [Admin - Content]
      summary: Get service
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Service' }
    patch:
      tags: [Admin - Content]
      summary: Update service (at least one must stay published, BL-C3)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ServiceInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Service' }
        '409': { $ref: '#/components/responses/Conflict' }
    delete:
      tags: [Admin - Content]
      summary: Delete service
      responses:
        '204': { description: Deleted }
        '409': { $ref: '#/components/responses/Conflict' }
  /admin/testimonials:
    get:
      tags: [Admin - Content]
      summary: List testimonials
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Testimonial' } }
    post:
      tags: [Admin - Content]
      summary: Create testimonial
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TestimonialInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Testimonial' }
  /admin/testimonials/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: [Admin - Content]
      summary: Get testimonial
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Testimonial' }
    patch:
      tags: [Admin - Content]
      summary: Update testimonial (publishing requires `clientApproved=true`, BL-C4)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TestimonialInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Testimonial' }
    delete:
      tags: [Admin - Content]
      summary: Delete testimonial
      responses:
        '204': { description: Deleted }
  /admin/faqs:
    get:
      tags: [Admin - Content]
      summary: List FAQs
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Faq' } }
    post:
      tags: [Admin - Content]
      summary: Create FAQ
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/FaqInput' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Faq' }
  /admin/faqs/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    get:
      tags: [Admin - Content]
      summary: Get FAQ
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Faq' }
    patch:
      tags: [Admin - Content]
      summary: Update FAQ (max 6 with `showOnHome`, BL-C5)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/FaqInput' }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Faq' }
    delete:
      tags: [Admin - Content]
      summary: Delete FAQ
      responses:
        '204': { description: Deleted }
  # ───────────────────────── Admin: Media ─────────────────────────
  /admin/media:
    get:
      tags: [Admin - Media]
      summary: List media
      parameters:
        - { name: q, in: query, schema: { type: string }, description: File name or alt text }
        - { $ref: '#/components/parameters/Page' }
        - { $ref: '#/components/parameters/PageSizeAdmin' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Media' } }
                  meta: { $ref: '#/components/schemas/PageMeta' }
    post:
      tags: [Admin - Media]
      summary: Upload image (JPEG/PNG/WebP, ≤ 5 MB; re-encoded to WebP at 320, 800 and 1600 px wide, EXIF stripped, BL-M1/M2)
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file, altText]
              properties:
                file: { type: string, format: binary }
                altText: { type: string, minLength: 5, maxLength: 150 }
      responses:
        '201':
          description: Uploaded
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Media' }
        '413': { $ref: '#/components/responses/FileTooLarge' }
        '415': { $ref: '#/components/responses/UnsupportedMedia' }
  /admin/media/{id}:
    parameters: [ { $ref: '#/components/parameters/Id' } ]
    patch:
      tags: [Admin - Media]
      summary: Update alt text
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [altText]
              properties:
                altText: { type: string, minLength: 5, maxLength: 150 }
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Media' }
    delete:
      tags: [Admin - Media]
      summary: Delete media (409 if still used by any content, BL-M4)
      responses:
        '204': { description: Deleted }
        '409': { $ref: '#/components/responses/Conflict' }
  # ───────────────────────── Admin: Audit ─────────────────────────
  /admin/audit-logs:
    get:
      tags: [Admin - Audit]
      summary: Read-only audit trail (BL-L1)
      parameters:
        - { name: entityType, in: query, schema: { type: string } }
        - { name: entityId, in: query, schema: { type: string, format: uuid } }
        - { name: adminId, in: query, schema: { type: string, format: uuid } }
        - { $ref: '#/components/parameters/Page' }
        - { $ref: '#/components/parameters/PageSizeAdmin' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/AuditLog' } }
                  meta: { $ref: '#/components/schemas/PageMeta' }
components:
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: zc_access
    refreshCookie:
      type: apiKey
      in: cookie
      name: zc_refresh
  parameters:
    Id:
      name: id
      in: path
      required: true
      schema: { type: string, format: uuid }
    Slug:
      name: slug
      in: path
      required: true
      schema: { type: string, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 80 }
    Page:
      name: page
      in: query
      schema: { type: integer, minimum: 1, default: 1 }
    PageSize:
      name: pageSize
      in: query
      description: Public lists. Default 9, max 50.
      schema: { type: integer, minimum: 1, maximum: 50, default: 9 }
    PageSizeAdmin:
      name: pageSize
      in: query
      description: Admin lists. Default 20, max 100.
      schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
  responses:
    ValidationError:
      description: Validation failed
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
          example:
            error:
              code: VALIDATION_ERROR
              message: Invalid input
              details: [ { path: email, message: Invalid email } ]
              requestId: 7d9f0a2e
    Unauthenticated:
      description: Missing or expired session
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    NotFound:
      description: Not found
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    Conflict:
      description: Duplicate slug, invalid state transition, or item in use
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    RateLimited:
      description: Too many requests
      headers:
        Retry-After: { schema: { type: integer } }
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    FileTooLarge:
      description: File exceeds 5 MB
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    UnsupportedMedia:
      description: Only JPEG, PNG and WebP are accepted
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    InternalError:
      description: Unexpected error (generic message)
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
  schemas:
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code: { type: string, example: NOT_FOUND }
            message: { type: string }
            details:
              type: array
              items:
                type: object
                properties:
                  path: { type: string }
                  message: { type: string }
            requestId: { type: string }
    PageMeta:
      type: object
      properties:
        page: { type: integer }
        pageSize: { type: integer }
        total: { type: integer }
        totalPages: { type: integer }
    Admin:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        email: { type: string, format: email }
        role: { type: string, enum: [ADMIN] }
        lastLoginAt: { type: string, format: date-time, nullable: true }
    MediaRef:
      type: object
      nullable: true
      properties:
        id: { type: string, format: uuid }
        url: { type: string, format: uri, description: Largest variant (1600 px wide) }
        variants:
          type: object
          properties:
            thumbnailUrl: { type: string, format: uri, description: 320 px wide }
            mediumUrl: { type: string, format: uri, description: 800 px wide }
        altText: { type: string }
        width: { type: integer }
        height: { type: integer }
    Media:
      allOf:
        - $ref: '#/components/schemas/MediaRef'
        - type: object
          properties:
            mimeType: { type: string, example: image/webp }
            sizeBytes: { type: integer }
            createdAt: { type: string, format: date-time }
    CtaLink:
      type: object
      properties:
        label: { type: string, maxLength: 30 }
        url: { type: string, description: "Starts with / or https://" }
    PublicHero:
      type: object
      properties:
        isDefault: { type: boolean }
        heading: { type: string }
        subheading: { type: string }
        primaryCta: { $ref: '#/components/schemas/CtaLink' }
        secondaryCta: { allOf: [ { $ref: '#/components/schemas/CtaLink' } ], nullable: true }
        image: { $ref: '#/components/schemas/MediaRef' }
    HeroStatus:
      type: string
      enum: [DRAFT, PUBLISHED]
    Hero:
      allOf:
        - $ref: '#/components/schemas/PublicHero'
        - type: object
          properties:
            id: { type: string, format: uuid }
            title: { type: string, description: Internal name }
            status: { $ref: '#/components/schemas/HeroStatus' }
            createdAt: { type: string, format: date-time }
            updatedAt: { type: string, format: date-time }
    HeroInput:
      type: object
      required: [title]
      properties:
        title: { type: string, maxLength: 80 }
        heading: { type: string, maxLength: 80 }
        subheading: { type: string, maxLength: 200 }
        primaryCta: { $ref: '#/components/schemas/CtaLink' }
        secondaryCta: { allOf: [ { $ref: '#/components/schemas/CtaLink' } ], nullable: true }
        imageId: { type: string, format: uuid, nullable: true }
    Service:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        slug: { type: string }
        icon: { type: string, example: code }
        shortDescription: { type: string }
        description: { type: string, description: Plain text }
        technologies: { type: array, items: { type: string } }
        seoTitle: { type: string, nullable: true }
        seoDescription: { type: string, nullable: true }
        ogImage: { $ref: '#/components/schemas/MediaRef' }
        sortOrder: { type: integer }
        isPublished: { type: boolean }
    PublicService:
      type: object
      description: "`seoTitle` and `seoDescription` are resolved by the server (fall back to `title` and `shortDescription`)."
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        slug: { type: string }
        icon: { type: string }
        shortDescription: { type: string }
        description: { type: string }
        technologies: { type: array, items: { type: string } }
        seoTitle: { type: string }
        seoDescription: { type: string }
        ogImage: { $ref: '#/components/schemas/MediaRef' }
    ServiceInput:
      type: object
      required: [title]
      properties:
        title: { type: string }
        slug: { type: string }
        icon: { type: string }
        shortDescription: { type: string, maxLength: 200 }
        description: { type: string }
        technologies: { type: array, items: { type: string } }
        seoTitle: { type: string, maxLength: 60 }
        seoDescription: { type: string, maxLength: 160 }
        ogImageId: { type: string, format: uuid, nullable: true }
        sortOrder: { type: integer, minimum: 0 }
        isPublished: { type: boolean }
    ProjectSummary:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        slug: { type: string }
        summary: { type: string }
        technologies: { type: array, items: { type: string } }
        coverImage: { $ref: '#/components/schemas/MediaRef' }
        isFeatured: { type: boolean }
    PublicProject:
      description: "`seoTitle` and `seoDescription` are resolved by the server (fall back to `title` and `summary`). `sourceUrl` and `clientName` are admin-only."
      allOf:
        - $ref: '#/components/schemas/ProjectSummary'
        - type: object
          properties:
            description: { type: string, description: Plain text }
            gallery:
              type: array
              items:
                type: object
                properties:
                  image: { $ref: '#/components/schemas/MediaRef' }
                  sortOrder: { type: integer }
            demoUrl: { type: string, format: uri, nullable: true }
            seoTitle: { type: string }
            seoDescription: { type: string }
            ogImage: { $ref: '#/components/schemas/MediaRef' }
            publishedAt: { type: string, format: date-time, nullable: true }
    Project:
      allOf:
        - $ref: '#/components/schemas/ProjectSummary'
        - type: object
          properties:
            description: { type: string, description: Plain text }
            gallery:
              type: array
              items:
                type: object
                properties:
                  image: { $ref: '#/components/schemas/MediaRef' }
                  sortOrder: { type: integer }
            demoUrl: { type: string, format: uri, nullable: true }
            sourceUrl: { type: string, format: uri, nullable: true }
            clientName: { type: string, nullable: true }
            seoTitle: { type: string, nullable: true }
            seoDescription: { type: string, nullable: true }
            ogImage: { $ref: '#/components/schemas/MediaRef' }
            isPublished: { type: boolean }
            sortOrder: { type: integer }
            publishedAt: { type: string, format: date-time, nullable: true }
    ProjectInput:
      type: object
      required: [title]
      properties:
        title: { type: string }
        slug: { type: string }
        summary: { type: string, maxLength: 200 }
        description: { type: string }
        technologies: { type: array, items: { type: string } }
        coverImageId: { type: string, format: uuid, nullable: true }
        galleryImageIds: { type: array, items: { type: string, format: uuid } }
        demoUrl: { type: string, format: uri, nullable: true }
        sourceUrl: { type: string, format: uri, nullable: true }
        clientName: { type: string, nullable: true }
        seoTitle: { type: string, maxLength: 60 }
        seoDescription: { type: string, maxLength: 160 }
        ogImageId: { type: string, format: uuid, nullable: true }
        sortOrder: { type: integer, minimum: 0 }
        isFeatured: { type: boolean }
        isPublished: { type: boolean }
    Testimonial:
      type: object
      properties:
        id: { type: string, format: uuid }
        clientName: { type: string }
        clientRole: { type: string, nullable: true }
        company: { type: string, nullable: true }
        quote: { type: string }
        avatar: { $ref: '#/components/schemas/MediaRef' }
        rating: { type: integer, minimum: 1, maximum: 5, nullable: true }
        clientApproved: { type: boolean }
        isPublished: { type: boolean }
        sortOrder: { type: integer }
    PublicTestimonial:
      type: object
      properties:
        id: { type: string, format: uuid }
        clientName: { type: string }
        clientRole: { type: string, nullable: true }
        company: { type: string, nullable: true }
        quote: { type: string }
        avatar: { $ref: '#/components/schemas/MediaRef' }
        rating: { type: integer, minimum: 1, maximum: 5, nullable: true }
    TestimonialInput:
      type: object
      required: [clientName, quote]
      properties:
        clientName: { type: string }
        clientRole: { type: string }
        company: { type: string }
        quote: { type: string, minLength: 20, maxLength: 600 }
        avatarId: { type: string, format: uuid, nullable: true }
        rating: { type: integer, minimum: 1, maximum: 5, nullable: true }
        sortOrder: { type: integer, minimum: 0 }
        clientApproved: { type: boolean }
        isPublished: { type: boolean }
    Faq:
      type: object
      properties:
        id: { type: string, format: uuid }
        question: { type: string }
        answer: { type: string, description: Plain text }
        group: { type: string, nullable: true }
        showOnHome: { type: boolean }
        isPublished: { type: boolean }
        sortOrder: { type: integer }
    PublicFaq:
      type: object
      properties:
        id: { type: string, format: uuid }
        question: { type: string }
        answer: { type: string }
        group: { type: string, nullable: true }
    FaqInput:
      type: object
      required: [question, answer]
      properties:
        question: { type: string, maxLength: 200 }
        answer: { type: string }
        group: { type: string }
        showOnHome: { type: boolean }
        sortOrder: { type: integer, minimum: 0 }
        isPublished: { type: boolean }
    BlogStatus:
      type: string
      enum: [DRAFT, PUBLISHED]
    Taxonomy:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        slug: { type: string }
        description: { type: string, nullable: true }
    TaxonomyWithCount:
      allOf:
        - $ref: '#/components/schemas/Taxonomy'
        - type: object
          properties:
            postCount: { type: integer }
    TaxonomyInput:
      type: object
      required: [name]
      properties:
        name: { type: string, maxLength: 60 }
        slug: { type: string }
        description: { type: string, maxLength: 300 }
    Author:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        slug: { type: string }
        bio: { type: string, nullable: true }
        avatar: { $ref: '#/components/schemas/MediaRef' }
    AuthorInput:
      type: object
      required: [name]
      properties:
        name: { type: string }
        slug: { type: string }
        bio: { type: string, maxLength: 500 }
        avatarId: { type: string, format: uuid, nullable: true }
    BlogSummary:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        slug: { type: string }
        excerpt: { type: string }
        coverImage: { $ref: '#/components/schemas/MediaRef' }
        category: { $ref: '#/components/schemas/Taxonomy' }
        author: { $ref: '#/components/schemas/Author' }
        readingTimeMin: { type: integer }
        publishedAt: { type: string, format: date-time }
    Blog:
      allOf:
        - $ref: '#/components/schemas/BlogSummary'
        - type: object
          properties:
            contentHtml: { type: string, description: Sanitized HTML. Present only when format=html }
            contentJson: { type: object, description: Tiptap document. Present only when format=json }
            tags: { type: array, items: { $ref: '#/components/schemas/Taxonomy' } }
            seoTitle: { type: string }
            seoDescription: { type: string }
            ogImage: { $ref: '#/components/schemas/MediaRef' }
            updatedAt: { type: string, format: date-time }
    AdminBlogRow:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        slug: { type: string }
        status: { $ref: '#/components/schemas/BlogStatus' }
        category: { $ref: '#/components/schemas/Taxonomy' }
        author: { $ref: '#/components/schemas/Author' }
        publishedAt: { type: string, format: date-time, nullable: true }
        updatedAt: { type: string, format: date-time }
    AdminBlog:
      allOf:
        - $ref: '#/components/schemas/AdminBlogRow'
        - type: object
          properties:
            excerpt: { type: string }
            contentHtml: { type: string, readOnly: true, description: Generated by the server from contentJson and sanitized }
            contentJson: { type: object, description: Editor document (Tiptap JSON) }
            coverImage: { $ref: '#/components/schemas/MediaRef' }
            tags: { type: array, items: { $ref: '#/components/schemas/Taxonomy' } }
            seoTitle: { type: string, nullable: true }
            seoDescription: { type: string, nullable: true }
            ogImage: { $ref: '#/components/schemas/MediaRef' }
            readingTimeMin: { type: integer }
            createdAt: { type: string, format: date-time }
    BlogRedirect:
      type: object
      properties:
        redirectTo: { type: string, description: Current slug of the renamed blog }
    BlogInput:
      type: object
      required: [title]
      description: Maximum lengths are enforced on every save. Minimum lengths (title 5, excerpt 50, seoDescription 50) are enforced at publish.
      properties:
        title: { type: string, maxLength: 120 }
        slug: { type: string, maxLength: 80 }
        excerpt: { type: string, maxLength: 300 }
        contentJson: { type: object, description: Tiptap document. The only content field the client sends; the server validates it and generates contentHtml }
        coverImageId: { type: string, format: uuid, nullable: true }
        categoryId: { type: string, format: uuid }
        tagIds: { type: array, maxItems: 10, items: { type: string, format: uuid } }
        authorId: { type: string, format: uuid }
        seoTitle: { type: string, maxLength: 60 }
        seoDescription: { type: string, maxLength: 160 }
        ogImageId: { type: string, format: uuid, nullable: true }
        publishedAt: { type: string, format: date-time, description: Only allowed in the past (BL-B5) }
    InquiryType:
      type: string
      enum: [CONTACT, PROJECT]
    InquiryStatus:
      type: string
      enum: [NEW, IN_PROGRESS, REPLIED]
    InquirySource:
      type: string
      enum: [WEB, MOBILE]
      default: WEB
    InquiryCreate:
      type: object
      required: [type, name, email, message]
      properties:
        type: { $ref: '#/components/schemas/InquiryType' }
        name: { type: string, minLength: 2, maxLength: 80 }
        email: { type: string, format: email, maxLength: 120 }
        subject: { type: string, minLength: 3, maxLength: 150, description: Required when type=CONTACT }
        message: { type: string, minLength: 10, maxLength: 5000 }
        company: { type: string, maxLength: 120 }
        phone: { type: string, maxLength: 30 }
        serviceInterest: { type: string, description: "Service slug or 'other'. Required when type=PROJECT" }
        budgetRange: { type: string, enum: [LT_1K, 1K_5K, 5K_15K, GT_15K, NOT_SURE] }
        timeline: { type: string, enum: [ASAP, 1_3_MONTHS, 3_6_MONTHS, FLEXIBLE] }
        source: { $ref: '#/components/schemas/InquirySource' }
        website: { type: string, description: Optional honeypot. Must be empty }
        renderedAt: { type: integer, format: int64, description: Optional. Epoch ms when the form rendered (min-fill-time check) }
        sourcePage: { type: string }
    InquirySummary:
      type: object
      properties:
        id: { type: string, format: uuid }
        type: { $ref: '#/components/schemas/InquiryType' }
        name: { type: string }
        email: { type: string, format: email }
        subject: { type: string, nullable: true }
        serviceInterest: { type: string, nullable: true }
        source: { $ref: '#/components/schemas/InquirySource' }
        status: { $ref: '#/components/schemas/InquiryStatus' }
        createdAt: { type: string, format: date-time }
    Inquiry:
      allOf:
        - $ref: '#/components/schemas/InquirySummary'
        - type: object
          properties:
            message: { type: string }
            company: { type: string, nullable: true }
            phone: { type: string, nullable: true }
            budgetRange: { type: string, nullable: true }
            timeline: { type: string, nullable: true }
            sourcePage: { type: string, nullable: true }
            replies:
              type: array
              items: { $ref: '#/components/schemas/InquiryReply' }
    InquiryReply:
      type: object
      properties:
        id: { type: string, format: uuid }
        subject: { type: string }
        body: { type: string }
        deliveryStatus: { type: string, enum: [PENDING, SENT, FAILED] }
        errorMessage: { type: string, nullable: true }
        attempts: { type: integer }
        sentAt: { type: string, format: date-time, nullable: true }
        sentBy: { type: object, properties: { id: { type: string, format: uuid }, name: { type: string } } }
        createdAt: { type: string, format: date-time }
    DashboardStats:
      type: object
      properties:
        newInquiries: { type: integer }
        inProgressInquiries: { type: integer }
        inquiriesLast30Days: { type: integer }
        failedReplies: { type: integer }
        publishedBlogs: { type: integer }
        draftBlogs: { type: integer }
        latestInquiries: { type: array, items: { $ref: '#/components/schemas/InquirySummary' } }
        recentActivity: { type: array, items: { $ref: '#/components/schemas/AuditLog' } }
    AuditLog:
      type: object
      properties:
        id: { type: string, format: uuid }
        admin: { type: object, nullable: true, description: 'Null for system actions such as notification.failed or revalidate.failed', properties: { id: { type: string, format: uuid }, name: { type: string } } }
        action: { type: string, example: blog.publish }
        entityType: { type: string }
        entityId: { type: string, format: uuid, nullable: true }
        metadata: { type: object }
        createdAt: { type: string, format: date-time }
    SitemapEntry:
      type: object
      properties:
        slug: { type: string }
        lastModified: { type: string, format: date-time }
```
---
## 4. Notifications and background work
There are no WebSockets. Everything below works over plain REST plus email.
### 4.1 New inquiry email to admins
| Item | Rule |
|---|---|
| Trigger | A valid, non-spam, non-duplicate `POST /public/inquiries` has been stored |
| Recipients | `ADMIN_NOTIFY_EMAIL` (one or more addresses, environment variable) |
| Content | Inquiry type, name, email, subject (or service of interest) and a link to `APP_URL/admin/inquiries/{id}`. The full message stays in the admin panel. |
| Timing | Sent after the database commit, outside the request. The visitor never waits for it. |
| Failure | Never fails or delays the inquiry request. Written to the audit log as `notification.failed` (admin is `null`). |
### 4.2 Admin dashboard refresh
The admin UI polls `GET /admin/dashboard/stats` every 60 seconds. The sidebar badge uses `newInquiries`.
### 4.3 Password reset email
`POST /auth/forgot-password` emails a single-use link (`APP_URL/admin/reset-password?token=…`, valid 30 minutes). The response is always `204`.
### 4.4 Site revalidation
After a publish, unpublish, delete or edit of published content, the API calls the Next.js revalidate endpoint (§2). It retries 3 times with backoff and logs a final failure as `revalidate.failed`.
---
## 5. Implementation Notes for Developers
1. **Contract:** §3 is the contract. Save it as `openapi.yaml` in the API repository. The NestJS DTOs and Swagger decorators must match it, and contract tests enforce that. The frontend generates its types from the same file with `openapi-typescript`.
2. **Swagger UI:** served by `@nestjs/swagger` at `/api/docs` in development and staging only. Disabled in production.
3. **Postman:** import the same file, and keep a "happy path + error path" collection per module (auth, blogs, inquiries, media).
4. **Contract tests:** Jest + Supertest run each documented status code (`200/201/204/304/400/401/404/409/413/415/429`). `jest-openapi` checks the actual responses against the spec.
5. **Field naming:** the API uses `camelCase`; database columns use `snake_case`. Prisma maps between them.
6. **Enum spelling:** a few value names (`LT_1K`, `1K_5K`, …) are the wire format. Frontend labels like "< $1k" are display-only.
7. **Slug redirects** exist for blogs only. A renamed blog slug returns `200` with `{ "data": { "redirectTo": "new-slug" } }`; the client then navigates to the new slug (Next.js uses `permanentRedirect()`).
8. **Static content:** Privacy Policy, Terms, About, development process and footer details are not served by the API. Each client (website and mobile) ships them.
9. **Admin accounts:** one seeded admin (`ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`). Admin user management is out of scope.
10. **Environment variables:** `APP_URL`, `DATABASE_URL`, `ADMIN_NOTIFY_EMAIL`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `JWT_SECRET`, `REVALIDATE_SECRET`, `INTERNAL_SECRET`, plus the email provider and storage credentials.
---
## 6. Changes from v1.0 (for the frontend)
| Area | Change | Frontend action |
|---|---|---|
| Realtime | WebSocket section and `/admin/ws-ticket` removed | Poll `GET /admin/dashboard/stats` every 60 s |
| Notifications | New inquiries email the admin (§4.1) | None |
| Mobile | `source` (`WEB` \| `MOBILE`) on inquiries; `website` and `renderedAt` are now optional | Send `source: WEB` from the website |
| Blog content | Client sends `contentJson` only; `contentHtml` is read-only and server-generated | Stop sending `contentHtml` |
| Blog content (public) | `GET /public/blogs/{slug}?format=html\|json`; one content field is returned | Website: default (`html`) |
| Short text | `descriptionHtml` → `description` (services, projects), `answerHtml` → `answer` (FAQs). Plain text. | Render as paragraphs, not HTML |
| Blog status | `UNPUBLISHED` removed, `DRAFT`/`PUBLISHED` only; `POST /admin/blogs/{id}/draft` removed; unpublish returns the blog to `DRAFT`; delete only while `DRAFT` | Update status badges and actions |
| Draft saving | Minimum lengths are enforced at publish only | Show min-length errors on publish |
| PATCH | Partial updates, `required` applies to `POST` only | Send only changed fields |
| Public shapes | Separate `Public*` schemas. Internal fields (`isPublished`, `sortOrder`, `clientApproved`) are gone. Projects hide `clientName` and `sourceUrl`. | Do not read them on public pages |
| SEO | `seoTitle`, `seoDescription`, `ogImage` added to services and projects; public responses are resolved with fallbacks | Use them for page metadata |
| Slug redirects | Blogs only, as `200` + `redirectTo`; projects and services have none | Navigate when `redirectTo` is present |
| Ordering | All four `…/reorder` endpoints removed; use `sortOrder` in `PATCH` | Save order per item |
| Media | `GET /admin/media/{id}` (usages) removed; delete still returns `409` while in use; images come in 320/800/1600 px (`variants`) | Use `variants` for smaller images |
| Inquiries | CSV export removed; `DELETE /admin/inquiries/{id}` added | Add a delete action |
| Reply failure | `502 EMAIL_PROVIDER_ERROR` removed; the reply returns `201` with `deliveryStatus` | Read `data.reply.deliveryStatus` |
| Auth | `POST /auth/forgot-password` and `/auth/reset-password` added; logout works with either cookie | Add the reset pages |
| Audit | Kept. `admin` can be `null` for system actions | Handle a missing admin name |
| Caching | `ETag` and `Cache-Control` on public GETs, `no-store` elsewhere | Fetch with revalidation, not forced no-cache |
| Rate limits | Visitor IP read from `X-Forwarded-For`; Next.js server calls send `x-internal-secret` | Forward the visitor IP and the header |
| Stack | NestJS, PostgreSQL, Prisma | None |
### Needs updating in `Business.md`
Rules touching blog status and deletion (`BL-B6`, `BL-B7`), reordering (`BL-C6`), media usage (`BL-M4`) and the reply error flow (`BL-I11…I13`) no longer match this contract. The backend developer has not seen `Business.md`, `Functional.md` or `Architecture.md`, so please share them.
