import turtle

t = turtle.Turtle()
t.speed(9)
petal_colors = ["hotpink", "orchid", "lightcoral", "plum"]

# 꽃잎: 원 12개를 30도씩 돌려 가며
for i in range(12):
    t.color("mediumvioletred", petal_colors[i % 4])
    t.begin_fill()
    t.circle(70)
    t.end_fill()
    t.left(30)

# 가운데 꽃술
t.dot(40, "gold")
t.dot(18, "orange")

# 줄기와 잎
t.penup()
t.goto(0, -150)
t.setheading(90)
t.color("forestgreen", "yellowgreen")
t.pensize(5)
t.pendown()
t.forward(80)
t.begin_fill()
t.circle(-45, 90)
t.right(90)
t.circle(-45, 90)
t.end_fill()
t.hideturtle()
