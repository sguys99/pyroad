import turtle
from turtle import *

s = Screen()
s.setup(700, 500)
s.title("API 투어")
s.bgcolor("lavenderblush")
colormode(255)
pencolor(200, 40, 90)
fillcolor("#88ccff")
width(3)
speed("fast")
shape("arrow")
print(pencolor(), fillcolor(), pensize(), speed(), shape(), colormode())
colormode(1.0)
color((0.2, 0.6, 0.3), "gold")
print(color())
begin_fill(); circle(40, steps=6); end_fill()
print(filling(), isdown(), isvisible())
pu(); setpos(-200, 100); pd(); seth(0)
fd(50); bk(20); lt(45); rt(15); setx(-120); sety(120)
print(position(), heading(), xcor(), ycor(), distance(0, 0), towards(0, 0))
home()
dot(); dot(30, "orange"); dot("purple")
sid = stamp(); fd(40); sid2 = stamp(); clearstamp(sid); clearstamps()
write("왼쪽", align="left"); write("가운데", False, "center", ("Arial", 12, "bold"))
write("move", move=True)
t2 = turtle.Turtle(shape="turtle")
t2.shapesize(2, 2, 3)
t2.pen(pencolor="navy", pensize=2, pendown=False)
print(t2.pen()['pencolor'], t2.isdown())
t2.teleport(100, -100)
t3 = t2.clone(); t3.left(90); t3.fd(30)
t2.radians(); t2.left(3.14159 / 2); print(round(t2.heading(), 4)); t2.degrees()
tracer(0); 
for i in range(36): fd(5); lt(10)
update(); tracer(1)
print(window_width(), window_height(), getshapes(), len(turtles()), mode(), delay())
t2.hideturtle(); t2.showturtle(); t2.ht(); t2.st()
t3.clear(); t3.reset()
screensize(800, 600, "white")
for name in ['onkey', 'onclick', 'textinput', 'bgpic', 'undo', 'tilt', 'setworldcoordinates']:
    try:
        getattr(turtle, name)()
    except Exception as e:
        print(type(e).__name__, '|', e)
for bad in [lambda: fd("10"), lambda: color("rde"), lambda: pencolor(300, 0, 0), lambda: goto(1), lambda: shape("cat"), lambda: speed("superfast"), lambda: mode("logo"), lambda: write("x", align="middle"), lambda: fd(float('inf'))]:
    try:
        bad()
    except Exception as e:
        print(type(e).__name__, '|', e)
s.clear()
fd(10)
done(); mainloop(); exitonclick(); bye()
