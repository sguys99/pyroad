import turtle

t = turtle.Turtle()
t.speed(0)
t.hideturtle()
t.pencolor("darkcyan")

# 1만 걸음 (명령 2만 개)
for i in range(10000):
    t.forward(i * 0.03)
    t.left(91)
