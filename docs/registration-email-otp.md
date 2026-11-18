# Email OTP activation for Serula registrations

New **email/password** registrations must verify their email before Serula creates an authenticated session. The OTP form follows the supplied rounded white-card design.

## Flow
1. POST `/api/auth/register` with email, name, password and locale. If the `EMAIL` binding is unavailable, responds 503 without creating an account. Otherwise creates a user and an `email_verifications` pending row, emails a six-digit code, and responds 202 with a fresh 256-bit `challenge`. **No session cookie is set.**
2. POST `/api/auth/verify-email` with `email`, `challenge`, and the six-digit `code`. On success the pending row is atomically removed and a normal session is created. A reused OTP cannot be replayed.
3. Pending email/password logins do not receive a session. Instead, a fresh email code is issued (subject to cooldown), and the client displays the OTP step.
4. POST `/api/auth/resend-verification` requires the correct account password and enforces limits before issuing a new challenge; old challenges become invalid.
5. Google logins already have a provider-verified email claim. Valid Google identities do not need a second email OTP; a matching pending account is activated by that trusted claim.

## Security
- Code validity: **10 minutes**.
- Wrong code limit: **5 attempts per issued code**.
- Resend cooldown: **60 seconds**.
- Resends: **5 per 60-minute window** including initial code.
- The D1 table stores only `SHA-256(challenge)` and `SHA-256(challenge + ':' + otp)`, not the OTP or raw challenge.
- Same-origin request checks still apply; successful verification creates a secure, HttpOnly, SameSite session cookie.
- All previously registered accounts without a pending row retain their existing access. No bulk account disablement or backfill occurs.
- Existing sessions cannot access protected APIs for a user while that account has an outstanding pending-verification marker.
- If email sending fails, the account remains pending and cannot access member APIs.
- The user-facing code entry is six individual fields with keyboard navigation and paste support.

## Production prerequisites
The verified `serula.site` domain is configured in **Resend**. Create a restricted **Sending access** API key at https://resend.com/api-keys. In the Cloudflare dashboard choose Workers & Pages → **nesting** → Settings → Variables and Secrets → Add, set **Type: Secret**, name `RESEND_API_KEY`, and paste the key there. Do not paste the key in a chat, GitHub commit, issue, or Wrangler config. `web/wrangler.jsonc` intentionally does not request Cloudflare's paid `send_email` binding. The Worker posts mail from `noreply@serula.site` to `https://api.resend.com/emails`; the secret is accessed only server-side. Registration fails closed if no configured sender exists.

Before merging, run a real inbox delivery smoke test in staging with a disposable new mailbox, including wrong OTP, correct OTP, expiry, resend, and login. **Do not deploy production until `RESEND_API_KEY` is configured and delivery is verified.** Tests use a mock email provider and do not send mail to real users.

## QA
`npm run build`, `npm test`, and `npx playwright test tests/email-otp-ui.spec.ts`. New tests cover activation gate, incorrect/expired/replayed codes, resend rate limits, mail-provider failure, legacy session isolation and responsive OTP form.
