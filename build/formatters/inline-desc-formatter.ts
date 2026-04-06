export class InlineDescFormatter {
  format(text: string): string {
    return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
