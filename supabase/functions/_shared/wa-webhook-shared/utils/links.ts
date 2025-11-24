export function waChatLink(phoneE164: string, text: string): string {
  const num = phoneE164.replace(/^\+/, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
