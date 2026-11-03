"""pyRoad turtle shim (P0-06 spike).

CPython `turtle` 모듈의 어린이용 부분집합입니다. Tk 창에 그리는 대신
그리기 명령을 짧은 JSON 배열 스트림으로 내보내고, 브라우저의 캔버스
렌더러(renderer.js)가 그 스트림을 애니메이션으로 그립니다.

- 이동/회전 수학은 CPython TNavigator와 같은 방식(Vec2D 방향 벡터 + rotate,
  circle의 steps 공식)을 따라 위치와 방향이 CPython과 일치합니다.
- 상태(위치, 방향, 색)는 모두 Python 쪽에 있으므로 position(), heading() 같은
  조회 함수는 JS 왕복 없이 바로 답합니다.
- 명령 스트림 형식은 renderer.js / scene.js 상단 주석 참고.

이 파일은 CPython 소스를 복사하지 않고 같은 알고리즘으로 새로 작성했습니다.
Pyodide 0.27(Python 3.12) 이상과 CPython 3.12 이상에서 동작합니다.
"""

import json as _json
import math as _math
import time as _time
import difflib as _difflib

_SCREEN_FUNCS = [
    'bgcolor', 'bye', 'clearscreen', 'colormode', 'delay', 'done', 'exitonclick',
    'getshapes', 'mainloop', 'mode', 'resetscreen', 'screensize', 'setup',
    'title', 'tracer', 'turtles', 'update', 'window_height', 'window_width',
]
_TURTLE_FUNCS = [
    'back', 'backward', 'begin_fill', 'bk', 'circle', 'clear', 'clearstamp',
    'clearstamps', 'clone', 'color', 'degrees', 'distance', 'dot', 'down',
    'end_fill', 'fd', 'fillcolor', 'filling', 'forward', 'getscreen',
    'goto', 'heading', 'hideturtle', 'home', 'ht', 'isdown',
    'isvisible', 'left', 'lt', 'pd', 'pen', 'pencolor', 'pendown', 'pensize',
    'penup', 'pos', 'position', 'pu', 'radians', 'reset', 'right', 'rt', 'seth',
    'setheading', 'setpos', 'setposition', 'setx', 'sety', 'shape', 'shapesize',
    'showturtle', 'speed', 'st', 'stamp', 'teleport', 'towards', 'turtlesize',
    'up', 'width', 'write', 'xcor', 'ycor',
]
__all__ = ([
    'Turtle', 'RawTurtle', 'Pen', 'RawPen', 'Screen', 'TurtleScreen', 'Vec2D',
    'TurtleGraphicsError', 'Terminator', 'getturtle', 'getpen',
] + _SCREEN_FUNCS + _TURTLE_FUNCS)

# ---------------------------------------------------------------------------
# 에러
# ---------------------------------------------------------------------------


class TurtleGraphicsError(Exception):
    """CPython과 같은 이름의 에러 (메시지는 한국어)."""


class Terminator(TurtleGraphicsError):
    pass


class TurtleNotSupportedError(TurtleGraphicsError):
    pass


class TurtleLimitError(TurtleGraphicsError):
    pass


# CPython turtle에는 있지만 아직 지원하지 않는 기능. 호출하면 친절한 에러.
_UNSUPPORTED = {
    'onclick', 'onrelease', 'ondrag', 'onkey', 'onkeypress', 'onkeyrelease',
    'listen', 'ontimer', 'onscreenclick', 'textinput', 'numinput', 'bgpic',
    'register_shape', 'addshape', 'setworldcoordinates', 'getcanvas', 'undo',
    'setundobuffer', 'undobufferentries', 'begin_poly', 'end_poly', 'get_poly',
    'shapetransform', 'tilt', 'tiltangle', 'settiltangle', 'get_shapepoly',
    'resizemode', 'write_docstringdict',
}

_UNSUPPORTED_HINT = {
    'onkey': '키보드로 움직이기는 3-6 미니 게임에서 배울 예정이에요.',
    'onkeypress': '키보드로 움직이기는 3-6 미니 게임에서 배울 예정이에요.',
    'onkeyrelease': '키보드로 움직이기는 3-6 미니 게임에서 배울 예정이에요.',
    'listen': '키보드로 움직이기는 3-6 미니 게임에서 배울 예정이에요.',
    'onclick': '마우스 클릭은 3-6 미니 게임에서 배울 예정이에요.',
    'onscreenclick': '마우스 클릭은 3-6 미니 게임에서 배울 예정이에요.',
    'textinput': '대신 input()을 써 보세요.',
    'numinput': '대신 int(input())을 써 보세요.',
}


