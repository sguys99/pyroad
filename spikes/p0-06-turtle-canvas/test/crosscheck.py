"""CPython 진짜 turtle 수학 vs pyRoad shim 교차 검증.

tkinter가 없는 환경에서도 돌도록 가짜 tkinter를 sys.modules에 넣고
표준 라이브러리 turtle.py를 그대로 불러와 TNavigator(이동·회전·circle 수학)를 씁니다.

사용법 (python3 -I 로 실행해 spike 폴더의 turtle.py가 표준 turtle을 가리지 않게 함)
  python3 -I test/crosscheck.py                 # 표 출력 (shim@CPython vs CPython)
  python3 -I test/crosscheck.py --json          # 기대값 JSON (브라우저 비교용)
  python3 -I test/crosscheck.py --fixtures DIR  # 예제/검증용 명령 스트림 JSON 저장
"""
import importlib.util
import json
import os
import sys
import sysconfig
import types

HERE = os.path.dirname(os.path.abspath(__file__))
SPIKE = os.path.dirname(HERE)

PROGRAMS = {
    'square_star': '''
import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(100)
    t.left(90)
t.penup(); t.goto(-50, 30); t.pendown()
for i in range(5):
    t.forward(200)
    t.right(144)
t.setheading(45); t.forward(70.7); t.back(12.5); t.home()
t.right(17.25); t.forward(33)
''',
    'spiral': '''
import turtle
t = turtle.Turtle()
for i in range(200):
    t.forward(i * 1.5)
    t.left(59)
t.setheading(123.4); t.back(33)
for i in range(37):
    t.right(i * 7.3)
    t.forward(11.1)
''',
    'circles': '''
import turtle, math
t = turtle.Turtle()
t.circle(50)
t.circle(-30, 90)
t.circle(80, 270, 7)
t.circle(40, steps=6)
t.left(33.3)
t.circle(25.5, -120)
t.setx(10); t.sety(-20)
t.circle(100, 45)
t.goto(37.5, -12.25)
for i in range(36):
    for j in range(2):
        t.circle(100, 60)
        t.left(120)
    t.right(10)
t.radians(); t.left(math.pi / 3); t.forward(50); t.degrees()
t.circle(-63.2, 333)
''',
}

RESULT = '\nprint("RESULT", t.xcor(), t.ycor(), t.heading(), t.towards(0, 0), t.distance(0, 0))\n'


# ---------------------------------------------------------------- CPython turtle

