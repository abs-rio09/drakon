# Input

Text fields for checkout, order tracking and Create With Drakon: `dk-field` wraps a `dk-label`, a `dk-input` and an optional hint or error.

- **Field:** 48px tall, `field` fill, `line-strong` 1px edge (`ink-subtle` on hover), `radius-xl`, 16px text in `ink`, placeholder in `ink-subtle`.
- **Required:** add `<span class="dk-required">*</span>` inside the label and `required` on the input.
- **Hint:** `dk-hint` under the input, in `caption` (`ink-subtle`).
- **Error:** set `aria-invalid="true"` and point `aria-describedby` to a `dk-error` line with an icon and a sentence that says how to fix it.
- **Textarea:** add `dk-input` to a `<textarea>`. It is at least 120px tall and resizes vertically.

What you provide: a visible label for every field (never a placeholder alone), the right `type` and `inputmode` (`tel` for phone numbers, `email` for email), and the error text.

**Do:**
- Keep one column at most `form-max` wide on phones.
- Use `space-2` between label and input, and `space-6` between fields.
- Validate when the user leaves a field or submits, not on every key press.

**Don't:**
- Use a red border without words.
- Use light input backgrounds.
- Use midnight-600 edges, which drop below 3:1 on raised panels.

Hand-written from `src/components/home/CustomerIdeaForm.tsx`, with the border raised to `line-strong` for contrast; refreshed for the Ember Gallery direction.
