
Point = Ice.$extend('Point', {
	__init__: function(x, y) {
		if(!_.has(x, 'left')) {
			this.x = this.left = x;
			this.y = this.top = y;
		} else {
			this.x = this.left = x.left;
			this.y = this.top = x.top;
		}

	},
	center: function() {
		return new Point(this.x/2, this.y/2);
	},
	plus: function(x, y) {
		if(y === undefined) {
			if(x.$class === Point) {
				return new Point(this.x + x.x, this.y + x.y);
			}

			return new Point(this.x + x, this.y + x);
		}
		return new Point(this.x + x, this.y + y);
	},
	negative: function() {
		return new Point(-1 * this.x, -1 * this.y);
	},
	plus_polar: function(th, r) {
        if(r === undefined) {
            r = th.y;
            th = th.x;
        }
		return this.plus(r * Trig.cos(th), r * -1 * Trig.sind(th));
	},
	lt: function() {
		return {left: this.x, top: this.y};
	},
	size: function() {
		return {width: this.x, height: this.y};
	},
	times: function(mult) {
		return new Point(this.x * mult, this.y * mult);
	},
    bezier: function(t, ...inters) {
        var self = this;
        var pts = [self].concat(inters);
        // console.log("getting bezier ", pts, t);
        while(pts.length > 1) {
            var reduced = [];
            for(var x = 0; x< pts.length - 1; x++) {
                var pta = pts[x];
                var ptb = pts[x+1];
                var pt = Point(pta.x + (ptb.x - pta.x) * t, pta.y + (ptb.y - pta.y) * t);
                reduced.push(pt);
            }
            pts = reduced;
        }
        return pts[0];
    },
    array: function() {
        return [this.x, this.y];
    },
});

Point.fromSize = function(element) {
	var $e = $(element);
	return new Point($e.width(), $e.height());
}
Point.zero = new Point(0,0);
