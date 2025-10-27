export function maskMsisdn(input: string | null | undefined): string {
  if (!input) return ''
  const digits = String(input).replace(/\D/g, '')
  if (digits.length <= 4) return '*'.repeat(digits.length)
  const visible = digits.slice(-4)
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${visible}`
}
