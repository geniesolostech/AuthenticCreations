# Launch runbook — Authentic Creations

Everything between "the code is finished" and "authenticcreationsco.com is
live", in the order it has to happen. No code changes are required by anything
below: this is all accounts, credentials, and configuration.

**On secrets.** This file names environment variables and says where their
values come from. It never contains a value, and neither does the repository.
Tokens are typed straight into the Amplify console (or the terminal) and
nowhere else — treat the Square production token exactly like the password to
CJ's bank account, because in practice it is.

**Roughly how long.** Steps 1–3 take an afternoon with CJ, mostly because
building the Square catalog is careful work. Steps 4–7 take about an hour, plus
up to 48 hours of waiting for domain registration.

---

## 0. What you need before you start

| Thing | Who owns it | Notes |
|---|---|---|
| AWS account | Developer | Billing set up; ~$3–8/month at this scale |
| Square account | **CJ** | Her real business account — this is where the money lands |
| Square developer application | Developer, inside CJ's account | Gives Sandbox + production tokens |
| Sanity account | Developer, then invite CJ | Free tier is plenty |
| GitHub repository | Developer | Amplify deploys from `main` |
| Card for the domain | Whoever pays | ~$13/year |

Local development needs none of it. `SANITY_FAKE=1 SQUARE_FAKE=1 npm run dev`
runs the whole site — shop, cart, checkout handoff, blog, circles — on in-repo
fixture data with no accounts and no credentials at all.

---

## 1. Sanity: create the project and fill it

### 1.1 Create the project

From the repository root:

```bash
npx sanity init
```

Answer as follows:

- **Login** — pick a provider and sign in (or create an account).
- **Create new project** → name it `Authentic Creations`.
- **Use the default dataset configuration?** → yes (`production`).
- **Project output path** — accept the default; the Studio already lives in
  this repo at `/studio`, so nothing new is scaffolded.

It prints a **project ID** (a short string like `abc12xyz`). Copy it.

### 1.2 Create a write token

The RSVP endpoint is the only thing that writes to Sanity, and it needs a token.

1. Go to <https://www.sanity.io/manage> and open the project.
2. **API** → **Tokens** → **Add API token**.
3. Name it `authentic-creations-site-write`, permission **Editor**, **Save**.
4. Copy the value **now** — Sanity shows it exactly once.

### 1.3 Allow the Studio's origins

Still under **API**, in **CORS origins**, add both with *Allow credentials*
checked:

- `http://localhost:3000`
- `https://authenticcreationsco.com`

(Add the Amplify preview URL too — see step 4.6 — once you have it.)

### 1.4 Fill in `.env.local`

Copy `.env.example` to `.env.local` and fill in what you have so far:

```
NEXT_PUBLIC_SANITY_PROJECT_ID=   # from 1.1
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_WRITE_TOKEN=          # from 1.2
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` is git-ignored and must stay that way.

### 1.5 Seed the content

Preview what will be written, which needs no credentials:

```bash
npm run seed -- --dry-run
```

Then write it for real:

```bash
npm run seed
```

This creates the ten launch products (with the photos from `images/full/`) and
the About and Policies pages. It is idempotent — every document has a fixed id
and is created only if absent — so running it twice is safe and the second run
changes nothing.

Products are seeded with an **empty** `squareVariationId`. Filling those in is
step 2.4, and until then the site shows "Price at checkout" with a disabled buy
button, which is the correct behaviour for a product that cannot be sold yet.

The About and Policies pages are seeded **with draft words in them**, not empty,
so those pages are never a placeholder on a live site. They are drafts in CJ's
voice and they are meant to be rewritten — put that in front of her in step 1.6.
Nothing in them is a promise the site cannot keep, so it is safe if she takes a
week to get to it.

Two things the seed deliberately does **not** create: events and blog posts.
Those are CJ's to write, and there is no sensible placeholder for either — hence
step 1.7.

### 1.6 Invite CJ

**Project** → **Members** → invite CJ as an **Editor**. She logs in at
`/studio` on the live site with that account and needs nothing else — no AWS,
no GitHub.

Point her at **About** and **Policies** while she is in there: both are seeded
drafts and both are hers to rewrite.

### 1.7 Author one circle and one blog post

Do this **before** the smoke test in §9, in Studio, with CJ if she is around:

