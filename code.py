import turtle as t

def draw_taegukgi():
    
    t.title("태극기")
    t.speed(0)
    t.bgcolor("white")
    t.shape("turtle")
    t.turtlesize(1)

    # 중심 이동
    t.penup()
    t.goto(0, 0)
    t.pendown()

    tg = 33.7
    jil = 300

    # 태극 문양
    def draw_taeguk():
        t.color("red")
        t.begin_fill()
        t.rt(90 + tg)
        t.circle(-jil/4, 180)
        t.circle(-jil/2, 180)
        t.lt(180)
        t.circle(jil/4, 180)
        t.end_fill()

        t.color("blue")
        t.begin_fill()
        t.circle(-jil/4, 180)
        t.rt(180)
        t.circle(jil/2, 180)
        t.circle(jil/4, 180)
        t.end_fill()
        t.rt(90)

    # 검은 줄 도형
    def long():
        t.begin_fill()
        t.forward(jil/2)
        t.left(90)
        t.forward(jil/12)
        t.left(90)
        t.forward(jil/2)
        t.left(90)
        t.forward(jil/12)
        t.end_fill()

    def short():
        t.begin_fill()
        t.forward(jil/4 - jil/48)
        t.rt(90)
        t.forward(jil/12)
        t.rt(90)
        t.forward(jil/4 - jil/48)
        t.rt(90)
        t.forward(jil/12)
        t.end_fill()

    def space1(): t.left(180); t.penup(); t.forward(jil/12 + jil/24); t.pendown(); t.right(90)
    def space2(): t.rt(90); t.penup(); t.forward(jil/4 + jil/48); t.pendown()
    def space3(): t.rt(90); t.penup(); t.forward(jil/4 - jil/48); t.rt(90); t.forward(jil/12 + jil/24); t.rt(90); t.pendown()
    def space4(): t.penup(); t.rt(90); t.backward(jil/4 + jil/48); t.rt(90); t.forward(jil/12 + jil/24); t.lt(90); t.pendown()
    def space5(): t.lt(90); t.penup(); t.forward(jil/2); t.lt(90); t.forward(jil/12 + jil/24); t.lt(90); t.pendown()

    draw_taeguk()

    t.color("black")

    # 건
    t.penup(); t.goto(0, 0); t.forward(jil//2 + jil/4); t.right(90); t.backward(jil/4); t.pendown()
    long(); space1(); long(); space1(); long()

    # 곤
    t.penup(); t.goto(0, 0); t.forward(jil//2 + jil/4); t.left(90); t.backward(jil//4); t.pendown()
    short(); space2(); short(); space4(); short(); space2(); short(); space4(); short(); space2(); short()

    # 감
    t.penup(); t.goto(0, 0); t.rt(90 + 22.6); t.forward(jil/2 + jil/4); t.left(90); t.backward(jil/4); t.pendown()
    short(); space2(); short(); space3(); long(); space5(); short(); space2(); short()

    # 리
    t.penup(); t.goto(0, 0); t.forward(jil/2 + jil/4); t.right(90); t.backward(jil//4); t.pendown()
    long(); space5(); short(); space2(); short(); space3(); long()

    t.hideturtle()
    t.done()
