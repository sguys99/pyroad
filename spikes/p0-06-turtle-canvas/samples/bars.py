import turtle

# 3-5 데이터 탐정: 반 친구들이 좋아하는 과일
votes = {"사과": 7, "바나나": 4, "딸기": 9, "포도": 5}
colors = ["tomato", "gold", "hotpink", "mediumpurple"]

t = turtle.Turtle()
t.hideturtle()
t.speed(8)
t.penup()
t.goto(-200, -120)

for i, (fruit, count) in enumerate(votes.items()):
    t.color("dimgray", colors[i])
    t.setheading(90)
    t.pendown()
    t.begin_fill()
    for side in [count * 25, 60, count * 25, 60]:
        t.forward(side)
        t.right(90)
    t.end_fill()
    t.penup()
    x, y = t.position()
    t.goto(x + 30, y + count * 25 + 8)
    t.write(str(count) + "표", align="center", font=("Arial", 14, "bold"))
    t.goto(x + 30, y - 28)
    t.write(fruit, align="center", font=("Arial", 14, "normal"))
    t.goto(x + 100, y)

t.goto(0, 160)
t.color("black")
t.write("우리 반이 좋아하는 과일", align="center", font=("Arial", 18, "bold"))
