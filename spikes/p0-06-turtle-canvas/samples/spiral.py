import turtle

turtle.bgcolor("midnightblue")
t = turtle.Turtle()
t.speed(10)
colors = ["red", "orange", "yellow", "lime", "deepskyblue", "violet"]

# 무지개 나선: 조금씩 길게, 59도씩 돌기
for i in range(180):
    t.pencolor(colors[i % 6])
    t.width(i // 45 + 1)
    t.forward(i * 1.6)
    t.left(59)
t.hideturtle()
