export class WrapDescriptionFormatter {
  format(text: string, maxWidth = 100): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      if (word.includes('\n')) {
        const parts = word.split('\n');

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];

          if (i === 0) {
            const candidate = current ? `${current} ${part}` : part;

            if (candidate.length <= maxWidth) {
              current = candidate;
            } else {
              if (current) lines.push(current);
              current = part;
            }
          } else {
            if (current) lines.push(current);
            current = part;
          }
        }
      } else {
        const candidate = current ? `${current} ${word}` : word;

        if (candidate.length <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
    }

    if (current) lines.push(current);

    return lines.join('\n');
  }
}