1. **Event** → create one — title, date/time in the future, a sentence of
   description, and a capacity if she wants one. **Publish.**
2. **Post** → create one — title, an excerpt, a `publishedAt` date, and a
   paragraph or two of body. **Publish.**

Neither is optional. `/community` and `/blog` are seeded with nothing, so
without this the smoke test's step 8 has no circle to open and no way to
exercise the RSVP write path at all — the site's only writer, and therefore the
only thing that can be broken by a missing Sanity token, would go to production
untested. Step 9 has nothing to look at either.

A first real circle is also the best possible thing to have on the site the day
it launches.

---

## 2. Square: build the catalog and connect it

### 2.1 Build the catalog with CJ

Work through **[docs/square-catalog-checklist.md](./square-catalog-checklist.md)**
with CJ. It is written for her, in plain language, and covers every item,
every "Custom — …" item, the flower variations, and where shipping and tax are
configured.

Do this in the **Sandbox** catalog first if you want to rehearse; it is a
separate catalog from the real one and nothing there affects CJ's business.

### 2.2 Get the developer credentials

1. Sign in at <https://developer.squareup.com/apps> **with CJ's Square
   account** (or an account she has added as a developer).
2. **Create app** → name it `Authentic Creations Site`.
3. Open the app → **Credentials**.
   - The **Sandbox** tab has a sandbox access token and sandbox location id —
     use these for all development.
   - The **Production** tab has the real ones. Do not touch these until step 3.
4. **Locations** → note the **Location ID** for the sandbox environment.

### 2.3 Point local development at the Sandbox

In `.env.local`:

```
SQUARE_ACCESS_TOKEN=      # Sandbox access token
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=       # Sandbox location id
```

### 2.4 Paste the variation IDs into Sanity

This is the join between the two systems, and it is the step that is easiest to
get subtly wrong. For each product:

1. In Square Dashboard, open the item, open the variation, and copy its
   **variation ID** (see the checklist, §"Where to find a variation ID").
2. In the site's Studio (`/studio` locally or live), open the matching product.
3. Paste it into the right field:

| Sanity field | Which Square variation |
|---|---|
| `squareVariationId` | The ready-made item's variation |
| `customSquareVariationId` | The matching **Custom — …** item's variation |
| `variants[].squareVariationId` | One per named variant (rose / tulip / lavender) |

4. **Publish**.

> **A product sold as variants must leave `squareVariationId` empty.**
> The grid tile prices a product from `squareVariationId` *or*, when it is
> absent, from its first variant; the detail page always prices from the
> variants. Filling in both means the tile and the buy button can quote
> different prices for the same hat. Crochet flowers is the one product this
> applies to today.

### 2.5 Check it worked

Run the site locally (`npm run dev`) and open `/shop/hats`. Every product with
a pasted id should show a real price. Any product still showing "Price at
checkout" has a missing or mistyped id.

---

## 3. Square: Sandbox → production

Do this once the catalog is right and the site works end to end against the
Sandbox. **Three environment variables and the catalog ids change; no code
does.**

1. In the Square developer dashboard, switch the app's credentials view to
   **Production** and copy the production **access token** and **location id**.
2. Build the real catalog in CJ's **production** Square Dashboard (the same
   checklist). Production variation IDs are *different* from sandbox ones.
3. Paste the **production** variation IDs into Sanity (step 2.4 again, against
   the live Studio).
4. Set these three in the **Amplify console** (step 4.5) — never in a file:

   ```
   SQUARE_ACCESS_TOKEN=<CJ's production token>
   SQUARE_ENVIRONMENT=production
   SQUARE_LOCATION_ID=<CJ's production location id>
   ```

5. **Redeploy.**

Handling of the production token:

- Type it directly into the Amplify console. Never into a file, a chat message,
  an email, or a ticket.
- If it is ever pasted somewhere it should not be, **rotate it** in the Square
  developer dashboard immediately and update Amplify. Rotation is free and
  takes a minute; a leaked token is a live payment credential.
- Local development stays on the Sandbox token forever. There is no reason for a
  production token to exist on a laptop.

---

## 4. AWS Amplify: hosting

### 4.1 Create the app

1. AWS console → **Amplify** → **Create new app**.
2. **Deploy your app** → **GitHub** → authorize AWS Amplify to read the repo.
3. Pick the repository and the **`main`** branch → **Next**.

### 4.2 Confirm the build settings

