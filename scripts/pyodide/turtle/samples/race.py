import turtle
import random

judge = turtle.Turtle()
judge.hideturtle()
judge.speed(0)
judge.penup()
judge.goto(220, 120)
judge.right(90)
judge.pendown()
judge.pensize(3)
judge.pencolor("gray")
judge.forward(240)     # 결승선

a = turtle.Turtle()
b = turtle.Turtle()
for runner, y, c in [(a, 60, "tomato"), (b, -60, "royalblue")]:
    runner.shape("turtle")
    runner.color(c)
    runner.pensize(3)
    runner.penup()
    runner.goto(-230, y)
    runner.pendown()

# 번갈아 한 걸음씩
while a.xcor() < 220 and b.xcor() < 220:
    a.forward(random.randint(2, 14))
    b.forward(random.randint(2, 14))

winner = "빨강" if a.xcor() >= b.xcor() else "파랑"
judge.penup()
judge.goto(0, 150)
judge.write(winner + " 거북이 승리!", align="center", font=("Arial", 24, "bold"))
print("이긴 거북이:", winner)
