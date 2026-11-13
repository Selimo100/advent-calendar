/**
 * npm run passphrase:hash
 * Prompts for the access passphrase (input hidden) and prints the scrypt hash
 * to store as ADVENT_PASSPHRASE_HASH. The passphrase itself is never stored.
 */
import '../tools/cli.ts';
import { hashPassphrase, MIN_PASSPHRASE_LENGTH, verifyPassphrase } from '../server/auth/passphrase.ts';

async function readHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8').split('\n')[0] ?? '';
  }
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve) => {
    let value = '';
    const onData = (char: string) => {
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        process.exit(130);
      } else if (char === '\u007f') {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}

console.log(`Choose a long passphrase (at least ${MIN_PASSPHRASE_LENGTH} characters), e.g. four or five unrelated words.`);
const first = await readHidden('Passphrase: ');
if (process.stdin.isTTY) {
  const second = await readHidden('Repeat:     ');
  if (first !== second) {
    console.error('The passphrases do not match.');
    process.exit(1);
  }
}
const hash = await hashPassphrase(first);
if (!(await verifyPassphrase(first, hash))) throw new Error('Self-check failed');
console.log('\nSet this as ADVENT_PASSPHRASE_HASH (Netlify: scope "Functions", production context):\n');
console.log(hash);
console.log('\nKeep the passphrase itself somewhere safe; it cannot be recovered from the hash.');