Amplify detects Next.js and finds **`amplify.yml`** in the repo root. The
review screen should show `npm ci` then `npm run build`. Do not edit the build
commands in the console — the file in the repo is the source of truth, so a
console-only change would be lost on the next edit and invisible in review.

Amplify deploys this as an SSR app (there are API routes and server-rendered
pages); no extra configuration is needed for that.

### 4.3 Service role

If prompted, let Amplify **create and use a new service role**. It needs it to
write logs and manage the SSR compute resources.

### 4.4 Deploy once, to get a URL

Save and deploy. The first build will **fail on purpose** if the environment
variables are not set yet — `next.config.ts` refuses to build without
`NEXT_PUBLIC_SITE_URL`. That is the pre-flight doing its job. Note the app's
default URL (`https://main.d1234abcd.amplifyapp.com`).

### 4.5 Environment variables

**App settings** → **Environment variables** → **Manage variables**. Add all of
these, applied to all branches:

| Variable | Value |
|---|---|
| `SQUARE_ACCESS_TOKEN` | CJ's production token (step 3) |
| `SQUARE_ENVIRONMENT` | `production` |
| `SQUARE_LOCATION_ID` | CJ's production location id |
| `SANITY_API_WRITE_TOKEN` | The write token from step 1.2 |
| `NEXT_PUBLIC_SITE_URL` | `https://authenticcreationsco.com` (the Amplify URL until the domain is attached) |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | From step 1.1 |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` |
| `NEXT_PUBLIC_RUM_APP_MONITOR_ID` | From step 5 |
| `NEXT_PUBLIC_RUM_IDENTITY_POOL_ID` | From step 5 |
| `NEXT_PUBLIC_RUM_REGION` | From step 5, e.g. `us-east-1` |

> **Every `NEXT_PUBLIC_*` variable must be present at _build_ time.** Next
> inlines them into the JavaScript it emits, so adding one after a build has no
> effect until the **next** build. Change a variable → **redeploy**.

> **Never set `SANITY_FAKE` or `SQUARE_FAKE` here.** They are the local fixture
> switches (`lib/sanity/fixtures.ts`, `lib/square/fixtures.ts`). A deployed
> build with either one on would serve invented products at invented prices and
> take payment for none of them.

### 4.6 Redeploy and check

Trigger a redeploy. Then add the Amplify URL to Sanity's CORS origins (step
1.3) so the Studio works at `/studio` on the deployed site.

---

## 5. CloudWatch RUM: analytics

RUM is the site's only analytics (spec §8). It reports page views, sessions,
geography, performance and JavaScript errors to the AWS console. CJ does not
need it — her sales numbers are in Square — so this is developer-facing.

### 5.1 Create the app monitor

1. AWS console → **CloudWatch** → left nav → **Application Signals** → **RUM**
   (in older console layouts: **Application monitoring** → **RUM**).
2. **Add app monitor**.
3. **Application name**: `authentic-creations`.
4. **Application domain**: `authenticcreationsco.com`, and tick **Include
   subdomains**. (Before the domain exists, use the Amplify domain and come
   back to change it.)
5. **Data to collect**: tick **Page loads**, **JavaScript errors**, and **HTTP
   requests**. These are the three telemetries the client is configured with;
   collecting something the client never sends just costs money for nothing.
6. **Session samples**: `100%`. At this traffic level sampling produces gaps,
   not savings.
7. **Check "Let CloudWatch RUM create the required Amazon Cognito identity pool
   and IAM role for me."** This is the guest identity pool — it creates a pool
   with unauthenticated (guest) access whose role may do exactly one thing:
   `rum:PutRumEvents` to this app monitor. That is why these ids are safe to
   ship in browser JavaScript.
8. **Add app monitor**.

### 5.2 Take the three values

The console then shows a JavaScript snippet. **Do not paste the snippet** — the
site already has the client (`components/rum.tsx`). Read three values out of it:

| From the snippet | Environment variable |
|---|---|
| The first argument to `AwsRum(…)`, a UUID | `NEXT_PUBLIC_RUM_APP_MONITOR_ID` |
| The third argument, a region string | `NEXT_PUBLIC_RUM_REGION` |
| `identityPoolId` in the config object | `NEXT_PUBLIC_RUM_IDENTITY_POOL_ID` |

Put them in Amplify (step 4.5) and **redeploy**. With any of the three missing
the component renders nothing and loads no analytics code at all, which is the
correct state for a dev machine and a silent failure on production — so confirm
it is working in 5.4.

### 5.3 If you need to create the identity pool by hand

Only if step 5.1's checkbox is unavailable:

1. **Cognito** → **Identity pools** → **Create identity pool**.
2. **Guest access** → enable. **Authenticated access** → none.
3. Name it `authentic-creations-rum`, create it, and let it create the
   unauthenticated IAM role.
4. Open that role in **IAM** and attach an inline policy allowing
   `rum:PutRumEvents` on the app monitor's ARN
   (`arn:aws:rum:<region>:<account-id>:appmonitor/authentic-creations`) and
   nothing else.
5. Back in the RUM app monitor's configuration, select **Use an existing
   identity pool** and choose it.

### 5.4 Confirm it is reporting

Load the live site, click through two or three pages, wait a minute, then open
the app monitor in the console. Sessions and page views should appear. If they
do not, open the browser console on the live site: a blocked or misconfigured
client logs `[rum] could not start the CloudWatch RUM client`.

---

## 6. The domain

### 6.1 Register it

1. AWS console → **Route 53** → **Registered domains** → **Register domains**.
2. Search for **`authenticcreationsco.com`**. (Confirmed available on
   2026-08-09; availability is not reserved until it is bought. Fallback:
   `authenticcreationscompany.com`.)
3. Add to cart, fill in the registrant contact, **enable privacy protection**,
   and complete the order.
4. Registration usually completes in minutes but can take up to 48 hours. Route
   53 creates the hosted zone automatically.

### 6.2 Attach it to Amplify

1. Amplify → your app → **Hosting** → **Custom domains** → **Add domain**.
2. Enter `authenticcreationsco.com`. Amplify finds the Route 53 hosted zone in
   the same account and offers to configure it.
3. Map the subdomains:
   - `authenticcreationsco.com` → `main`
   - `www` → `main` (Amplify sets up the redirect)
4. Save. Amplify requests an SSL certificate and writes the DNS records itself.
   Verification and propagation take 15–60 minutes; the domain shows
   **Available** when it is done.

### 6.3 Point the site at itself

Once the domain resolves:

1. Set `NEXT_PUBLIC_SITE_URL=https://authenticcreationsco.com` in Amplify.
2. **Redeploy** (it is a `NEXT_PUBLIC_*` variable — see 4.5).
3. Add the domain to Sanity's CORS origins (step 1.3).
4. Update the RUM app monitor's application domain (step 5.1.4).

