import turtle

t = turtle.Turtle()
t.shape("turtle")
t.hideturtle()
t.penup()

t.goto(0, 40)
t.color("tomato")
t.write("안녕!", align="center", font=("Arial", 48, "bold"))

t.goto(0, -20)
t.color("teal")
t.write("거북이 화가 pyRoad", align="center", font=("Arial", 20, "normal"))

# 도장 쾅쾅
t.goto(-120, -100)
t.color("seagreen", "palegreen")
t.showturtle()
for i in range(5):
    t.stamp()
    t.forward(60)
t.goto(0, -170)
t.write("파이썬은 재밌어요", align="center", font=("Arial", 14, "italic"))
t.hideturtle()
