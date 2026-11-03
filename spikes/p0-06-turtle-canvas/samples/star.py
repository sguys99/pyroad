from turtle import *

shape("turtle")
color("darkorange", "gold")
pensize(3)
speed(6)

penup()
goto(-110, 40)
pendown()

begin_fill()
for i in range(5):
    forward(220)
    right(144)
end_fill()
