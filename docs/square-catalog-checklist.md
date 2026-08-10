# Setting up your Square catalog

Hi CJ — this is the one setup job that only you can do, and once it's done you
won't have to think about it again.

Here's the short version of how the site works: **Square owns anything to do
with money.** Prices, how many you have left, shipping, tax, payments — all of
it lives in your Square dashboard, and the website reads it from there. The
website owns how things *look*: names, photos, descriptions, the order they
appear in. That means you'll never type a price into the website, and you'll
never have to remember to mark something sold out. Change a price in Square and
the site shows the new one within a minute.

This page walks you through building the Square side. Take your time; it's
mostly repetition once you've done the first one.

**What you'll need:** your Square dashboard (<https://squareup.com/dashboard>)
and your prices decided. Set aside about an hour.

---

## Part 1 — The ready-made pieces

You'll create one **item** for each thing you sell. Ten of them.

### How to create one

1. In the Square dashboard, go to **Items & Services** → **Items** →
   **Create an item**.
2. **Name** — type it exactly as it should read on the website, e.g.
   `Crochet ruffled bucket hat`.
3. **Description** — optional. The website uses its own description (the one
   you can edit yourself later), so this is only for your own records.
4. **Price** — what you're charging.
5. **Inventory** — turn **Track inventory** ON, and enter how many you have.
   This is what makes "Sold out" appear on the site by itself.
6. **Save**.

### The list

Create one item for each of these:

**Hats**

- [ ] Crochet ruffled bucket hat
- [ ] Crochet granny stitch hat
- [ ] Crochet granny square beanie
- [ ] Crochet bucket hat
- [ ] Crochet cat-ear beanie
- [ ] Crochet beanie

**Accessories**

- [ ] Scrunchies 3-pack
- [ ] Crochet flowers  ← *this one is special, see Part 2*
- [ ] Crochet slouch bag
- [ ] Crochet bottle holder

---

## Part 2 — Crochet flowers (the one with choices)

Crochet flowers is a single item that comes in three kinds, so instead of three
separate items it gets one item with three **variations**. On the website this
shows up as little buttons the shopper picks between.

1. Create the item **Crochet flowers** as above.
2. In the item, find **Variations** and add three:
   - `Rose`
   - `Tulip`
   - `Lavender`
3. Give each one its price and its own inventory count. They can differ if you
   like — the site shows whichever one the shopper has selected.
4. **Save**.

If you'd rather add a fourth flower later, just add another variation here and
tell me — it takes one small change on the website side to show it.

---

## Part 3 — The custom pieces

Custom orders are their own items in Square, separate from the ready-made ones.
There's a good reason for that: a custom piece is made for the person who
orders it, so it should stay orderable even when the ready-made version has
sold out.

### How to create one

1. **Create an item**, named `Custom — <the piece>`, for example
   `Custom — Crochet ruffled bucket hat`.
   *(That's an em dash. If it's easier, a plain hyphen is fine — the name is
   only for your dashboard; the website writes its own.)*
2. **Price** — your fixed price for a custom version of that piece. Custom
   pieces usually cost a bit more than ready-made; that's up to you.
3. **Inventory** — turn **Track inventory** **OFF**.

   > This matters. A custom piece isn't something you have on a shelf, it's
   > something you'll make. If tracking is on, Square will think you have zero
   > of them and the website will refuse to sell any.

4. **Save**.

### The list

- [ ] Custom — Crochet ruffled bucket hat
- [ ] Custom — Crochet granny stitch hat
- [ ] Custom — Crochet granny square beanie
- [ ] Custom — Crochet bucket hat
- [ ] Custom — Crochet cat-ear beanie
- [ ] Custom — Crochet beanie
- [ ] Custom — Scrunchies 3-pack
- [ ] Custom — Crochet flowers
- [ ] Custom — Crochet slouch bag
- [ ] Custom — Crochet bottle holder

**Don't want ten of them?** You don't have to. If you'd rather charge one flat
price for any custom hat and one for any custom accessory, make just two items
instead — `Custom — Hats` and `Custom — Accessories` — and we'll point every
product at the right one. The website works the same either way. Only do this
if the pricing genuinely is the same; a shopper seeing one price and getting
another is the thing we want to avoid.

### What you'll see when someone orders one

When a custom order comes through, the Square order will have a note on the
line item that looks like this:

> Custom order — Color: Blue. Could you make the brim a bit wider? And I'd love
> it a touch slouchy.

That's the colour they picked from the eight swatches and whatever they typed
in the comments box, exactly as they wrote it. It's on the order itself, so
it's there whenever you come back to it.