def _unsupported(name):
    hint = _UNSUPPORTED_HINT.get(name, '')
    msg = '이 기능은 아직 지원하지 않아요: %s()' % name
    if hint:
        msg += ' ' + hint

    def _raise(*args, **kwargs):
        raise TurtleNotSupportedError(msg)

    _raise.__name__ = name
    return _raise


class _FriendlyAttributeError(AttributeError):
    # Python 3.12+는 AttributeError에 name/obj를 채워 "Did you mean ...?"을 덧붙임.
    # 우리 한국어 제안과 겹치지 않게 name을 항상 None으로 둠.
    @property
    def name(self):
        return None

    @name.setter
    def name(self, value):
        pass


# traceback에는 그냥 'AttributeError'로 보이게
_FriendlyAttributeError.__name__ = _FriendlyAttributeError.__qualname__ = 'AttributeError'
_FriendlyAttributeError.__module__ = 'builtins'


def _no_such(name, candidates, owner):
    best = _difflib.get_close_matches(name, candidates, n=1, cutoff=0.6)
    msg = "%s에는 '%s'라는 기능이 없어요." % (owner, name)
    if best:
        msg += " 혹시 '%s'를 쓰려고 했나요?" % best[0]
    return _FriendlyAttributeError(msg)


def _num(value, func, arg='값'):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(
            '%s()의 %s에는 숫자를 넣어야 해요. 지금 넣은 값: %r' % (func, arg, value))
    if not _math.isfinite(value):
        raise ValueError('%s()에 넣은 숫자가 너무 커요: %r' % (func, value))
    return value


# ---------------------------------------------------------------------------
# Vec2D (CPython과 같은 동작)
# ---------------------------------------------------------------------------


class Vec2D(tuple):
    def __new__(cls, x, y):
        return tuple.__new__(cls, (x, y))

    def __add__(self, other):
        return Vec2D(self[0] + other[0], self[1] + other[1])

    def __mul__(self, other):
        if isinstance(other, Vec2D):
            return self[0] * other[0] + self[1] * other[1]
        return Vec2D(self[0] * other, self[1] * other)

    def __rmul__(self, other):
        if isinstance(other, (int, float)):
            return Vec2D(self[0] * other, self[1] * other)
        return NotImplemented

    def __sub__(self, other):
        return Vec2D(self[0] - other[0], self[1] - other[1])

    def __neg__(self):
        return Vec2D(-self[0], -self[1])

    def __abs__(self):
        return _math.hypot(*self)

    def rotate(self, angle):
        perp = Vec2D(-self[1], self[0])
        angle = _math.radians(angle)
        c, s = _math.cos(angle), _math.sin(angle)
        return Vec2D(self[0] * c + perp[0] * s, self[1] * c + perp[1] * s)

    def __getnewargs__(self):
        return (self[0], self[1])

    def __repr__(self):
        return '(%.2f,%.2f)' % self


# ---------------------------------------------------------------------------
# 색
# ---------------------------------------------------------------------------

# CSS named colors (Tk 이름과 대부분 같음). 공백/대소문자는 무시하고 비교.
_CSS_COLORS = set('''
aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond
blue blueviolet brown burlywood cadetblue chartreuse chocolate coral
cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey
darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod
gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod
palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon
sandybrown seagreen seashell sienna silver skyblue slateblue slategray
slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet
wheat white whitesmoke yellow yellowgreen
'''.split())

# 한국어 색 이름 (pyRoad 확장. CPython에는 없음 → 보고서 7절 확인 필요)
_KO_COLORS = {
    '빨강': 'red', '빨간색': 'red', '주황': 'orange', '주황색': 'orange',
    '노랑': 'yellow', '노란색': 'yellow', '초록': 'green', '초록색': 'green',
    '연두': 'yellowgreen', '연두색': 'yellowgreen', '파랑': 'blue',
    '파란색': 'blue', '하늘색': 'skyblue', '남색': 'navy', '보라': 'purple',
    '보라색': 'purple', '분홍': 'pink', '분홍색': 'pink', '검정': 'black',
    '검은색': 'black', '하양': 'white', '흰색': 'white', '회색': 'gray',
    '갈색': 'brown', '금색': 'gold', '은색': 'silver',
}
KOREAN_COLOR_NAMES = True

