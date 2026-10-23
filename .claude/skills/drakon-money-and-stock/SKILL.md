---
name: drakon-money-and-stock
description: The DRAKON rules for prices, totals, refunds and stock (integer paisa, server-side pricing, the safe stock decrement, cancels and returns putting stock back, SOLD_OUT and ARCHIVED). Use when touching checkout, orders, returns, stock, prices or anything that shows ৳.
---

# Money and stock in DRAKON

## Money
- Always integer **paisa** (`int64` in Go, `BIGINT *_paisa` in SQL, `number` in TS). ৳599.50 = 59950. Format to ৳ only in the UI (`web/src/lib/money.ts` `formatTaka`). Admin price inputs are parsed as text (`features/admin/format.ts` `parseTaka`), never with float maths.
- The server decides every price, delivery charge, total and limit from the database (`internal/orders/quote.go`). The browser sends only `variantId` + `qty`; unknown JSON fields (like `pricePaisa`) are refused.
- Limits on sums: compare with what is **left**, not with a sum that can overflow. Right: `refund > paid - before`. Wrong: `before + refund > paid` (a huge number wraps around int64 and looks small; see `TestAdminRefundCannotOverflow`).
- Orders keep snapshots (name, option label, unit price, delivery charge, zone). Never recompute an old order from today's product.
- Business numbers (delivery charges, 48 h, limit 5, 3 return days, 7 archive days) come from `settings` / `delivery_zones`. Never type them into code.

## Stock
- Take stock only with `DecrementStock` (`... SET stock = stock - $qty WHERE id = $id AND is_active AND stock >= $qty`) inside the order transaction; 0 rows = sold out → refuse the whole order.
- Lock order: variants by id, then the product. Checkout, admin stock changes and returns all do this, so they never deadlock.
- Every stock change writes `inventory_movements` (ORDER, CANCEL, RETURN, RESTOCK, ADJUST) with the admin id when an admin did it.
- Cancel (buyer, admin, sweep) only through `orders.CancelLocked`: it locks the order, re-checks the status (so a double cancel puts stock back once), returns every item, and turns a SOLD_OUT product with stock back into ACTIVE (`ReactivateIfStocked`). ARCHIVED stays archived.
- A limited product with no active stock left becomes SOLD_OUT (`MarkSoldOutIfEmpty`) and is never restocked (`LIMITED_NO_RESTOCK`); the sweep archives it after `archive_after_days`. Only the Owner brings it back, with a reason.
- Purchase limit: per product (all variants together), default from `default_purchase_limit`, counted per phone across earlier non-cancelled orders, with `LockPhone` so two orders from one phone run one after the other.

## Test the nasty cases
Two requests at the same moment (stock exactly 1, the same order cancelled twice), the limit exactly reached and one over, very big and negative numbers, Bangla text, and the phone typed as `+880 1712-345678`, `8801712345678`, `01712345678`. Tests use `drakon_test`, never `drakon`.
