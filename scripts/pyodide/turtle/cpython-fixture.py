"""turtle shim 교차 검증용 기대값을 진짜 CPython turtle로 만든다 (P11-02, P0-06 §4.4 방식).

tkinter가 없어도 돌도록 가짜 tkinter를 넣고 표준 라이브러리 turtle.py를 그대로 불러와
TNavigator(이동·회전·circle 수학)로 프로그램을 실행한다. 같은 CPython에서 shim(public/workers/turtle.py)도 돌려
**비트 단위까지 같은지** 확인한 뒤(다르면 실패) 결과(거북이마다 x, y, heading)를 JSON으로 저장하고,
scripts/pyodide/__tests__/turtle.pyodide.test.ts가 같은 프로그램을 Node Pyodide + shim으로 돌려 1e-9 안에서 같은지 본다
(Pyodide의 emscripten libm과 이 PC libm의 sin·cos가 마지막 자리에서 다를 수 있어서. 알고리즘 차이는 여기서 잡힌다).

  python3 -I scripts/pyodide/turtle/cpython-fixture.py   # → scripts/pyodide/turtle/cpython-final.json

프로그램은 `import turtle`과 `turtle.Turtle()`만 쓰고, 끝에서 확인할 거북이를 `CHECK` 리스트에 담는다.
"""
import importlib.util
import json
import os
import sys
import sysconfig
import types

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'cpython-final.json')

PROGRAMS = {
    'square': '''
import turtle
t = turtle.Turtle()
for i in range(4):
    t.forward(100)
    t.left(90)
CHECK = [t]
''',
    'polygon_star': '''
import turtle
t = turtle.Turtle()
def polygon(n, size):
    for i in range(n):
        t.forward(size)
        t.left(360 / n)
for n in range(3, 10):
    polygon(n, 40)
t.penup(); t.goto(-50, 30); t.pendown()
for i in range(5):
    t.forward(200)
    t.right(144)
t.setheading(45); t.forward(70.7); t.back(12.5); t.home()
t.right(17.25); t.forward(33)
CHECK = [t]
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
CHECK = [t]
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
CHECK = [t]
''',
    'two_turtles': '''
import turtle
a = turtle.Turtle()
b = turtle.Turtle()
b.left(180)
for i in range(30):
    a.forward(7)
    a.left(13)
    b.forward(5.5)
    b.right(11)
a.goto(b.position())
a.setheading(a.towards(0, 0))
a.forward(a.distance(0, 0) / 3)
CHECK = [a, b]
''',
    'bars': '''
import turtle
t = turtle.Turtle()
data = {'딸기': 7, '바나나': 3, '포도': 5, '사과': 9}
x = -150
for name, count in data.items():
    t.penup(); t.goto(x, -100); t.pendown()
    t.setheading(90)
    t.forward(count * 20)
    t.right(90)
    t.forward(40)
    t.right(90)
    t.forward(count * 20)
    x = x + 70
CHECK = [t]
''',
}


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
    return mod


def oracle(cpy):
    """진짜 TNavigator에 펜 관련 메서드만 빈 동작으로 붙인 turtle 모듈."""
    noop = lambda self, *a, **k: None

    class Nav(cpy.TNavigator):
        def _goto(self, end):
            self._position = end

    for name in ('penup', 'pendown', 'pu', 'pd', 'up', 'down', 'color', 'pencolor',
                 'fillcolor', 'begin_fill', 'end_fill', 'pensize', 'width', 'shape',
                 'hideturtle', 'showturtle', 'ht', 'st', 'dot', 'write', 'stamp', 'speed'):
        setattr(Nav, name, noop)
    m = types.ModuleType('turtle')
    m.Turtle = Nav
    return m


def load_shim():
    path = os.path.join(HERE, '..', '..', '..', 'public', 'workers', 'turtle.py')
    spec = importlib.util.spec_from_file_location('pyroad_turtle', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def final(src, mod):
    sys.modules['turtle'] = mod
    g = {'__name__': '__main__'}
    exec(compile(src, '<exec>', 'exec'), g)
    return [[t.xcor(), t.ycor(), t.heading()] for t in g['CHECK']]


def main():
    cpython = oracle(load_cpython_turtle())
    shim = load_shim()
    out = {'python': sys.version.split()[0], 'programs': {}}
    for name, src in PROGRAMS.items():
        want = final(src, cpython)
        shim._pyroad_begin(None, 10 ** 7)
        got = final(src, shim)
        if got != want:
            sys.exit('%s: shim %r != CPython %r' % (name, got, want))
        out['programs'][name] = {'src': src, 'final': want}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', OUT)


if __name__ == '__main__':
    main()
