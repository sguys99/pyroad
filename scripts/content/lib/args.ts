/** `--name value`, `--name=value`, `--flag` 형태의 간단한 인자 파서 */
export function parseArgs(argv: string[] = process.argv.slice(2)) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`알 수 없는 인자: ${arg}`);
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    if (inline !== undefined) values.set(name, inline);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      values.set(name, argv[++i]);
    } else flags.add(name);
  }
  return {
    get: (name: string) => values.get(name),
    has: (name: string) => flags.has(name) || values.has(name),
    list: (name: string) =>
      (values.get(name) ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
  };
}

/** 스크립트 진입점: 예외를 한 줄 메시지로 찍고 종료 코드 1 */
export function run(main: () => Promise<number | void>) {
  main().then(
    (code) => process.exit(code ?? 0),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