_HEX = set('0123456789abcdefABCDEF')


def _color_from_string(s):
    """문자열 색 → CSS 색 문자열. 모르는 색이면 친절한 에러."""
    if s == '':
        return ''
    if s.startswith('#'):
        body = s[1:]
        if len(body) in (3, 6, 9, 12) and all(c in _HEX for c in body):
            if len(body) in (9, 12):  # Tk #rrrgggbbb → #rrggbb
                n = len(body) // 3
                body = ''.join(body[i * n:i * n + 2] for i in range(3))
            return '#' + body.lower()
        raise TurtleGraphicsError("색 코드가 이상해요: '%s' (예: '#ff8800')" % s)
    if KOREAN_COLOR_NAMES and s.strip() in _KO_COLORS:
        return _KO_COLORS[s.strip()]
    key = s.replace(' ', '').lower()
    if key in _CSS_COLORS:
        return key
    if key[:4] in ('gray', 'grey') and key[4:].isdigit() and 0 <= int(key[4:]) <= 100:
        v = round(int(key[4:]) * 255 / 100)
        return '#%02x%02x%02x' % (v, v, v)
    names = sorted(_CSS_COLORS) + (list(_KO_COLORS) if KOREAN_COLOR_NAMES else [])
    best = _difflib.get_close_matches(key, names, n=1, cutoff=0.6)
    msg = "이 색 이름은 몰라요: '%s'" % s
    if best:
        msg += " 혹시 '%s'?" % best[0]
    raise TurtleGraphicsError(msg)


def _colorspec(args, func):
    """CPython _colorstr와 같은 규칙. (사용자가 준 값, CSS 문자열) 반환."""
    if len(args) == 1:
        c = args[0]
    else:
        c = tuple(args)
    if isinstance(c, str):
        return c, _color_from_string(c)
    try:
        r, g, b = c
    except (TypeError, ValueError):
        raise TurtleGraphicsError('%s()에 넣은 색이 이상해요: %r' % (func, c))
    for v in (r, g, b):
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            raise TurtleGraphicsError('%s()에 넣은 색이 이상해요: %r' % (func, c))
    cm = _screen_or_none()._colormode if _screen_or_none() else 1.0
    if cm == 1.0:
        rr, gg, bb = [round(255.0 * x) for x in (r, g, b)]
    else:
        rr, gg, bb = r, g, b
    if not all(0 <= v <= 255 for v in (rr, gg, bb)):
        if cm == 1.0:
            raise TurtleGraphicsError(
                '색 숫자는 0~1 사이여야 해요: %r (0~255를 쓰려면 colormode(255))' % (c,))
        raise TurtleGraphicsError('색 숫자는 0~255 사이여야 해요: %r' % (c,))
    return None, '#%02x%02x%02x' % (int(rr), int(gg), int(bb))


def _color_out(spec, css):
    """pencolor() 같은 조회 함수가 돌려줄 값 (CPython과 같게)."""
    if spec is not None:
        return spec
    if not css.startswith('#') or len(css) != 7:
        return css
    rgb = tuple(int(css[i:i + 2], 16) for i in (1, 3, 5))
    cm = _screen_or_none()._colormode if _screen_or_none() else 1.0
    if cm == 1.0:
        return tuple(v / 255.0 for v in rgb)
    return rgb


# ---------------------------------------------------------------------------
# 명령 스트림
# ---------------------------------------------------------------------------

_cfg = {
    'max_commands': 50000,   # 무한 반복 안전장치
    'stream': True,          # False면 끝날 때 한 번에 보냄 (비교 측정용)
    'chunk_max': 1024,
    'flush_ms': 30,          # 첫 전송 뒤에는 30ms 또는 1,024개마다 보냄
    'first_ms': 40,          # 첫 전송은 40ms 뒤 (짧은 프로그램은 한 번에). 0이면 1→4→16… 즉시 전송
}
_sink = None          # callable(str) — 워커가 넣어 줌. None이면 _log에 쌓음
_log = []             # sink가 없을 때(CPython 교차 검증) 전체 명령
_buf = []
_stats = {'commands': 0, 'messages': 0, 'chars': 0, 'limit_hit': False}
_chunk = [1]
_last_flush = [0.0]


def _r(v):
    v = round(v, 2)
    if v == int(v):
        return int(v)
    return v


