# USSD Helpers

- `encodeTelUri(humanUssd)` converts a human USSD string (e.g. `*182*8*1*123#`)
  into a `tel:` URI compatible with iOS/Android by percent-encoding `*` and `#`.
- `formatUssdText(humanUssd)` normalizes whitespace for display to the user.

### Behaviour notes

- Android accepts both `tel:*...#` and encoded versions; iOS requires
  percent-encoding.
- Always show the human-readable form (`formatUssdText`) in messages and attach
  the encoded URI as the button link.