This variable is what builds the `/thanks` return URL on every Square payment
link. Leave it pointing at the Amplify URL and buyers come back to the wrong
host after paying.

---

## 7. Tests

### 7.1 The offline suites

```bash
npm test          # unit + component; no network, no credentials
npm run test:e2e  # Playwright, against `next dev` on fixture data
```

The E2E suite boots its own dev server with `SQUARE_FAKE=1 SANITY_FAKE=1`, so
it needs no accounts. It runs every spec twice — once at a desktop viewport and
once as a phone (`mobile-chrome`, a Pixel 5 profile), because that is what this
audience uses. Both projects share the one dev server, so each is given its own
`x-forwarded-for` address; without that they share the RSVP rate-limit bucket
and the second one to run gets throttled mid-spec.

On a new machine, install the browser once:

```bash
npx playwright install chromium
```

> **On Windows the suite takes several minutes even though the tests take
> ten seconds.** All of the difference is Playwright terminating the Next dev
> server after the last test; the results and the exit code are already decided
> by then, and every test result has printed. It is not a hung suite.
> `DEBUG=pw:webserver npm run test:e2e` shows the gap between "Terminating the
> WebServer" and "Terminated the WebServer" if you want to confirm it. See the
> note in `playwright.config.ts` for what has already been ruled out.
>
> If you are waiting on it, killing the server unblocks Playwright immediately
> and it then reports and exits normally:
>
> ```powershell
> $p = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
>   Where-Object { $_.CommandLine -like '*next/dist/bin/next dev*' }
> taskkill /PID $p.ProcessId /T /F
> ```

### 7.2 The Square Sandbox integration test

`tests/integration/square-sandbox.test.ts` is the only test that talks to
Square for real. It proves our *reading of Square's API* is right — that prices
and inventory come back where we look for them and that a payment link really
has a URL — which no mock can tell us.