def load_cpython_turtle():
    class _Dummy(object):
        def __init__(self, *a, **k):
            pass

    tk = types.ModuleType('tkinter')
    for name in ('Frame', 'Tk', 'Canvas', 'Scrollbar', 'Toplevel', 'Label', 'Button',
                 'Entry', 'PhotoImage', 'Misc'):
        setattr(tk, name, type(name, (_Dummy,), {}))
    for name in ('ROUND', 'BOTH', 'YES', 'NW', 'N', 'S', 'E', 'W', 'CENTER', 'LEFT',
                 'RIGHT', 'HORIZONTAL', 'VERTICAL', 'END', 'ALL'):
        setattr(tk, name, name.lower())
    tk.TclError = type('TclError', (Exception,), {})
    sd = types.ModuleType('tkinter.simpledialog')
    sd.Dialog = _Dummy
    sd.askstring = sd.askfloat = lambda *a, **k: None
    tk.simpledialog = sd
    sys.modules['tkinter'] = tk
    sys.modules['tkinter.simpledialog'] = sd
    path = os.path.join(sysconfig.get_paths()['stdlib'], 'turtle.py')
    spec = importlib.util.spec_from_file_location('cpython_turtle', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod, path


def oracle_module(cpy):
    """TNavigator(진짜 CPython 수학)에 펜 관련 메서드만 빈 동작으로 붙인 Turtle."""
    noop = lambda self, *a, **k: None

    class Nav(cpy.TNavigator):
        def __init__(self):
            self.trace = []
            cpy.TNavigator.__init__(self)

        def _goto(self, end):
            self._position = end
            self.trace.append((end[0], end[1]))

    for name in ('penup', 'pendown', 'pu', 'pd', 'up', 'down', 'color', 'pencolor',
                 'fillcolor', 'begin_fill', 'end_fill', 'pensize', 'width', 'shape',
                 'hideturtle', 'showturtle', 'ht', 'st', 'dot', 'write', 'stamp', 'speed'):
        setattr(Nav, name, noop)
    m = types.ModuleType('turtle')
    m.Turtle = Nav
    return m


def load_shim():
    spec = importlib.util.spec_from_file_location('pyroad_turtle', os.path.join(SPIKE, 'turtle.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def shim_module(shim):
    class Rec(shim.Turtle):
        def __init__(self, *a, **k):
            self.trace = []
            shim.Turtle.__init__(self, *a, **k)

        def _goto(self, end):
            shim.Turtle._goto(self, end)
            self.trace.append((self._position[0], self._position[1]))

    m = types.ModuleType('turtle')
    m.Turtle = Rec
    return m


def run(src, module):
    old = sys.modules.get('turtle')
    sys.modules['turtle'] = module
    try:
        g = {'__name__': '__main__'}
        exec(compile(src, '<exec>', 'exec'), g)
        t = g['t']
        final = [t.xcor(), t.ycor(), t.heading(), t.towards(0, 0), t.distance(0, 0)]
        return {'trace': t.trace, 'final': final}
    finally:
        if old is not None:
            sys.modules['turtle'] = old
        else:
            del sys.modules['turtle']


def compare():
    cpy, path = load_cpython_turtle()
    shim = load_shim()
    rows = []
    out = {'python': sys.version.split()[0], 'turtle_py': path, 'programs': {}}
    for name, src in PROGRAMS.items():
        shim._pyroad_begin(None, 10 ** 7, True)
        a = run(src, oracle_module(cpy))
        b = run(src, shim_module(shim))
        n = min(len(a['trace']), len(b['trace']))
        trace_diff = max((abs(a['trace'][i][j] - b['trace'][i][j]) for i in range(n) for j in (0, 1)), default=0.0)
        final_diff = max(abs(x - y) for x, y in zip(a['final'], b['final']))
        rows.append((name, len(a['trace']), len(b['trace']), trace_diff, final_diff, a['final']))
        out['programs'][name] = {
            'src': src + RESULT, 'steps': len(a['trace']), 'final': a['final'],
            'trace': [[round(x, 6), round(y, 6)] for x, y in a['trace']],
        }
    return rows, out


def fixtures(outdir):
    shim = load_shim()
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(SPIKE, 'samples', 'index.json'), encoding='utf-8') as f:
        samples = json.load(f)
    progs = {}
    for s in samples:
        if s['id'] in ('forever', 'forever_silent', 'errors', 'heavy'):
            continue
        with open(os.path.join(SPIKE, 'samples', s['file']), encoding='utf-8') as f:
            progs[s['id']] = f.read()
    # 검사기 음성/양성 테스트용 프로그램
    progs.update({
        'neg_rectangle': 'import turtle\nt=turtle.Turtle()\nfor s in [150,90,150,90]:\n    t.forward(s); t.left(90)\n',
        'neg_open3': 'import turtle\nt=turtle.Turtle()\nfor i in range(3):\n    t.forward(150); t.left(90)\n',
        'neg_bad_angle': 'import turtle\nt=turtle.Turtle()\nfor i in range(4):\n    t.forward(150); t.left(80)\n',
        'pos_square_split': 'import turtle\nt=turtle.Turtle()\nfor i in range(4):\n    t.forward(75); t.forward(75); t.left(90)\n',
        'pos_square_cw_offset': 'import turtle\nt=turtle.Turtle()\nt.penup(); t.goto(40,-80); t.pendown()\nfor i in range(4):\n    t.forward(150); t.right(90)\n',
        'pos_square_midstart': 'import turtle\nt=turtle.Turtle()\nt.forward(75); t.left(90)\nfor i in range(3):\n    t.forward(150); t.left(90)\nt.forward(75)\n',
        'neg_star_unfilled': 'import turtle\nt=turtle.Turtle()\nfor i in range(5):\n    t.forward(200); t.right(144)\n',
        'pos_handmade_circle': 'import turtle\nt=turtle.Turtle()\nfor i in range(36):\n    t.forward(10); t.left(10)\n',
        'pos_circle_r50': 'import turtle\nt=turtle.Turtle()\nt.circle(50)\nt.penup(); t.goto(150,0); t.pendown()\nt.circle(-50)\n',
        'house_ref': 'import turtle\nt=turtle.Turtle()\nfor i in range(4):\n    t.forward(100); t.left(90)\nt.left(90); t.forward(100); t.right(30); t.forward(100); t.right(120); t.forward(100)\n',
        'house_other_order': 'import turtle\nt=turtle.Turtle()\nt.penup(); t.goto(0,100); t.pendown()\nt.goto(50, 186.6); t.goto(100,100); t.goto(100,0); t.goto(0,0); t.goto(0,100); t.goto(100,100)\n',
        'house_missing_roof': 'import turtle\nt=turtle.Turtle()\nfor i in range(4):\n    t.forward(100); t.left(90)\n',
    })
    for name, src in progs.items():
        shim._pyroad_begin(None, 50000, True)
        old = sys.modules.get('turtle')
        sys.modules['turtle'] = shim
        try:
            exec(compile(src, '<exec>', 'exec'), {'__name__': '__main__'})
        finally:
            if old is not None:
                sys.modules['turtle'] = old
            else:
                del sys.modules['turtle']
        shim._pyroad_end()
        with open(os.path.join(outdir, name + '.json'), 'w', encoding='utf-8') as f:
            json.dump(shim._log, f, ensure_ascii=False)
    print('fixtures:', len(progs), '->', outdir)


if __name__ == '__main__':
    if '--fixtures' in sys.argv:
        fixtures(sys.argv[sys.argv.index('--fixtures') + 1])
        sys.exit(0)
    rows, out = compare()
    if '--json' in sys.argv:
        print(json.dumps(out))
        sys.exit(0)
    print('CPython', out['python'], '-', out['turtle_py'])
    print('%-12s %8s %8s %14s %14s  %s' % ('program', 'cpy_pts', 'shim_pts', 'max|trace|', 'max|final|', 'final (x, y, heading, towards, distance)'))
    ok = True
    for name, na, nb, td, fd, final in rows:
        print('%-12s %8d %8d %14.3g %14.3g  %s' % (name, na, nb, td, fd, ', '.join('%.6f' % v for v in final)))
        ok = ok and na == nb and td < 1e-9 and fd < 1e-9
    print('RESULT:', 'MATCH' if ok else 'MISMATCH')
    sys.exit(0 if ok else 1)