def _flush():
    if not _buf:
        return
    s = _json.dumps(_buf, separators=(',', ':'), ensure_ascii=False)
    _stats['messages'] += 1
    _stats['chars'] += len(s)
    _buf.clear()
    _last_flush[0] = _time.perf_counter()
    _chunk[0] = min(_chunk[0] * 4, _cfg['chunk_max'])
    if _sink is not None:
        _sink(s)
    else:
        _log.extend(_json.loads(s))


def _emit(cmd):
    n = _stats['commands'] + 1
    if n > _cfg['max_commands']:
        _stats['limit_hit'] = True
        raise TurtleLimitError(
            '그림 명령이 너무 많아요 (최대 %s개). 끝나지 않는 반복(while True)이 있는지 '
            '확인해 보세요!' % format(_cfg['max_commands'], ','))
    _stats['commands'] = n
    _buf.append(cmd)
    if not _cfg['stream']:
        return
    if len(_buf) >= _chunk[0]:
        _flush()
    elif (n & 7) == 0:
        wait = _cfg['flush_ms'] if _stats['messages'] else _cfg['first_ms']
        if (_time.perf_counter() - _last_flush[0]) * 1000 >= wait:
            _flush()


# ---------------------------------------------------------------------------
# Screen
# ---------------------------------------------------------------------------

_SHAPES = ('classic', 'arrow', 'turtle', 'circle', 'square', 'triangle', 'blank', 'pybaem')
_DEFAULT_VIEW = (600, 600)
_the_screen = [None]


def _screen_or_none():
    return _the_screen[0]


class _Screen(object):
    def __init__(self):
        self._turtles = []
        self._next_id = 0
        self._colormode = 1.0
        self._tracing = 1
        self._delayvalue = 10
        self._bg = ('white', 'white')
        self._view = _DEFAULT_VIEW
        self._title = None

    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError(name)
        if name in _UNSUPPORTED:
            return _unsupported(name)
        raise _no_such(name, _SCREEN_METHODS, '화면(Screen)')

    def _register(self, t):
        tid = self._next_id
        self._next_id += 1
        self._turtles.append(t)
        return tid

    def bgcolor(self, *args):
        if not args:
            return _color_out(*self._bg)
        self._bg = _colorspec(args, 'bgcolor')
        _emit(['bg', self._bg[1]])

    def colormode(self, cmode=None):
        if cmode is None:
            return self._colormode
        if cmode == 1.0:
            self._colormode = 1.0
        elif cmode == 255:
            self._colormode = 255
        else:
            raise TurtleGraphicsError('colormode()에는 1.0 또는 255만 넣을 수 있어요.')

    def tracer(self, n=None, delay=None):
        if n is None:
            return self._tracing
        self._tracing = 1 if _num(n, 'tracer') else 0
        if delay is not None:
            self._delayvalue = int(delay)
        _emit(['tr', self._tracing])

    def update(self):
        _emit(['u'])

    def delay(self, delay=None):
        if delay is None:
            return self._delayvalue
        self._delayvalue = int(_num(delay, 'delay'))

    def setup(self, width=None, height=None, startx=None, starty=None):
        w, h = self._view
        if isinstance(width, (int, float)) and width > 1:
            w = int(width)
        if isinstance(height, (int, float)) and height > 1:
            h = int(height)
        self._view = (w, h)
        _emit(['v', w, h])

    def screensize(self, canvwidth=None, canvheight=None, bg=None):
        if canvwidth is None and canvheight is None and bg is None:
            return self._view
        self.setup(canvwidth, canvheight)
        if bg is not None:
            self.bgcolor(bg)

    def window_width(self):
        return self._view[0]

    def window_height(self):
        return self._view[1]

    def title(self, titlestring):
        self._title = str(titlestring)
        _emit(['t', self._title])

    def mode(self, mode=None):
        if mode is None or mode == 'standard':
            return 'standard' if mode is None else None
        raise TurtleNotSupportedError("이 기능은 아직 지원하지 않아요: mode('%s')" % mode)

    def turtles(self):
        return list(self._turtles)

    def getshapes(self):
        return sorted(_SHAPES)

    def clear(self):
        """clearscreen: 모든 그림과 거북이를 지우고 처음 상태로."""
        self._turtles = []
        self._colormode = 1.0
        self._tracing = 1
        self._bg = ('white', 'white')
        Turtle._pen = None
        _emit(['C'])

    clearscreen = clear

    def reset(self):
        for t in self._turtles:
            t.reset()

    resetscreen = reset

    def mainloop(self):
        pass

    done = mainloop

    def exitonclick(self):
        pass

    def bye(self):
        pass


