// 보호자 리포트(비로그인 열람)도 앱 화면 웹폰트·유틸리티를 쓴다 (공유 페이지와 같음, P9-15)
import '@/fonts/app.css';
import '@/app/app.css';

export default function GuardianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
