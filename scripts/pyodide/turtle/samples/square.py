import turtle

t = turtle.Turtle()
t.shape("turtle")
t.color("seagreen", "palegreen")
t.pensize(4)

# 정사각형: 앞으로 150, 왼쪽으로 90도를 4번!
for i in range(4):
    t.forward(150)
    t.left(90)