def Screen():
    if _the_screen[0] is None:
        _the_screen[0] = _Screen()
    return _the_screen[0]


TurtleScreen = _Screen

# ---------------------------------------------------------------------------
# Turtle
# ---------------------------------------------------------------------------

_SPEEDS = {'fastest': 0, 'fast': 10, 'normal': 6, 'slow': 3, 'slowest': 1}


class Turtle(object):
    _pen = None

    def __init__(self, shape='classic', undobuffersize=1000, visible=True, _copy=None):
        if not isinstance(shape, str):   # RawTurtle(canvas) 형태 대비
            shape = 'classic'
        self.screen = Screen()
        self._id = self.screen._register(self)
        self._degreesPerAU = 1.0
        self._fullcircle = 360.0
        self._stamps = []
        if _copy is not None:
            self.__dict__.update({k: v for k, v in _copy.__dict__.items()
                                  if k not in ('_id', '_stamps', 'screen')})
            self._filling = False
        else:
            self._reset_state(shape, visible)
        _emit(['n', self._id, self._snapshot()])

    # --- 내부 -------------------------------------------------------------
    def _reset_state(self, shape='classic', visible=True):
        self._position = Vec2D(0.0, 0.0)
        self._orient = Vec2D(1.0, 0.0)
        self._drawing = True
        self._pencolor = ('black', 'black')
        self._fillcolor = ('black', 'black')
        self._pensize = 1
        self._speed = 3
        self._shown = visible
        self._shape = shape if shape in _SHAPES else 'classic'
        self._stretch = (1.0, 1.0, 1)
        self._filling = False

    def _heading_std(self):
        x, y = self._orient
        return _math.degrees(_math.atan2(y, x)) % 360.0

    def _snapshot(self):
        return {
            'x': _r(self._position[0]), 'y': _r(self._position[1]),
            'h': _r(self._heading_std()), 'd': 1 if self._drawing else 0,
            'pc': self._pencolor[1], 'fc': self._fillcolor[1], 'w': _r(self._pensize),
            'sp': self._speed, 'v': 1 if self._shown else 0, 'sh': self._shape,
            'sz': list(self._stretch),
        }

    def _state(self, **kw):
        _emit(['s', self._id, kw])

    def _goto(self, end):
        x, y = end
        if not (_math.isfinite(x) and _math.isfinite(y)):
            raise ValueError('거북이가 갈 수 없는 위치예요: %r' % (end,))
        self._position = Vec2D(x, y)
        _emit(['m', self._id, _r(x), _r(y)])

    def _go(self, distance):
        self._goto(self._position + self._orient * distance)

    def _rotate(self, angle, instant=False):
        angle *= self._degreesPerAU
        self._orient = self._orient.rotate(angle)
        cmd = ['r', self._id, _r(angle), _r(self._heading_std())]
        if instant:
            cmd.append(0)
        _emit(cmd)

    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError(name)
        if name in _UNSUPPORTED:
            return _unsupported(name)
        raise _no_such(name, _TURTLE_METHODS, '거북이(Turtle)')

    def __repr__(self):
        return '<turtle.Turtle %d>' % self._id

    # --- 이동 -------------------------------------------------------------
    def forward(self, distance):
        self._go(_num(distance, 'forward', '거리'))

    fd = forward

    def back(self, distance):
        self._go(-_num(distance, 'back', '거리'))

    bk = back
    backward = back

    def right(self, angle):
        self._rotate(-_num(angle, 'right', '각도'))

    rt = right

    def left(self, angle):
        self._rotate(_num(angle, 'left', '각도'))

    lt = left

    def goto(self, x, y=None):
        if y is None:
            try:
                x, y = x
            except (TypeError, ValueError):
                raise TypeError('goto()에는 x, y 두 숫자를 넣어야 해요. 예: goto(100, 50)')
        self._goto(Vec2D(_num(x, 'goto', 'x'), _num(y, 'goto', 'y')))

    setpos = goto
    setposition = goto

    def teleport(self, x=None, y=None, *, fill_gap=False):
        nx = self._position[0] if x is None else _num(x, 'teleport', 'x')
        ny = self._position[1] if y is None else _num(y, 'teleport', 'y')
        self._position = Vec2D(nx, ny)
        _emit(['j', self._id, _r(nx), _r(ny)])

    def setx(self, x):
        self._goto(Vec2D(_num(x, 'setx', 'x'), self._position[1]))

    def sety(self, y):
        self._goto(Vec2D(self._position[0], _num(y, 'sety', 'y')))

    def home(self):
        self.goto(0, 0)
        self.setheading(0)

    def setheading(self, to_angle):
        to_angle = _num(to_angle, 'setheading', '각도')
        angle = to_angle - self.heading()
        full = self._fullcircle
        angle = (angle + full / 2.) % full - full / 2.
        self._rotate(angle)

    seth = setheading

    def circle(self, radius, extent=None, steps=None):
        radius = _num(radius, 'circle', '반지름')
        if extent is None:
            extent = self._fullcircle
        extent = _num(extent, 'circle', 'extent')
        if steps is None:
            frac = abs(extent) / self._fullcircle
            steps = 1 + int(min(11 + abs(radius) / 6.0, 59.0) * frac)
        steps = int(_num(steps, 'circle', 'steps'))
        if steps < 1:
            raise ValueError('circle()의 steps는 1 이상이어야 해요.')
        w = 1.0 * extent / steps
        w2 = 0.5 * w
        l = 2.0 * radius * _math.sin(_math.radians(w2) * self._degreesPerAU)
        if radius < 0:
            l, w, w2 = -l, -w, -w2
        # CPython처럼: 회전은 즉시, 이동만 애니메이션
        self._rotate(w2, instant=True)
        for _ in range(steps):
            self._go(l)
            self._rotate(w, instant=True)
        self._rotate(-w2, instant=True)

    def degrees(self, fullcircle=360.0):
        self._fullcircle = fullcircle
        self._degreesPerAU = 360 / fullcircle

    def radians(self):
        self.degrees(_math.tau)

    # --- 조회 -------------------------------------------------------------
    def position(self):
        return self._position

    pos = position

    def xcor(self):
        return self._position[0]

    def ycor(self):
        return self._position[1]

    def heading(self):
        x, y = self._orient
        result = round(_math.degrees(_math.atan2(y, x)), 10) % 360.0
        result /= self._degreesPerAU
        return result % self._fullcircle

    def _target(self, x, y, func):
        if y is not None:
            return Vec2D(_num(x, func, 'x'), _num(y, func, 'y'))
        if isinstance(x, Turtle):
            return x._position
        try:
            a, b = x
        except (TypeError, ValueError):
            raise TypeError('%s()에는 x, y 또는 다른 거북이를 넣어야 해요.' % func)
        return Vec2D(a, b)

    def distance(self, x, y=None):
        return abs(self._target(x, y, 'distance') - self._position)

    def towards(self, x, y=None):
        dx, dy = self._target(x, y, 'towards') - self._position
        result = round(_math.degrees(_math.atan2(dy, dx)), 10) % 360.0
        result /= self._degreesPerAU
        return result % self._fullcircle

    # --- 펜 ---------------------------------------------------------------
    def pendown(self):
        if not self._drawing:
            self._drawing = True
            self._state(d=1)

    pd = pendown
    down = pendown

    def penup(self):
        if self._drawing:
            self._drawing = False
            self._state(d=0)

    pu = penup
    up = penup

    def isdown(self):
        return self._drawing

    def pensize(self, width=None):
        if width is None:
            return self._pensize
        self._pensize = _num(width, 'pensize', '굵기')
        self._state(w=_r(self._pensize))

    width = pensize

    def pencolor(self, *args):
        if not args:
            return _color_out(*self._pencolor)
        self._pencolor = _colorspec(args, 'pencolor')
        self._state(pc=self._pencolor[1])

    def fillcolor(self, *args):
        if not args:
            return _color_out(*self._fillcolor)
        self._fillcolor = _colorspec(args, 'fillcolor')
        self._state(fc=self._fillcolor[1])

    def color(self, *args):
        if not args:
            return _color_out(*self._pencolor), _color_out(*self._fillcolor)
        if len(args) == 1:
            pc = fc = _colorspec(args, 'color')
        elif len(args) == 2:
            pc = _colorspec((args[0],), 'color')
            fc = _colorspec((args[1],), 'color')
        elif len(args) == 3:
            pc = fc = _colorspec(args, 'color')
        else:
            raise TurtleGraphicsError('color()에는 색을 1개나 2개 넣어요. 예: color("red", "yellow")')
        self._pencolor, self._fillcolor = pc, fc
        self._state(pc=pc[1], fc=fc[1])

    def showturtle(self):
        self._shown = True
        self._state(v=1)

    st = showturtle

    def hideturtle(self):
        self._shown = False
        self._state(v=0)

    ht = hideturtle

    def isvisible(self):
        return self._shown

    def speed(self, speed=None):
        if speed is None:
            return self._speed
        if speed in _SPEEDS:
            speed = _SPEEDS[speed]
        elif isinstance(speed, str):
            raise TurtleGraphicsError(
                "speed()에는 0~10 숫자나 'slow', 'normal', 'fast', 'fastest'를 넣어요.")
        elif 0.5 < _num(speed, 'speed') < 10.5:
            speed = int(round(speed))
        else:
            speed = 0
        self._speed = speed
        self._state(sp=speed)

    def shape(self, name=None):
        if name is None:
            return self._shape
        if name not in _SHAPES:
            raise TurtleGraphicsError(
                "'%s' 모양은 없어요. 쓸 수 있는 모양: %s" % (name, ', '.join(_SHAPES)))
        self._shape = name
        self._state(sh=name)

    def shapesize(self, stretch_wid=None, stretch_len=None, outline=None):
        if stretch_wid is None and stretch_len is None and outline is None:
            return self._stretch
        sw, sl, ol = self._stretch
        if stretch_wid is not None:
            sw = _num(stretch_wid, 'shapesize')
            sl = sw if stretch_len is None else sl
        if stretch_len is not None:
            sl = _num(stretch_len, 'shapesize')
        if outline is not None:
            ol = _num(outline, 'shapesize')
        self._stretch = (sw, sl, ol)
        self._state(sz=[sw, sl, ol])

    turtlesize = shapesize

    def pen(self, pen=None, **pendict):
        if pen is None and not pendict:
            return {
                'shown': self._shown, 'pendown': self._drawing,
                'pencolor': self.pencolor(), 'fillcolor': self.fillcolor(),
                'pensize': self._pensize, 'speed': self._speed,
                'resizemode': 'noresize', 'stretchfactor': self._stretch[:2],
                'outline': self._stretch[2], 'tilt': 0.0,
            }
        p = dict(pen or {})
        p.update(pendict)
        for key, val in p.items():
            if key == 'shown':
                self.showturtle() if val else self.hideturtle()
            elif key == 'pendown':
                self.pendown() if val else self.penup()
            elif key == 'pencolor':
                self.pencolor(val)
            elif key == 'fillcolor':
                self.fillcolor(val)
            elif key == 'pensize':
                self.pensize(val)
            elif key == 'speed':
                self.speed(val)
            elif key in ('resizemode', 'stretchfactor', 'outline', 'tilt'):
                pass
            else:
                raise TurtleGraphicsError("pen()에서 모르는 설정이에요: '%s'" % key)

    # --- 채우기, 점, 도장, 글씨 -----------------------------------------------
    def filling(self):
        return self._filling

    def begin_fill(self):
        self._filling = True
        _emit(['bf', self._id])

    def end_fill(self):
        if self._filling:
            self._filling = False
            _emit(['ef', self._id])

    def dot(self, size=None, *color):
        if size is not None and not isinstance(size, (int, float)):
            color = (size,) + color
            size = None
        if size is None:
            size = self._pensize + max(self._pensize, 4)
        size = _num(size, 'dot', '크기')
        css = _colorspec(color, 'dot')[1] if color else self._pencolor[1]
        _emit(['d', self._id, _r(size), css])

    def stamp(self):
        sid = _next_stamp[0]
        _next_stamp[0] += 1
        self._stamps.append(sid)
        _emit(['sp', self._id, sid])
        return sid

    def clearstamp(self, stampid):
        if stampid in self._stamps:
            self._stamps.remove(stampid)
            _emit(['cs', self._id, stampid])

    def clearstamps(self, n=None):
        if n is None:
            targets = self._stamps[:]
        elif n >= 0:
            targets = self._stamps[:n]
        else:
            targets = self._stamps[n:]
        for sid in targets:
            self.clearstamp(sid)

    def write(self, arg, move=False, align='left', font=('Arial', 8, 'normal')):
        text = str(arg)
        if align not in ('left', 'center', 'right'):
            raise TurtleGraphicsError("align에는 'left', 'center', 'right' 중 하나를 넣어요.")
        if isinstance(font, str):
            font = (font,)
        family = str(font[0]) if len(font) > 0 else 'Arial'
        size = font[1] if len(font) > 1 else 8
        size = abs(_num(size, 'write', '글자 크기'))
        style = str(font[2]) if len(font) > 2 else 'normal'
        _emit(['w', self._id, text, align, family, _r(size), style])
        if move:
            # 글자 폭은 브라우저에서만 정확히 알 수 있어 근사합니다 (보고서 7절).
            px = size * 4 / 3
            width = sum(px if ord(ch) > 0x2E80 else px * 0.56 for ch in text)
            if align == 'center':
                width /= 2
            elif align == 'right':
                width = 0
            self._goto(Vec2D(self._position[0] + width, self._position[1]))

    # --- 지우기 -------------------------------------------------------------
    def clear(self):
        self._stamps = []
        self._filling = False   # CPython: clear()는 진행 중인 채우기도 취소
        _emit(['c', self._id])

    def reset(self):
        shape = self._shape
        self._reset_state(shape, True)
        self._degreesPerAU = 1.0
        self._fullcircle = 360.0
        self._stamps = []
        _emit(['c', self._id])
        _emit(['j', self._id, 0, 0, 0])
        self._state(**self._snapshot())

    # --- 기타 ---------------------------------------------------------------
    def getscreen(self):
        return self.screen

    def getturtle(self):
        return self

    getpen = getturtle

    def clone(self):
        return Turtle(_copy=self)


