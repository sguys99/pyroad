// 공유 페이지(비로그인 열람)도 앱 화면 웹폰트·유틸리티를 쓴다 (P2-10·P4-12). 랜딩에 싣지 않으려고 루트가 아닌 여기서 import
import '@/fonts/app.css';
import '@/app/app.css';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
