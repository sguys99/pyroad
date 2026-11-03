/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import Image from 'next/image';
import QuestLink from './QuestLink';
import SabCheck from './SabCheck';

const XO = 'http://127.0.0.1:3105/xo/'; // 페이지는 localhost:3105 → 다른 출처

function Nav({ base, questLink }: { base: string; questLink?: boolean }) {
  const Q = questLink ? QuestLink : Link;
  return (
    <nav style={{ display: 'flex', gap: 12 }}>
      <Link id="to-world" href={`${base}/world`}>월드 (Link)</Link>
      <Q id="to-q1" href={`${base}/quest/1`}>퀘스트 1 ({questLink ? 'QuestLink' : 'Link'})</Q>
      <Q id="to-q2" href={`${base}/quest/2`}>퀘스트 2 ({questLink ? 'QuestLink' : 'Link'})</Q>
      <a id="hard-q1" href={`${base}/quest/1`}>퀘스트 1 (a href)</a>
    </nav>
  );
}

function XoImages() {
  return (
    <div>
      <img id="img-plain" alt="" width={16} height={16} src={`${XO}plain.png`} /> 헤더 없음
      <img id="img-corp" alt="" width={16} height={16} src={`${XO}corp.png`} /> CORP
      <img id="img-cors" alt="" width={16} height={16} crossOrigin="anonymous" src={`${XO}cors.png`} /> ACAO+crossorigin
      <Image id="img-next" alt="" width={16} height={16} src={`${XO}plain.png`} /> next/image(프록시)
    </div>
  );
}

export function WorldPage({ base, questLink }: { base: string; questLink?: boolean }) {
  return (
    <main>
      <h1>월드맵 {base || '/'}</h1>
      <Nav base={base} questLink={questLink} />
      <XoImages />
    </main>
  );
}

export function QuestPage({ base, id, questLink }: { base: string; id: string; questLink?: boolean }) {
  return (
    <main>
      <h1>퀘스트 {id}</h1>
      <Nav base={base} questLink={questLink} />
      <SabCheck />
      <XoImages />
    </main>
  );
}
