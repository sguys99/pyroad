// 시험 손님 채점 (P11-05, §12-Q75 ⑤): 입력 퀘스트는 "코드 돌려보기"가 직접 해 보기(채점 없음)이고
// "시험 손님 부르기"가 공개 손님마다 자동 실행 → 대화 카드 → 서버가 손님별 규칙으로 재채점 → 완료.
// 퀘스트는 테스트 월드(e2e/fixtures/content/worlds/test-meadow/01-gate/02-test-guests.yaml)라 앞 월드를 끝내 둔다

import { test, expect } from './support/test';
import {
  adminClient,
  completeQuests,
  installFixtureWorlds,
  removeFixtureWorlds,
} from './support/admin';
import { allQuestIds } from './support/content';
import {
  outputPanel,
  runButton,
  setCode,
  waitForRunner,
} from './support/quest';

const QUEST = 'd9000000-0000-0000-0000-000000000011';
const RIGHT = `door = input("1번 문과 2번 문 중 어디로 갈까요? ")
if door == "1":
    print("반짝이는 동굴에 들어왔어요!")
else:
    print("시원한 강에 도착했어요!")`;
// 한 갈래만 해 보고 통과하던 답 (콩콩이 손님이 잡음)
const ONE_WAY = `door = input("1번 문과 2번 문 중 어디로 갈까요? ")
if door:
    print("반짝이는 동굴에 들어왔어요!")`;

test.describe('시험 손님 채점 (P11-05)', () => {
  test.beforeAll(async () => {
    await installFixtureWorlds();
  });
  test.afterAll(async () => {
    await removeFixtureWorlds();
  });

  test('직접 해 보기는 채점하지 않고, 손님이 차례로 써 본 대화로 채점해 완료한다', async ({
    page,
    e2eUser,
  }) => {
    await completeQuests(
      e2eUser.id,
      [...allQuestIds(), ...allQuestIds('code-sea')].map((id) => ({
        id,
        solution: '',
      })),
    );
    await page.goto(`/quest/${QUEST}`);
    await waitForRunner(page);
    const grade = page.getByTestId('grade-button').filter({ visible: true });
    await expect(grade).toHaveText('시험 손님 부르기');

    // 1) 코드 돌려보기 = 내가 직접 대답 (채점 없음, 손님 부르기 안내)
    await setCode(page, ONE_WAY);
    await runButton(page).click();
    const field = page
      .getByTestId('input-reply-field')
      .filter({ visible: true });
    await field.fill('2');
    await field.press('Enter');
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'success');
    await expect(outputPanel(page)).not.toHaveAttribute('data-verdict', /.+/);
    await expect(
      page.getByTestId('guest-hint').filter({ visible: true }),
    ).toBeVisible();

    // 2) 한 갈래만 맞는 코드: 별똥이 통과 · 콩콩이 조금 달라요
    await grade.click();
    const guests = page.getByTestId('test-guests').filter({ visible: true });
    const cards = guests.getByTestId('test-guest');
    await expect(cards).toHaveCount(2);
    await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'diff');
    await expect(cards.nth(0)).toHaveAttribute('data-passed', 'true');
    await expect(cards.nth(1)).toHaveAttribute('data-passed', 'false');
    await expect(cards.nth(1)).toContainText('조금 달라요');
    // 손님 말풍선은 프롬프트 바로 뒤
    await expect(cards.nth(0).getByTestId('guest-answer')).toHaveText(
      /별똥이 손님의 대답: 1/,
    );
    await expect(guests).toContainText('손님 2명 중 1명이 만족했어요');

    // 3) 맞는 코드: 두 손님 모두 통과 → 완료 (서버가 손님별로 재채점)
    await setCode(page, RIGHT);
    await grade.click();
    await expect(cards.nth(1)).toHaveAttribute('data-passed', 'true');
    await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');
    await expect(cards.nth(1)).toContainText('시원한 강에 도착했어요!');
    if (process.env.E2E_SHOTS)
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await guests.scrollIntoViewIfNeeded();
        // 숨었다 보이는 쪽(데스크톱·모바일 결과 자리)은 카드 등장 연출이 다시 돌므로 끝난 뒤에 찍음
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => a.effect?.getTiming().iterations !== Infinity)
              .map((a) => a.finished.catch(() => {})),
          ),
        );
        await page.screenshot({
          path: `${process.env.E2E_SHOTS}/p11-05-test-guests-${width}.png`,
        });
      }
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from('user_progress')
          .select('status')
          .eq('user_id', e2eUser.id)
          .eq('quest_id', QUEST)
          .maybeSingle();
        return data?.status;
      })
      .toBe('completed');
  });

  test('완료 API는 손님 결과 없이 보낸 출력을 믿지 않는다', async ({
    page,
    e2eUser,
  }) => {
    await completeQuests(
      e2eUser.id,
      [...allQuestIds(), ...allQuestIds('code-sea')].map((id) => ({
        id,
        solution: '',
      })),
    );
    await page.goto(`/quest/${QUEST}`);
    const post = (data: unknown) =>
      page.request.post('/api/quest/validate', { data });
    // 손님 결과(runs) 없이 정답 출력만
    let res = await post({
      quest_id: QUEST,
      student_code: RIGHT,
      stdout: '반짝이는 동굴 시원한 강',
    });
    expect(await res.json()).toEqual({ passed: false, scenarios: [] });
    // 두 손님 모두 같은 출력 (한 갈래 코드가 보낼 수 있는 것)
    res = await post({
      quest_id: QUEST,
      student_code: RIGHT,
      stdout: '',
      runs: [{ stdout: '반짝이는 동굴' }, { stdout: '반짝이는 동굴' }],
    });
    expect(await res.json()).toEqual({
      passed: false,
      scenarios: [true, false],
    });
  });
});