RawTurtle = Turtle
Pen = Turtle
RawPen = Turtle
_next_stamp = [1]

_TURTLE_METHODS = sorted(n for n in dir(Turtle) if not n.startswith('_'))
_SCREEN_METHODS = sorted(n for n in dir(_Screen) if not n.startswith('_'))


# ---------------------------------------------------------------------------
# 모듈 수준 함수 (기본 거북이 / 기본 화면에 연결)
# ---------------------------------------------------------------------------


def getturtle():
    if Turtle._pen is None:
        Turtle._pen = Turtle()
    return Turtle._pen


getpen = getturtle


def _make_turtle_func(name):
    def func(*args, **kwargs):
        return getattr(getturtle(), name)(*args, **kwargs)
    func.__name__ = name
    return func


def _make_screen_func(name):
    def func(*args, **kwargs):
        return getattr(Screen(), name)(*args, **kwargs)
    func.__name__ = name
    return func


for _name in _SCREEN_FUNCS:
    globals()[_name] = _make_screen_func(_name)
for _name in _TURTLE_FUNCS:
    globals()[_name] = _make_turtle_func(_name)
del _name


def __getattr__(name):  # PEP 562: turtle.forwrd(10) 같은 오타 안내
    if name.startswith('__'):
        raise AttributeError(name)
    if name in _UNSUPPORTED:
        return _unsupported(name)
    raise _no_such(name, __all__, 'turtle')


