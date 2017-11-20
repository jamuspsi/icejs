
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
		return this.plus(r * Trig.cos(th), r * 1 * Trig.sin(th));
	},
	lt: function() {
		return {left: this.x, top: this.y};
	},
    topleft: function() {
        return {left: this.x, top: this.y};
        // return
    },
	size: function() {
		return {width: this.x, height: this.y};
	},
	times: function(mult) {
        if(mult.x === undefined)
		      return new Point(this.x * mult, this.y * mult);
        return new Point(this.x * mult.x, this.y * mult.y);
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
    distance: function(dest) {
        var self = this;
        return Math.sqrt(Math.pow(dest.y - self.y,2) + Math.pow(dest.x - self.x, 2));
    },
    skew_from_midpoint: function(dest, pct) {
        var self = this;
        if(pct === undefined) pct = 0.2;
        // var slope = (dest.y - self.y) / (dest.x - self.x);
        var midpoint = self.plus(dest).center();
        var offset_dist = pct * self.distance(dest);

        return midpoint.plus((0.5 + Math.random()) * -1 * offset_dist, (0.5 + Math.random())*offset_dist); // maybe?
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