---

## Part 4 — Shipping and tax

The website deliberately doesn't do either of these. Square does, so that
there's one place to change them and one place to be right.

### Shipping

Every checkout asks the buyer for a delivery address — the website makes sure
of that, so an order can never arrive without one.

What it doesn't yet do is add postage to the total. **That's a decision for
you**, and it's the one open question before launch:

- **Free shipping** — the price on the tag is the price they pay, and postage
  comes out of it. Simplest for everyone; just build a bit of postage into your
  prices.
- **A flat postage fee** — e.g. $5 on every order.
- **Free over a certain amount** — e.g. free over $50, otherwise a flat fee.

Tell me which you'd like and roughly what the number is, and I'll set it up.
It's a small change and it's better done before the first sale than after.

To see the shipping options Square offers you: **Settings** → **Fulfilment**
(or **Shipping**) in the dashboard.

### Tax

**Settings** → **Taxes** in the Square dashboard. Whatever you set there is
what Square charges at checkout, and the website never touches it. If you're
not sure whether you need to charge tax, that's a question for your accountant
rather than for the site.

---

## Part 5 — The ID numbers (the last step)

Every item and every variation in Square has an ID — a string of letters and
numbers like `X7KDN4QP2WMYGVWK6TWJDNI`. That ID is how the website knows which
Square item a product on the site corresponds to. This is the bit that connects
the two halves together.

**You can skip this part and hand it to me** — it's fiddly and it's the one
step where a typo has an actual consequence. But if you'd like to do it, here's
how.

### Where to find a variation ID

1. In the Square dashboard, open **Items & Services** → **Items** and click the
   item.
2. Open the variation (for a simple item there's just one, often called
   `Regular`).
3. Look at the address bar in your browser. The long code at the end of the web
   address is the item's ID. For a variation, the variation's own ID appears in
   the variation's details panel.
4. If you can't find it, the surest way is: **Items & Services** → **Actions**
   → **Export library**. The spreadsheet you get has a **Variation ID** column
   with every one of them, next to the name.

That spreadsheet is honestly the easiest route: export it once, and every ID
you need is in one place.

### Where they go on the website

Log in to the website's own dashboard at
`https://authenticcreationsco.com/studio`, open a product, and you'll see
fields for these:

| Field on the website | Which Square variation ID goes in it |
|---|---|
| **Square variation ID** | The ready-made item's variation |
| **Custom Square variation ID** | The matching `Custom — …` item's variation |
| **Variants → Square variation ID** | One per flower colour (rose, tulip, lavender) |

Then hit **Publish**.

> **One exception, for Crochet flowers only:** leave the main **Square
> variation ID** field *empty* and fill in only the three under **Variants**.
> Because that product's price depends on which flower is chosen, filling in
> both fields could make the shop page and the product page show different
> prices for the same thing.

### How to tell it worked

Open the shop page on the website. Every product should show a real price. If
one says **"Price at checkout"**, that product's ID is missing or has a typo —
go back and check it against the export.

---

## Part 6 — Day-to-day, once you're live

**To restock something:** update its inventory count in Square. The "Sold out"
badge disappears from the site on its own within a minute.

**To take something off sale:** set its inventory count to **0** in Square.

> ⚠️ There's a "sold out" toggle in the Square dashboard, and the website
> **doesn't read it**. Flipping it will hide the item in your Square point of
> sale but the website will carry on selling it. Always use the inventory
> count. (If you want something gone from the site entirely rather than shown
> as sold out, unpublish the product in the website dashboard instead.)

**To change a price:** change it in Square. Never in the website dashboard —
there's nowhere to type a price there, on purpose.

**To add a brand-new product:** create it in Square, then create it in the
website dashboard and paste in the variation ID. Same steps as above.

**Where your sales numbers live:** your Square dashboard, same as always. The
website doesn't keep its own copy of anything to do with money.

---

## Quick recap

- [ ] 10 ready-made items, each with a price and inventory tracking **on**
- [ ] Crochet flowers has three variations: rose, tulip, lavender
- [ ] Custom items created, with inventory tracking **off**
- [ ] Shipping decided and set up (or "free shipping" chosen deliberately)
- [ ] Tax configured in Square's settings
- [ ] Every variation ID pasted into the matching product on the website
- [ ] Crochet flowers has its main variation ID left **empty**
- [ ] Every product on the live shop page shows a real price

Any of it unclear or not matching what you see on screen — just ask. Square
moves things around in their dashboard from time to time, and it's much quicker
to check than to guess.