# ---------------------------------------------------------------------------
# 워커 연동
# ---------------------------------------------------------------------------


def _pyroad_begin(sink=None, max_commands=50000, stream=True, first_ms=40):
    """실행 전마다 호출: 상태 초기화."""
    global _sink
    _sink = sink
    _cfg['max_commands'] = int(max_commands)
    _cfg['stream'] = bool(stream)
    _cfg['first_ms'] = first_ms
    _buf.clear()
    _log.clear()
    _stats.update(commands=0, messages=0, chars=0, limit_hit=False)
    _chunk[0] = 1 if not first_ms else _cfg['chunk_max']
    _last_flush[0] = _time.perf_counter()
    _next_stamp[0] = 1
    _the_screen[0] = None
    Turtle._pen = None


def _pyroad_end():
    """실행 후 호출: 남은 명령을 보내고 요약(JSON 문자열)을 돌려줌."""
    _flush()
    scr = _the_screen[0]
    turtles = []
    if scr is not None:
        for t in scr._turtles:
            turtles.append({
                'id': t._id, 'x': t._position[0], 'y': t._position[1],
                'heading': t.heading(), 'pendown': t._drawing,
                'pencolor': t._pencolor[1], 'fillcolor': t._fillcolor[1],
            })
    out = dict(_stats)
    out['turtles'] = turtles
    out['used'] = scr is not None
    return _json.dumps(out)
