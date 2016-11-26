var canvas = null // canvas
var sizeFactor = 0.05 // inflate speed
var velocityFactor = 0.2 // drag velocity
var forceFactorSign = +1 // attract/repel
var forceFactorMag = 500 // attract/repel strength
var timeFactor = timeFactorDef = 0.5 // simulation speed
var canvasScale = 1

var interaction = { // mouse or touch state
    state: 0,
    startX: -1,
    startY: -1,
    startTime: -1
}

var bubbles = []
var bubble = null // active bubble
var bubbleZero = { // initial bubble
    size: 1,
    radius: 0,
    x: 0,
    y: 0, // position
    vx: 0,
    vy: 0, // velocity
    fx: 0,
    fy: 0, // force vector
    f: 0, // force magnitude
    nx: 0,
    ny: 0, // normals
    colors: []
}

var moveThings = function(dt) {
    var newBubbles = [] // filter array
    $.each(bubbles, function(i, b) { // eliminate smallest sucked by others
        if (b.size > 0.1)
            newBubbles.push(b)
    })
    bubbles = newBubbles // set filtered array to base array
    newBubbles.sort(function(a, b) {
        return b.size - a.size
    }); // sort from biddest to smallest. we want smallest rendered last

    dt = clamp(dt, 0.001, 1.0) // time issues. if too small or big to calculate than clamp value

    $.each(bubbles, function(i, b) { // let's calculate forces on each bubble
        b.fx = 0
        b.fy = 0 // initial value zero

        $.each(bubbles, function(i, b2) { // calculate force using size and distance to other bubbles (b2)
            if (b != b2) {
                if (b2.size <= 0.1)
                    return
                var dx = (b2.x - b.x)
                var dy = (b2.y - b.y)
                var distance = Math.sqrt(dx * dx + dy * dy)
                if (distance < b.radius * 0.5) { // too close? suck small one
                    if (b.size > b2.size) {
                        var t = dt * 50
                        if (t > b2.size)
                            t = b2.size
                        b.size += t
                        b2.size -= t
                    }
                    return // too close
                }
                var force = b.size * b2.size / distance * (forceFactorSign * forceFactorMag)
                b.fx += force * dx / distance // resultant force
                b.fy += force * dy / distance
            }
        })
        b.radius = Math.sqrt(b.size) * 5

        b.f = Math.sqrt(b.fx * b.fx + b.fy * b.fy) // force magnitude
        if (b.f > 0.01) {
            b.nx = b.fx / b.f // force normals
            b.ny = b.fy / b.f
        } else {
            b.nx = 1
            b.ny = 0
        }
        b.vx += (b.fx / b.size) * dt // accelerate
        b.vy += (b.fy / b.size) * dt
        b.x += b.vx * dt // move
        b.y += b.vy * dt

        if (b.x < 0 || b.x > canvas.width) { // bounce on edges
            b.vx *= -0.5
            b.x += 4 * b.vx * dt
        }
        if (b.y < 0 || b.y > canvas.height) {
            b.vy *= -0.5
            b.y += 4 * b.vy * dt
        }
    })
}

var renderThings = function() {
    var ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 10;
    $.each(bubbles, function(i, b) {
        ctx.save()
        var grd = ctx.createRadialGradient(0, 0, b.radius * 0.5, 0, 0, b.radius);
        grd.addColorStop(0, b.colors[0]);
        grd.addColorStop(1, b.colors[1]);
        ctx.fillStyle = grd;
        ctx.transform(b.nx, b.ny, -b.ny, b.nx, b.x, b.y) // lean towards force vector
        ctx.rotate(Math.PI * -0.5)
        ctx.beginPath() // draw the egg like shape
        var r = b.radius
        var skew = Math.abs(b.f * 0.025 / b.size / b.size)
        if (skew > 0.5) skew = 0.5
        ctx.scale(1, 1 + skew)
        ctx.moveTo(-r, 0)
        ctx.arcTo(-r, r, 0, r, r)
        ctx.arcTo(r, r, r, 0, r)
        ctx.scale(1, 1 - skew * 0.5)
        ctx.arcTo(r, -r, 0, -r, r)
        ctx.arcTo(-r, -r, -r, 0, r)
        ctx.fill()
        ctx.restore()
    })
}

