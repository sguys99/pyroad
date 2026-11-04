import turtle

t = turtle.Turtle()
t.forward(100)

# 그림 없이 계속 도는 반복 → 실행 시간 제한(5초)에 걸려 워커를 다시 시작
n = 0
while True:
    n = n + 1
