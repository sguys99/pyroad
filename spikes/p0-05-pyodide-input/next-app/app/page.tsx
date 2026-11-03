import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <Link href="/world">/world</Link> · <Link href="/iso/world">/iso/world</Link> · <Link href="/heal/world">/heal/world</Link> ·{' '}
      <Link href="/mw/world">/mw/world</Link>
    </main>
  );
}
