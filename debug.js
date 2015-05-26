(function($) {
	var time = require('time-interactive'),
		d3 = require('d3'),
		base = require('d3-base'),
		topojson = require("topojson"),
		typeahead = require("typeahead-fix"),
		social = require("./lib/social-buttons");

	// Templates 
	var choices = require("./src/choices.html"),
		tableRow = require("./src/table-row.html"),
		countyTemplate = require("./src/county.html");

	// Geography and data files
	var	geo = require('./data/geo/us-counties.json'),
		statesRef = require('./data/raw/state-names.json'),
		countyIndex = require('./data/raw/county-index.json'),
		counties = require('./data/processed/counties.json');

	var interactive = time('natural_disasters');

	var fb = social.facebook(53177223193);
	var tw = social.twitter();

	var countiesGeo = topojson.feature(geo, geo.objects.counties).features;
	
	var newCounties = d3.entries(counties);
	var current = {
		fips: '',
		county: '',
		rank: 0
	};

	var formatValue = d3.format(".3s");
	// Stylesheet
	require("./src/styles.less");
	// HTML
	$(interactive.el).append(choices());  

	var empty = [],
		margin = interactive.width() < 500 ? {top: 20, right: 10, bottom: 30, left: 10} : {top: 20, right: 30, bottom: 30, left: 30},
		width =  interactive.width(),
		height = width < 500 ? 300 : (width/1.8),
		centered;

	var rateById = d3.map();
	
	var quantize = d3.scale.log()
		 .domain([1,75]).range(['#FFFFEC','#FF4D1A'])
		.interpolate(d3.interpolateRgb);
	
	function sort(type, second){
		var max = 0;
		newCounties.forEach(function(c, i){			
			if (c.value[type] > max){
				max = c.value[type];
			}
			var id = parseInt(c.value.geoid);
				id = +id;
			if (c.value[type] == 0){
				empty.push(c)
			}
			rateById.set(id, +c.value[type]); 
		});

		if (second){
			quantize.domain([1, max/2])
			g.selectAll('.county').style("fill", '#fff')
			g.selectAll('.county').style("fill", function(d) {return quantize(rateById.get(d.id)); })
		}
		
	}
	// First load
	sort('neighborAllRaw', false)

	setTimeout(checkHash, 900); 
	
	function checkHash(){
		if (window.location.hash){
		var fips = window.location.hash.replace('#','');
			countiesGeo.forEach(function(county, i) {
				if (county.id == fips){
					clicked(county)
				}
			});
		};
	};

	var projection = d3.geo.albers()
	    .scale(width)
	    .translate([width / 2, height / 2]);

	var path = d3.geo.path()
		.projection(projection);

	var svg = d3.select("#map").append("svg")
	    .attr("width", width)
	    .attr("height", height);

	$('#drawer').css('height', height + 2);

	svg.append("rect")
		.attr("class", "background")
		.attr("width", width)
		.attr("height",height)
	 	.on("click", clicked);
	
	var g = svg.append("g")

	function ready() {	
		g.append("g")
			.attr("id", "counties")
			.selectAll("path")
			.data(topojson.feature(geo, geo.objects.counties).features)
		  .enter().append("path")
			.attr('class', function(d) { return 'county'; })
			.attr('id', function(d) { return 'ID' +d.id; })
			.style("fill", function(d) { return quantize(rateById.get(d.id));})
			.tooltip(
			//mouseover
				function(d, i, obj) {
					d3.selectAll(".county").style({'stroke' : '#888', 'stroke-width': .1});
					d3.select(obj).style({'stroke' : '#fff', 'stroke-width': 2});
					return   "<div><h5>" + counties[d.id].name +", "+ counties[d.id]['fips']  +
					    "</h5><br>Ranks "+time.commafy(counties[d.id].rank) +" out of 3,114 in safety from natural disasters.</br><br><em>Click for county details</em></br></div>";
					}
				)
			.attr("d", path)
			.on("click", clicked);

		g.append("path")
			.datum(topojson.mesh(geo, geo.objects.states, function(a, b) { return a !== b; }))
			.attr("id", "state-borders")
			.attr("d", path)
			.style('fill','none')
			.style('stroke-width',1.8);
	}
	ready();

	function clicked(d) {
		//update hash
		if (d != undefined){window.location.hash = d.id;}
	  	var x, y, k;
		
	  	if (d && centered !== d) {
	  		$('#drawer').addClass('active');
	  		$('#reset').addClass('active');
	  	  	var centroid = path.centroid(d);
	  	  	x = centroid[0];
	  	  	y = centroid[1];
	  	  	k = 9;
	  	  	centered = d;
			var events = require("./data/raw/events.json");

	  	  	// d3.json("http://content.time.com/time/wp/interactives/apps/natural_disasters/states/"+counties[d.id]['fips']+".json", function(error, json) {	
	  	  	d3.json("data/processed/states/"+counties[d.id]['fips']+".json", function(error, json) {
				if (error) return console.warn(error);
					$('.details').empty();
					
				var countyFip = counties[d.id]['geoid'].substring(2,5),
					county = json[countyFip],
					countySummary = counties[d.id],
					percent = (counties[d.id].rank /3114) * 100;
				percent = parseInt(percent) - 2.2 + '%'
				current.county = counties[d.id].name;
				current.fips = counties[d.id].fips;
				current.rank =  time.commafy(counties[d.id].rank);
				counties[d.id].rank = counties[d.id].rank;
				counties[d.id].rankFormat = time.commafy(counties[d.id].rank);
				countySummary.fipsFull = statesRef[countySummary.fips];
				
				d3.select('.details').html(function(){
					return countyTemplate(countySummary);
				});
				d3.select('.top-summary .downarrow').style('left', percent);

				for (i = 0; i < events.length; i++) { 

					if (county[events[i]['code']].length > 0){
						$('.details').append('<h3>'+events[i]['name']+'</h3><table class='+events[i]['code']+'>'
						+'<th>Date</th><th>Deaths</th><th>Injuries</th><th>Property Damage</th><th>Crop Damage</th></table')		  				

						county[events[i]['code']].forEach(function(disaster){
							$('table.'+events[i]['code']).append(function(){
								return tableRow(disaster);
							});
						});
					}
				}

				$("#tab").click(function(e) {
					$('#drawer').removeClass('active');
				});
				$("#close").click(function(e) {
					$('#drawer').removeClass('active');
				});
				
				$("#twshare").unbind("click");        
				 $("#fbshare").unbind("click");        

				 $("#twshare").click(function() {
					tw.share({
						link: window.location,
						message: current.county + ", " + current.fips + " ranks " + current.rank+ " out of 3,114 in safety from natural disasters. See where your county ranks."
					});
				});

				 $("#fbshare").click(function() {
					fb.share({
						message: current.county + ", " + current.fips + " ranks " + current.rank+ " out of 3,114 in safety from natural disasters. See where your county ranks.",
						description: "Safest to most dangerous U.S. counties from natural disasters.",
						picture: "http://i.imgur.com/UzESdFc.png"
					});
				});
			});

			d3.select('#state-borders')
				.transition()
	     		.duration(800)
	     		.style("stroke-width", .4)

	  	} else {
	  		
	  		d3.select('#state-borders')
	  			.transition()
	     		.duration(800)
	     		.style("stroke-width", 1.5)
	  		$('#reset').removeClass('active');
	  		$('#drawer').removeClass('active');
	  	  	x = width / 2;
	  	  	y = height / 2;
	  	  	k = 1;
	  	  	centered = null;
	  	}
		
	  	g.selectAll("path")
			.classed("active", centered && function(d) { return d === centered; });
		
	  	g.transition()
			.duration(750)
			.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
			.style("stroke-width", 1.5 / k + "px");
	}	
	
	$("#choices li a").click(function(e) {	
		var type = $(this).attr('data');
		$("#choices li a").removeClass('active');
		$(this).addClass('active');
		sort(type, true);
	});
	
	$("li.title").mouseover(function(e) {
		$('ul.dropdown').removeClass('menuhidden');
	});
	
	$("ul.dropdown li").click(function(e) {
		var type = $(this).attr('data');
		var typeText = $(this).text();
		
		$("ul.dropdown li").removeClass('active');
		$(this).addClass('active');
		
		$("ul.dropdown").addClass('menuhidden');
		
		sort(type, true);
		$("span.update-title").text(typeText);
	});
	
	d3.select(self.frameElement).style("height", height + "px");
	d3.select(window).on('resize', resize);
	
	function resize() {
	    width = interactive.width();
	    height = width < 500 ? 300 : (width/1.8);
	    // update projection
	    projection
	        .translate([width / 2, height / 2])
	        .scale(width);
	    // resize the map container
	    svg
	        .style('width', width + 'px')
	        .style('height', height + 'px');
	    // resize the map
	    svg.select('#state-borders').attr('d', path);
	    svg.selectAll('.county').attr('d', path);
	    $('#drawer').css('height', height + 2);
	}
	
	// Location lookup with Typeahead
	nameLookup = d3.entries(countyIndex)
	$("#roster").typeahead({
		minLength: 1,
	    limit: 10,
	    local: nameLookup,
	    valueKey: "key"
	});

	$("#roster").bind("typeahead:selected", function(ev, val) {
		var fips = String(val.value.geoid)
		fips = +fips;
		var selector = '#ID' + fips;

		countiesGeo.forEach(function(county, i) {
			if (county.id == fips){
				d3.selectAll(".county").style({'stroke' : '#888', 'stroke-width': .1});
				d3.select(selector).style({'stroke' : '#fff', 'stroke-width': 1});
				clicked(county)
			}
		});
	});

	$("#roster").keyup(function(event){
		if(event.keyCode == 13){
			var val = $('#roster').val();
			if (isNaN(val)){
				$("#roster").click();	
			} else {
				if (val.length == 5){
					// we have a zip folks!
					var fips = zipIndex[val].countyFIP;
					fips = +fips;
			
					countiesGeo.forEach(function(county, i) {
						if (county.id == fips){
							clicked(county)
						}
					});
				}
			}
		}
	});

	$("#roster").click(function(e) {
		$("#roster").typeahead('setQuery', '');
		$("#roster").css("color", "black");
		$("#roster").unbind("click");
	});
	
	$("#reset").click(function(e) {
		clicked();
	});

}(window.jQuery));