It **skips itself** unless `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID` are
set, so `npm test` stays offline. To run it, with Sandbox credentials in
`.env.local`:

```bash
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run tests/integration
```

It creates a temporary catalog item named `ZZ E2E TEMP …`, reads it back, gives
it an inventory count, creates a payment link for it, and deletes the item
again — including when an assertion fails. It refuses to run at all if
`SQUARE_ENVIRONMENT=production`.

Run it after any change to `lib/square/gateway.ts`, and once before launch
against the Sandbox. If a stray `ZZ E2E TEMP` item ever survives a crash, delete
it from the Square Dashboard.

---

## 8. Pre-flight checklist

Walk this before announcing the site.

- [ ] **`NEXT_PUBLIC_SITE_URL` is set in Amplify to the real origin, and the
      site has been redeployed since.** The build fails without it, but a build
      that predates the change will happily still be serving. Check the payment
      link: add something to the cart, click Checkout, and confirm the Square
      page returns you to `https://authenticcreationsco.com/thanks`.
- [ ] **Every product in Studio has its variation IDs pasted in**, and no
      product shows "Price at checkout" on the live site.
- [ ] **Variant products (crochet flowers) have `squareVariationId` empty** and
      only their `variants[]` filled — see step 2.4.
- [ ] **`SQUARE_ENVIRONMENT=production`** and the token is CJ's production one.
      A sandbox token in production takes orders that no one is ever charged
      for.
- [ ] **Shipping: the site adds no postage, and the only lever it has is a code
      change.** `checkoutOptions.shippingFee` is deliberately unset, so Square
      collects the buyer's address (the checkout page asks for it) and charges
      exactly the sum of the item prices. Postage therefore comes out of the
      sale price until someone changes that, and changing it means setting
      `shippingFee` in `lib/square/gateway.ts` — **a code change, so decide
      before launch if the answer is "charge for it".**

      Ground-truthed against the Square **Sandbox** on 2026-08-10, because this
      entry previously offered a dashboard route that nobody had ever walked.
      A payment link created by this app's own gateway produced an order with
      `total_money` = the item price, `total_service_charge_money` = 0, and a
      single `SHIPMENT` fulfilment in state `PROPOSED` carrying no charge.
      Square's hosted page *does* render a "Shipping method" section, so a
      dashboard-side shipping option may well exist — but nothing observable
      from the Sandbox makes it offer one (the sandbox link serves Square's
      "Checkout API Sandbox Testing Panel" rather than a real checkout, and its
      preview page says outright that it is "for visual purpose only"). Treat
      the dashboard route as unproven until someone has watched a shipping
      option appear on the live site; `shippingFee` is the route this repo
      controls.
- [ ] **Tax: assume nothing, and check it on the first real order.** The site
      never calculates tax — that part is true and deliberate. What is *not*
      established is whether Square adds one by itself: in the same Sandbox
      experiment, an item carrying an **enabled, additive 8.5% catalog tax**
      produced an order with `total_tax_money` = 0, its line item marked
      `"taxable": true` and taxed nothing. So if CJ needs to charge tax, confirm
      it on the real purchase in §9 step 7 **before announcing the site**, and
      treat "Square handles it" as unproven until you have seen a tax line on a
      live order.
- [ ] **A rare oversell is possible, and the remedy is a refund.** Stock is
      re-read from Square at the moment Checkout is pressed, but nothing *holds*
      it: two buyers who press Checkout in the same second can both pass the
      check on the last hat. A payment link also stays payable after it is
      created — there is no webhook and no post-payment re-check in v1 — so a
      link made while the hat existed can be paid an hour later, after it has
      gone. Neither is prevented, and at this volume neither is likely.
      If it happens: **refund the second order from the Square dashboard** and
      email the buyer. Tell CJ this before launch, so the first time it happens
      is not the first time she hears of it.
- [ ] **Sold-out is driven by inventory counts, not Square's "sold out"
      toggle.** The site reads `IN_STOCK` counts and shows the badge at zero. It
      does **not** read the item-level availability toggle in the Square
      Dashboard, so switching that on hides nothing here. To take something off
      sale: set its inventory to 0, which stops any *new* checkout starting
      (it cannot cancel a payment link already open in someone's browser — see
      the oversell note above), or unpublish the product in Studio to take it
      off the site altogether. Tell CJ this explicitly — it is the single most
      likely operational surprise.
