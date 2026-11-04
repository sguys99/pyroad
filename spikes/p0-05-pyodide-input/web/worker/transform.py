# 방식 ③ 소스 변환: input()을 `await input()`으로 바꾸고, input을 (간접적으로라도) 부르는 함수를
# `async def`로, 그 함수 호출을 `await f()`로 바꾼다. 이름 기반 정적 분석이라 한계가 분명하다.
# AST를 그대로 compile 하므로 줄 번호는 원본과 같다 (ast.unparse를 쓰면 주석·줄 번호가 깨짐).
import ast
import inspect

SEEDS = {"input"}
_SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)


def _own_calls(fn):
    """fn 본문의 Call 노드. 중첩 def/class/lambda 안은 그 스코프 몫이라 제외."""
    stack = list(ast.iter_child_nodes(fn))
    while stack:
        n = stack.pop()
        if isinstance(n, _SCOPES):
            continue
        if isinstance(n, ast.Call):
            yield n
        stack.extend(ast.iter_child_nodes(n))


def _callee(call):
    f = call.func
    if isinstance(f, ast.Name):
        return f.id
    if isinstance(f, ast.Attribute):
        return f.attr  # obj.method() -> "method" (이름이 같은 다른 메서드도 await 됨!)
    return None


def _analyze(tree):
    funcs = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
    names, marked = set(SEEDS), set()
    changed = True
    while changed:  # 고정점: input을 부르는 함수를 부르는 함수 ...
        changed = False
        for fn in funcs:
            if fn not in marked and any(_callee(c) in names for c in _own_calls(fn)):
                marked.add(fn)
                names.add(fn.name)
                changed = True
    return names, marked


class _Rewrite(ast.NodeTransformer):
    def __init__(self, names, marked):
        self.names, self.marked = names, marked

    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        if node in self.marked:
            new = ast.AsyncFunctionDef(**{f: getattr(node, f, None) for f in node._fields})
            return ast.copy_location(new, node)
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        if _callee(node) in self.names:
            return ast.copy_location(ast.Await(value=node), node)
        return node


def transform(src, filename="<student>"):
    tree = ast.parse(src, filename, "exec")
    names, marked = _analyze(tree)
    tree = ast.fix_missing_locations(_Rewrite(names, marked).visit(tree))
    code = compile(tree, filename, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    return code, sorted(names - SEEDS)


async def run_transformed(src, ns, async_input, report):
    ns["input"] = async_input
    code, made_async = transform(src)
    report(", ".join(made_async) or "없음")
    r = eval(code, ns)
    if inspect.iscoroutine(r):
        await r
