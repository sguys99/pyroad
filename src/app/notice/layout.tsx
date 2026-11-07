// 공지(비로그인 열람)도 앱 화면 웹폰트를 쓴다 (P2-10). 랜딩에는 싣지 않으려고 루트가 아닌 여기서 import
import '@/fonts/app.css';

export default function NoticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
