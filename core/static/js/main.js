require(['jQuery', 'topojson', 'd3', 'boostrap', 'projection', 'polyhedron'], function($, topojson){

	//var rotate = [99.8, -241, -85],
	var rotate = [99.8, -241, -85],
	    rotation = d3.geo.rotation(rotate),
	    ε = 1e-6,
	    π = Math.PI,
	    radians = π / 180,
	    degrees = 180 / π,
	    θ = Math.atan(.5) * degrees,
	    width = 1920,
	    height = 960;

	var vertices = [
	  [0, 90],
	  [0, -90]
	].concat(d3.range(10).map(function(i) {
	  return [(i * 36 + 180) % 360 - 180, i & 1 ? θ : -θ];
	}));

	var polyhedron = d3.range(5).map(function(i) { return [0, 2 + (3 + i * 2) % 10, 3 + i * 2]; }) // North
	    .concat(d3.range(10).map(function(i) { return [2 + i, 2 + (i < 1 ? 10 + i - 1 : i - 1), 2 + (1 + i) % 10]; })) // Equator
	    .concat(d3.range(5).map(function(i) { return [1, 2 + i * 2, 2 + (2 + i * 2) % 10]; })) // South
	    .map(function(d) {
	      return d.map(function(i) { return vertices[i]; });
	    });

	console.log(polyhedron);

	(function() {
	  polyhedron.forEach(function(face) {
	    face.centroid = d3.geo.centroid({type: "MultiPoint", coordinates: face});
	  });
	  // Split face 3 at centroid.
	  var face = polyhedron[3],
	      tmp = face.slice();
	      centroid = face.centroid;
	  face[0] = centroid;
	  // Uncomment to join extra face.
	  //face[1] = centroid;
	  //face.push(tmp[1]);
	  polyhedron.push(face = [tmp[0], centroid, tmp[2]]);
	  face.centroid = centroid;
	  // Comment out to join extra face.
	  polyhedron.push(face = [tmp[0], tmp[1], centroid]);
	  face.centroid = centroid;

	  // Split face 5 at edge.
	  face = polyhedron[5];
	  tmp = face.slice();
	  centroid = d3.geo.interpolate(face[1], face[2])(.5);
	  face[1] = centroid;
	  polyhedron.push(face = [tmp[0], tmp[1], centroid]);
	  face.centroid = polyhedron[5].centroid;
	  polyhedron[4].splice(2, 0, centroid);
	})();

	var centroids = [], // centroids for initial nearest-centroid search
	    extraCentroids = []; // optional secondary centroids for split faces

	var faces = polyhedron.map(function(face) {
	  var centroid = face.centroid;
	  centroids.push(cartesian(centroid));
	  extraCentroids.push(cartesian(d3.geo.centroid({type: "MultiPoint", coordinates: face})));
	  // TODO shouldn't really need to reverse faces.
	  var tmp = face.slice();
	  tmp.push(tmp[0]);
	  if (d3.geo.area({type: "Polygon", coordinates: [tmp]}) > 2 * π) face.reverse();
	  return {
	    face: face,
	    project: d3.geo.gnomonic().scale(1).translate([0, 0]).rotate([-centroid[0], -centroid[1]])
	  };
	});

	// Connect each face to a parent face.
	[
	  // N
	  -1, // 0
	  0,  // 1
	  11, // 2
	  13, // 3
	  21, // 4 (change to 3 to join extra face)

	  // Eq
	  6,  // 5
	  7,  // 6
	  8,  // 7
	  9,  // 8
	  1,  // 9

	  9,  // 10
	  10, // 11
	  11, // 12
	  12, // 13
	  13, // 14

	  // S
	  6,  // 15
	  8,  // 16
	  18, // 17
	  12, // 18
	  18, // 19

	  2,  // 20 - extra
	  3,  // 21 - extra
	  4   // 22 - extra
	].forEach(function(d, i) {
	  var node = faces[d];
	  node && (node.children || (node.children = [])).push(faces[i]);
	});


	// Flows: These parameters control the overall projection and can be used to translate and rotate all components.
	var projection = d3.geo.polyhedron(faces[0], face, π / 6 - π / 2)
	    .rotate(rotate)
	    .scale(160)
	    .translate([width / 2 + 150, height / 2 - 200])
	    .center([0, 0])
	    .precision(1);

	var mesh = {type: "MultiLineString", coordinates: projection.mesh.map(function(segment) {
	  return segment.map(rotation.invert);
	}).filter(function(segment) {
	  // Don't show unwanted segment.
	  var d = d3.geo.distance.apply(null, segment);
	  return d > 1 || d < .6;
	})};

	var path = d3.geo.path().projection(projection);

	var svg = d3.select("#map").append("svg")
	    .attr("width", width)
	    .attr("height", height);

	svg.append("path")
	    .datum({type: "Sphere"})
	    .attr("class", "background")
	    .attr("d", path);

	svg.append("path")
	    .datum(d3.geo.graticule())
	    .attr("class", "graticule")
	    .attr("d", path);

	svg.append("path")
	    .datum({type: "Sphere"})
	    .attr("class", "outline")
	    .attr("d", path);

	svg.append("path")
	    .datum(mesh)
	    .attr("class", "face")
	    .attr("d", path);


	d3.json("static/js/world-110m.json", function(error, world) {
	  svg.insert("path", ".graticule")
	      .datum(topojson.feature(world, world.objects.land))
	      .attr("class", "land")
	      .attr("d", path);
	  svg.insert("path", ".graticule")
	      .datum(topojson.mesh(world, world.objects.countries, function(a, b) { return a !== b; }))
	      .attr("class", "boundary")
	      .attr("d", path);
	});

	// track last translation and scale event we processed
	var tlast = [0,0], 
	    slast = null;

	function redraw() {
	    if (d3.event) { 
	        var scale = d3.event.scale,
	            t = d3.event.translate;                
	        console.log(t)
	        // if scaling changes, ignore translation (otherwise touch zooms are weird)
	        if (scale != slast) {
	            projection.scale(scale);
	        } else {
	            var dx = t[0]-tlast[0],
	                dy = t[1]-tlast[1],
	                yaw = projection.rotate()[0],
	                tp = projection.translate();
	        
	            // use x translation to rotate based on current scale
	            //projection.rotate([yaw+360.*dx/width*1/scale, 0, 0]);
	            // use y translation to translate projection, clamped by min/max
	            projection.translate([tp[0]+dx,tp[1]+dy]);
	        }
	        // save last values.  resetting zoom.translate() and scale() would
	        // seem equivalent but doesn't seem to work reliably?
	        slast = scale;
	        tlast = t;
	    }
	    
	    svg.selectAll('path')       // re-project path data
	        .attr('d', path);
	}

	function face(λ, φ) {
	  //Much slower!
	  //var point = [λ, φ],
	  //    face = null,
	  //    inside = 0;
	  //for (var i = 0, n = faces.length; i < n; ++i) {
	  //  face = faces[i];
	  //  if (d3.geo.pointInPolygon(point, face.polygon)) return face;
	  //}
	  var cosφ = Math.cos(φ),
	      p = [cosφ * Math.cos(λ), cosφ * Math.sin(λ), Math.sin(φ)],
	      c,
	      d,
	      min = Infinity,
	      best;

	  for (var i = 0, n = centroids.length - 3; i < n; ++i) {
	    c = centroids[i];
	    d = (d = (c[0] - p[0])) * d + (d = (c[1] - p[1])) * d + (d = (c[2] - p[2])) * d;
	    if (d < min) min = d, best = i;
	  }

	  if (best != null) {
	    if (best !== 5 && best !== 3) return faces[best];

	    // Secondary nearest-centroid search.
	    var candidates = best === 3 ? [3, 20, 21] : [5, 22];
	    best = null, min = Infinity;
	    for (var i = 0; i < candidates.length; ++i) {
	      c = extraCentroids[candidates[i]];
	      d = (d = (c[0] - p[0])) * d + (d = (c[1] - p[1])) * d + (d = (c[2] - p[2])) * d;
	      if (d < min) min = d, best = candidates[i];
	    }
	    return best != null && faces[best];
	  }
	}

	// Converts spherical coordinates (degrees) to 3D Cartesian.
	function cartesian(coordinates) {
	  var λ = coordinates[0] * radians,
	      φ = coordinates[1] * radians,
	      cosφ = Math.cos(φ);
	  return [
	    cosφ * Math.cos(λ),
	    cosφ * Math.sin(λ),
	    Math.sin(φ)
	  ];
	}

	$( document ).ready(function() {
	});

	console.log('main.js loaded');
});