- [ ] **Made-to-order items have inventory tracking OFF** in Square. A tracked
      custom item at zero stock is unbuyable, which is the opposite of what
      "made to order" means.
- [ ] **RSVP rate limiting is best-effort.** `/api/rsvp` allows 5 posts per IP
      per 10 minutes, counted **in the memory of one Lambda instance**
      (`lib/rate-limit.ts`). Under fan-out a determined caller gets one budget
      per warm instance, and the client IP comes from `x-forwarded-for`, which
      is spoofable by anything reaching the origin directly. It stops casual
      abuse and accidental double-submits, not a determined attacker. **The
      upgrade path is AWS WAF** in front of the Amplify distribution with a
      rate-based rule on `POST /api/rsvp` — do it if RSVP spam ever appears in
      the Sanity dataset; there is no code change involved.
- [ ] **Sanity CORS origins** include the live domain, or `/studio` will not
      load for CJ.
- [ ] **`/robots.txt` and `/sitemap.xml`** resolve on the live domain and the
      sitemap lists real product URLs.
- [ ] **CloudWatch RUM is receiving sessions** (step 5.4).
- [ ] **CJ can log in to `/studio`**, edit a product, and see the change on the
      site within about a minute (pages revalidate every 60 seconds).

---

## 9. Smoke test on the live site

Do this on a phone, not only a laptop — most of this audience shops on one.

1. `/` — hero renders, featured products have prices.
2. `/shop/hats` — grid, prices, and a sold-out badge on anything at zero stock.
3. A product page — gallery, price, Add to Cart.
4. Add to cart → mini-cart opens with the right item and subtotal.
5. `/shop/hats/custom` — pick a colour, write a note, add to cart; the cart line
   shows the colour and the note.
6. `/cart` → **Checkout** → you land on a real Square page showing the right
   items and prices, and asking for a shipping address.
7. **Buy something for real**, cheapest item, with a real card. Confirm:
   - you are returned to `/thanks` and the cart is empty;
   - the order appears in CJ's Square dashboard **with the custom note on the
     line item** if you bought a custom piece;
   - the money appears in CJ's Square balance.
   Then refund it from the Square dashboard.
8. `/community` → open **the circle authored in step 1.7** → RSVP with a real
   address → "You're in!", and the RSVP appears in Studio under that event.
   Nothing seeds an event, so with step 1.7 skipped there is no circle to open
   and this step silently tests nothing — and it is the only exercise the site's
   one *write* path ever gets before real visitors use it.
9. `/blog` shows **the post from step 1.7**; `/about` and `/policies` render.
   About and Policies arrive seeded with draft text, so they will show
   *something* either way — read them and check they are CJ's words by now
   rather than the seed's (step 1.5).
10. `/studio` — CJ logs in and can edit.
11. **RSVP throttle.** On one phone, submit the RSVP form six times in a row,
    with a different email each time so nothing is refused as a duplicate. The
    first five should be accepted; the sixth should answer *"that's a few tries
    in a row — give it a couple of minutes and we'll try again"*. Then submit
    once from a **different device** and confirm it goes straight through.

    If the second device is throttled too, the client's address is not reaching
    the app — `x-forwarded-for` is not being forwarded — and every visitor in
    the world is sharing a single five-per-ten-minutes budget, which means one
    person's sign-ups close the form for everyone. The function log says so
    directly in that case: `[rate-limit] no x-forwarded-for`.

    Delete the five test RSVPs from Studio afterwards, and mind the circle's
    capacity while you do this — use a throwaway circle if the real one is
    small.

---

## 10. After launch

- **Content** is entirely CJ's, through `/studio`. Changes appear within about
  a minute.
- **Prices and stock** are entirely Square's. Nothing about money is edited in
  Studio or in code.
- **Deploys** happen on push to `main`. Watch the build in the Amplify console;
  a failed build leaves the previous version serving.
- **Errors** show up in CloudWatch RUM (client-side) and in the Amplify build
  and function logs (server-side).
- **Costs** are about $3–8/month: Amplify hosting and compute, ~$1 for RUM,
  ~$13/year for the domain, plus Square's 2.9% + 30¢ per sale. Sanity's free
  tier covers this comfortably; the RSVP rate limit exists partly to keep it
  that way.