$(function() {

    var $canvas = $('#canvas')
    canvas = document.getElementById("canvas")
    if (window.devicePixelRatio == 2) {
        canvas.getContext("2d").scale(2, 2);
        canvasScale = 2
    }

    $('#mode').on('change', function() {
        if ($(this).val() == 0)
            forceFactorSign = +1
        else
            forceFactorSign = -1
    })

    $('#speed').on('change', function() {
        if ($(this).val() == 0)
            timeFactor = timeFactorDef * 0.5
        else if ($(this).val() == 1)
            timeFactor = timeFactorDef
        else
            timeFactor = timeFactorDef * 4.0
    })

    $('#reset').click(function() {
        bubbles = []
    })

    var mousedown = function(e) {
        if (interaction.state != 0) {
            mouseend(e)
            return
        }
        if (!e.targetTouches && e.which != 1) { // left button
            mouseend(e)
            return
        }

        interaction.state = 1
        interaction.startTime = new Date()
        interaction.startX = (e.targetTouches ? e.targetTouches[0].pageX : e.offsetX) * canvasScale
        interaction.startY = (e.targetTouches ? e.targetTouches[0].pageY : e.offsetY) * canvasScale
        bubble = $.extend({}, bubbleZero)
        bubble.x = interaction.startX
        bubble.y = interaction.startY
        bubble.colors = randomColors()
        bubbles.push(bubble)
    }

    var mousemove = function(e) {
        if (interaction.state == 1) { // drag to set initial velocity
            var dt = 1 + ((new Date()) - interaction.startTime)
            var x = (e.targetTouches ? e.targetTouches[0].pageX : e.offsetX) * canvasScale
            var y = (e.targetTouches ? e.targetTouches[0].pageY : e.offsetY) * canvasScale
            bubble.vx = 1.0 * (x - interaction.startX) / dt * 1000 * velocityFactor
            bubble.vy = 1.0 * (y - interaction.startY) / dt * 1000 * velocityFactor
        }
        e.preventDefault()
    }

    var mouseend = function(e) {
        interaction.state = 0 // end interaction
    }

    $canvas.on({ 'touchstart': mousedown });
    $canvas.on({ 'touchmove': mousemove });
    $canvas.on({ 'touchend': mouseend });
    $canvas.on({ 'touchcancel': mouseend });
    $canvas.mousedown(mousedown)
    $canvas.mousemove(mousemove)
    $canvas.mouseup(mouseend)
    $canvas.mouseout(mouseend) // skepticism?
    $canvas.mouseleave(mouseend)

    var lastTick = new Date() // initial time
    setInterval(function() { // simulation loop
            if (canvas.width != $canvas.width() * canvasScale) // canvas size changed?
                canvas.width = $canvas.width() * canvasScale // adapt
            if (canvas.height != $canvas.height() * canvasScale)
                canvas.height = $canvas.height() * canvasScale
            if (interaction.state == 1) { // inflate current bubble if mouse down
                bubble.size = 1 + ((new Date()) - interaction.startTime) * sizeFactor
            }
            moveThings(((new Date()) - lastTick) * 0.001 * timeFactor) // move by delta time
            lastTick = new Date()
            renderThings() // draw
        }, 20) // 50 fps

})

/*
 *   UTIL FUNCS
 */
function randomColors() {
    var hue = Math.random()
    var c1 = hslToRgb(hue, 0.75, 0.5)
    var c2 = hslToRgb(hue, 0.85, 0.65)
    return ['rgb(' + Math.round(c1[0]) + ',' + Math.round(c1[1]) + ',' + Math.round(c1[2]) + ')',
        'rgb(' + Math.round(c2[0]) + ',' + Math.round(c2[1]) + ',' + Math.round(c2[2]) + ')'
    ]
}

function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
}

function clamp(num, min, max) {
    return num <= min ? min : num >= max ? max : num;
}
