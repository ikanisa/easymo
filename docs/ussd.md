# USSD Helpers

- `encodeTelUri(humanUssd)` converts a human USSD string (e.g. `*182*8*1*123#`)
  into a `tel:` URI compatible with iOS/Android by percent-encoding `*` and `#`.
  Use this for WhatsApp buttons and clickable links.
- `encodeTelUriForQr(humanUssd)` converts a human USSD string to an unencoded
  `tel:` URI (e.g. `tel:*182*8*1*123#`) optimized for QR codes. Android QR
  scanner apps often fail to decode percent-encoded characters before passing
  to the dialer, so this version leaves `*` and `#` unencoded for better
  Android compatibility while maintaining iOS support.
- `formatUssdText(humanUssd)` normalizes whitespace for display to the user.

### Behaviour notes

- **For WhatsApp buttons/links**: Use `encodeTelUri()` which percent-encodes
  `*` and `#`. iOS requires this encoding for proper handling.
- **For QR codes**: Use `encodeTelUriForQr()` which does NOT encode `*` and `#`.
  Many Android QR scanner apps don't properly decode percent-encoded tel: URIs,
  causing the dialer to receive literal `%2A` and `%23` instead of `*` and `#`.
- Always show the human-readable form (`formatUssdText`) in messages and attach
  the appropriate URI based on the delivery method (button vs QR code).
