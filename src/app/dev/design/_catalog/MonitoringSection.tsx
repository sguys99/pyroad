import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';
import {
  BarList,
  StatTile,
  StatusChip,
  TileGrid,
} from '@/components/monitoring/MonitoringParts';
import { sampleSummary } from '@/lib/monitoring/sample';
import { Demo, Section } from './ui';

/** 운영 지표 (P12-09): 관리자 `/admin` 조각과 견본 값으로 그린 전체 화면 (실제 데이터 아님) */
export function MonitoringSection() {
  return (
    <Section
      id="monitoring"
      kicker="관리자 (P12-09)"
      title="운영 지표"
      description="관리자만 보는 /admin. 숫자 타일 + 인라인 SVG 스파크라인·막대(차트 라이브러리 없음), 크기는 primary 한 색, 상태는 아이콘 + 글자 딱지. 막대·선은 장식이고 값은 글자로, 스파크라인은 낭독 이름에 최솟값·최댓값. 브라우저 JS 없음(기간은 링크)."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Demo label="숫자 타일" note="스파크라인 · 상태 · 수집 안 함" surface="card">
          <TileGrid>
            <StatTile
              label="활동한 학생"
              value="214"
              spark={{ values: [38, 61, 72, 69, 80, 77, 91], label: '날짜별 활동한 학생' }}
            />
            <StatTile label="앱 오류율" value="—" status={{ status: 'off', text: '여기서는 수집 안 함' }} />
          </TileGrid>
        </Demo>
        <Demo label="상태 딱지" note="색만으로 알리지 않음" surface="card">
          <div className="flex flex-wrap gap-2">
            <StatusChip status="ok">0 정상</StatusChip>
            <StatusChip status="warn">목표 미달</StatusChip>
            <StatusChip status="off">표본 적음</StatusChip>
          </div>
        </Demo>
        <Demo label="막대 목록" note="가장 큰 값 기준 · 수집 안 함 줄" surface="card">
          <BarList
            rows={[
              { label: '1단계', value: 301 },
              { label: '2단계', value: 129 },
              { label: '3단계', value: 56 },
              { label: 'AI/저장된 답변', value: null },
            ]}
          />
        </Demo>
      </div>
      <Demo label="전체 화면 (견본 7일)" data-testid="monitoring-demo">
        <MonitoringDashboard data={sampleSummary()} sentryUrl={null} basePath="/dev/design" />
      </Demo>
    </Section>
  );
}
