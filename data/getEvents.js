var d3 = require('d3'),
	fs = require('fs'),
	topojson = require('topojson'),
	downcache = require('downcache'),
	geo = require('./geo/us-counties.json'),
	hdr = {'User-Agent': 'Mozilla/4.0'};

var formatValue = d3.format('.3s');
var formatTenths = d3.format('.1f');
var formatCommas = d3.format('0,000');

var countiesGeo = topojson.feature(geo, geo.objects.counties).features,
	neighbors = topojson.neighbors(geo.objects.counties.geometries);

// Counts
var completed = 0,
	err_count = 0,
	nws_count = 0,
	reg_count = 0;

// To be outputted as JSON at end of script
var countyIndex = {},
	errors = [],
	states = {},
	counties = {},
	zones = {},
	all = {
		earthquake: {
			count: 0,
			deaths: 0,
			dmg: 0,
			inj: 0
		}
	};

var stateRef = require('./raw/stateRef.json');
var nwsRef = require('./raw/nwsZonesRef.json');

var stateAbbrev = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FM','FL','GA','GU','HI','ID','IL','IN','IA','KS','KY','LA','ME','MH','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','MP','OH','OK','OR','PW','PA','PR','RI','SC','SD','TN','TX','UT','VT','VI','VA','WA','WV','WI',
'WY'];

//Create object for every state
for (i = 0; i < stateAbbrev.length; i++) { 
    states[stateAbbrev[i]] = {}
}

// Create index of National Weather Service zones so we can get lat lon for zones in NOAA data
fs.readFile('raw/nws_zones.csv', 'utf8', function (err, data) {
	d3.csv.parse(data, function(r){
		zones[r['state']+r['zone']] = {
			geo: [parseFloat(r['lat']),parseFloat(r['lon'])]
		}
	});
});

// Create object for every county
fs.readFile('raw/counties.csv', 'utf8', function (err, data) {

	d3.csv.parse(data, function(r){

		countyIndex[r['NAME'] +', '+r['USPS']] = {
			geoid: r['GEOID']
		};
		var stateFip =  r['GEOID'].substring(0,2)
		var countyFip = r['GEOID'].substring(2,5)

		var geoid = parseInt(r['GEOID']);
		geoid = +geoid;
		
		states[r['USPS']][countyFip] = {
			name: r['NAME'],
			fips: r['USPS'],
			pop10: r['POP10'],
			lat: parseFloat(r['INTPTLAT']),
			lon: parseFloat(r['INTPTLONG']),
			geoid: r['GEOID'],
			deaths: 0,
			prop_dmg: 0,
			crop_dmg: 0,
			inj: 0,
			all: 0,
			eq: [] // Earthquakes count manually added because follows different http call from NOAA events
		};

		counties[geoid] = {
			name: r['NAME'],
			fips: r['USPS'],
			pop10: r['POP10'],
			lat: parseFloat(r['INTPTLAT']),
			lon: parseFloat(r['INTPTLONG']),
			geoid: r['GEOID'],
			deaths: 0,
			prop_dmg: 0,
			crop_dmg: 0,
			inj: 0,
			all: 0,
			eq: 0 // Earthquakes count manually added because follows different http call from NOAA events
		};

		// Add count for each type of disaster to state and county files
		for (index = 0; index < disasters.length; index++) {
			var disas = disasters[index].replace(/[+%2829]/g,'_')
    		states[r['USPS']][countyFip][disas] = [];
    		counties[geoid][disas] = 0;
    		all[disas] = {count:0, deaths:0, dmg: 0, inj: 0};
    	}
		
	});
})

/********** NOAA Significant Earthquakes ***********/
var page = 0;
var last_page = 1;

var url = 'http://www.ngdc.noaa.gov/nndc/struts/results?bt_0=1950&st_0=2015&type_17=EXACT&query_17=None+Selected&op_12=eq&v_12=USA&type_12=Or&query_14=None+Selected&type_3=Like&query_3=&st_1=&bt_2=&st_2=&bt_1=&bt_4=&st_4=&bt_5=&st_5=&bt_6=&st_6=&bt_7=&st_7=&bt_8=&st_8=&bt_9=&st_9=&bt_10=&st_10=&type_11=Exact&query_11=&type_16=Exact&query_16=&bt_18=&st_18=&ge_19=&le_19=&display_look=189&t=101650&s=1&submit_all=Search+Database'

downcache(url, function (err, response, body) {

	d3.tsv.parse(body, function(r){
		var temp = {
			type: 'earthquake',
			begin: r['MONTH']+'/'+r['DAY']+'/'+r['YEAR'],
			inj: r['TOTAL_INJURIES'],
			
			prop_dmg: r['TOTAL_DAMAGE_MILLIONS_DOLLARS'],
			crop_dmg: '',
			county: r['LOCATION_NAME'],
			state: r['STATE']
		}
		if (r['TOTAL_DEATHS'] == ''){
			temp.deaths = r['TOTAL_DEATHS'];
		} else {
			temp.deaths = r['DEATHS'];
		}
		var lat = r['LATITUDE'].replace(/ +?/g, '');
		var lon = r['LONGITUDE'].replace(/ +?/g, '');
		var geo =  [lat, lon]
		var url = 'http://data.fcc.gov/api/block/find?format=json&latitude='+lat+'&longitude='+lon;	
		downcache(url, function(err, response, results){
			var data = JSON.parse(results);
			if (data['County']['FIPS'] != null){
				var stateAbbrev = data['State']['code']
				var countyFips = data['County']['FIPS'].substring(2,5);
				var fips = parseInt(data['County']['FIPS']);
				fips = +fips;
			
				// for all disaster counts
				all['earthquake'].count += 1;
				all['earthquake'].dmg += parseFloat(temp['prop_dmg']);
				all['earthquake'].inj += parseFloat(temp['inj']);
				if (temp['prop_dmg']){
					all['earthquake'].dmg += parseFloat(temp['prop_dmg']);
				}
				if (temp['inj']){
					all['earthquake'].inj += parseFloat(temp['inj']);
				}
				if (temp.deaths){
					all['earthquake'].deaths += parseFloat(temp.deaths);
				}
				// for browser
				counties[fips]['all'] += 1;
				counties[fips]['eq'] += 1;
				
				// for ajax calls to state specific county files
				states[stateAbbrev][countyFips]['all'] += 1;
				
				if ( !isNaN(parseFloat(temp['deaths'])) ){
					states[stateAbbrev][countyFips]['deaths'] += parseFloat(temp['deaths']);
					counties[fips]['deaths'] += parseFloat(temp['deaths']);
				}
				if (!isNaN(parseFloat(temp['inj'])) ){
					states[stateAbbrev][countyFips]['inj'] += parseFloat(temp['inj']);
					counties[fips]['inj'] += parseFloat(temp['inj']);
				}
				if (!isNaN(parseFloat(temp['prop_dmg'])) ){
					states[stateAbbrev][countyFips]['prop_dmg'] += parseFloat(temp['prop_dmg']);
					counties[fips]['prop_dmg'] += parseFloat(temp['prop_dmg']);
				}
				states[stateAbbrev][countyFips]['eq'].push(temp);
			}
		})				
	});
	completed ++;
});

/********* NOAA **********/
var disasters = ['Hurricane+%28Typhoon%29','Cold%2FWind+Chill','Coastal+Flood','Avalanche','Astronomical+Low+Tide','Dense+Fog','Drought','Dust+Devil','Dust+Devil','Dust+Storm','Excessive+Heat','Extreme+Cold%2FWind+Chill','Flash+Flood','Flood','Freezing+Fog','Funnel+Cloud','Hail','Heat','Heavy+Rain','Heavy+Snow','High+Surf','High+Wind','Ice+Storm','Lakeshore+Flood','Landslide','Lightning','Rip+Current','Seiche','Sleet','Storm+Surge%2FTide','Strong+Wind','Thunderstorm+Wind','Tornado','Tropical+Depression','Tropical+Storm','Tsunami','Volcanic+Ashfall','Waterspout','Wildfire','Winter+Storm','Winter+Weather'];

for (i = 0; i < disasters.length; i++) { 
    getData(disasters[i])
}

function getData(type){
	var pg = 1950;
	var last_pg = 2015;
	var months = ['01','06','12'];
	
	(function loop() {
		if (pg <= last_pg) {
		    
		    var strPg = String(pg),
		    	url = '';
			
			if (strPg.indexOf('.5') > 0){
				var year = pg - 0.5;
				var url = 'http://www.ncdc.noaa.gov/stormevents/csv?eventType=%28Z%29+'+type+'&beginDate_mm='+months[1]+'&beginDate_dd=01&beginDate_yyyy='+year+'&endDate_mm='+months[2]+'&endDate_dd=01&endDate_yyyy='+year+'&hailfilter=0.00&tornfilter=2&windfilter=000&sort=DT&statefips=-999%2CALL';			
			} else {
				url = 'http://www.ncdc.noaa.gov/stormevents/csv?eventType=%28Z%29+'+type+'&beginDate_mm='+months[0]+'&beginDate_dd=01&beginDate_yyyy='+pg+'&endDate_mm='+months[1]+'&endDate_dd=01&endDate_yyyy='+pg+'&hailfilter=0.00&tornfilter=2&windfilter=000&sort=DT&statefips=-999%2CALL';
			}

			downcache(url, function (err, response, body) {
				
				var previous = '';
				if (body != undefined){
					d3.csv.parse(body, function(r){
						var pushLoc = false;
						if (r['DEATHS_DIRECT'] > 0 || 
							r['INJURIES_DIRECT'] > 0|| r['DAMAGE_PROPERTY_NUM'] > 0 
							|| r['DAMAGE_CROPS_NUM'] > 0) { 
	
							var countyFips = '',
								loc = [];
							if (r['CZ_FIPS'] < 100 && r['CZ_FIPS'] > 10) { 
								countyFips = "0"+r['CZ_FIPS'];
							} else if (r['CZ_FIPS'] < 10) {
								countyFips = "00"+r['CZ_FIPS'];
							} else {
								countyFips = r['CZ_FIPS'];
							}
	
							var county = r['CZ_NAME_STR'].replace('(ZONE)','');

							var temp = {
								type: type,
								time: r['BEGIN_TIME'],
								inj: r['INJURIES_DIRECT'],
								deaths: r['DEATHS_DIRECT'],
								prop_dmg: r['DAMAGE_PROPERTY_NUM'],
								crop_dmg: r['DAMAGE_CROPS_NUM'],
								begin: r['BEGIN_DATE'],
								county: county,
								state: r['STATE_ABBR']
							}
							
							if (isNaN(r['STATE_ABBR']) && r['STATE_ABBR'] != 'XX') {
								var fips = String(stateRef[r['STATE_ABBR']]['fips']) + String(countyFips)
							}
							
							// If not in counties, we have to find equivalent county for NWS zone
							if (r['CZ_TYPE'] == 'Z'){
								// Check to see if NWS zone matches to list in nwsRef.json
								if (nwsRef[r['STATE_ABBR']+'_Z'+countyFips] != undefined){
									nws_count  += 1;
									var lat = nwsRef[r['STATE_ABBR']+'_Z'+countyFips]['lat']
									var lon = nwsRef[r['STATE_ABBR']+'_Z'+countyFips]['lon']
									var url = 'http://data.fcc.gov/api/block/find?format=json&latitude='+lat+'&longitude='+lon;

									downcache(url, function(err, response, results){
									 	try {
											var data = JSON.parse(results);
											if (data['County']['FIPS'] != null){
												var countyFips = data['County']['FIPS'].substring(2,5);
												var fips = parseInt(data['County']['FIPS']);
												fips = +fips;
												proceed(fips, countyFips); // Now proceed since we have appropriate county fips
											
											} else {
												// err_count  += 1;
												// errors.push(r)
											}
										} 
											catch(err){
												err_count += 1;
												errors.push(r)
										}
									});
								} else {
									// No zone found to match data to a county, send to errors
									err_count += 1;
									errors.push(r)
								}
							} else {
								// else move forward normally with county info
								reg_count  += 1;
								proceed(fips, countyFips); 
							}
							
							function proceed(fips, countyFips){
								if (counties[fips] != undefined){
									// Get lat/lon information for events, either from row itself, or county centroid
									if (r['BEGIN_LAT'] !=  " " || null){
										loc.push(parseFloat(r['BEGIN_LAT']), parseFloat(r['BEGIN_LON']))
									} else {
										try {
											loc.push(counties[fips]['lat'], counties[fips]['lon']);
										} 
										catch(err){
										}
									}
									var disas = type.replace(/[+%2829]/g,'_')
									
									counties[fips][disas] += 1;
									all[disas].count += 1;
									all[disas].deaths += parseFloat(temp['deaths']);;
									
									all[disas].dmg += (parseFloat(temp['crop_dmg']) + parseFloat(temp['prop_dmg']) );
									all[disas].inj += parseFloat(temp['inj']);;

									// for browser
									counties[fips]['all'] += 1;
									counties[fips]['deaths'] += parseFloat(temp['deaths']);
									counties[fips]['inj'] += parseFloat(temp['inj']);
									counties[fips]['crop_dmg'] += parseFloat(temp['crop_dmg']);
									counties[fips]['prop_dmg'] += parseFloat(temp['prop_dmg']);
									
									// for ajax calls to state sepcific county files
									states[r['STATE_ABBR']][countyFips]['all'] += 1;
									states[r['STATE_ABBR']][countyFips]['deaths'] += parseFloat(temp['deaths']);
									states[r['STATE_ABBR']][countyFips]['inj'] += parseFloat(temp['inj']);
									states[r['STATE_ABBR']][countyFips]['crop_dmg'] += parseFloat(temp['crop_dmg']);
									states[r['STATE_ABBR']][countyFips]['prop_dmg'] += parseFloat(temp['prop_dmg']);

									if (temp.prop_dmg != 0){
										temp['prop_dmg'] = formatValue(temp['prop_dmg'])	
									}
									if (temp.crop_dmg != 0){
										temp['crop_dmg'] = formatValue(temp['crop_dmg'])	
									}
									states[r['STATE_ABBR']][countyFips][disas].push(temp);
									
								} else {
									err_count += 1;
									errors.push(r)
								}
							}
						}
					});
				}
				pg = pg + 0.5; // enables us to make two calls for each year (6 months of data each)
				console.log('Downloading ' + type+ ' for '+ pg)
				loop();	
			});

			if (pg == last_pg){

				console.log('Completed type' ,completed,'(' + type+ ') of', disasters.length, ' types')				
				completed ++;

				if (completed == disasters.length +1){ // + 1 here to include earthquakes

					function formatValues(){
						
						for (i = 0; i < stateAbbrev.length; i++) { 
							for (var key in states[stateAbbrev[i]]) {
								if (states[stateAbbrev[i]][key].crop_dmg != 0){
									states[stateAbbrev[i]][key].crop_dmg = formatValue(states[stateAbbrev[i]][key].crop_dmg)
								}
								if (states[stateAbbrev[i]][key].prop_dmg != 0){
									states[stateAbbrev[i]][key].prop_dmg = formatValue(states[stateAbbrev[i]][key].prop_dmg)
								}
							}
							if (i == stateAbbrev.length - 1){
								getNeighbors();
							}
						}
					}

					function compareRegions(element) {
 						if (element.value.fips != 'PR' && element.value.fips != 'AK' ){
 							return element;
 						}
					}
				
					function getNeighbors(){
						countiesGeo.forEach(function(county, i) {
						   	if (counties[county.id]){
						   		counties[county.id].neighbors = neighbors[i];
						   	} else {
						   		
						   	}
						});
						
						var newCounties = d3.entries(counties);
						newCounties.forEach(function(c, i){
								
								counties[c.key].neighborAll = c.value.all;
								counties[c.key].neighborAllRaw = c.value.all;
								counties[c.key].neighborInj = c.value.inj;
								counties[c.key].neighborDeath = c.value.deaths;
								counties[c.key].neighborPropdmg = c.value.prop_dmg;
								counties[c.key].neighborCropdmg = c.value.crop_dmg;
				
								if (c.value.neighbors) {
									for (index = 0; index < c.value.neighbors.length; index ++){
										var whichCounty = countiesGeo[c.value.neighbors[index]]
										
										if (counties[whichCounty.id]){
				
											counties[c.key].neighborAll     += counties[whichCounty.id].all;
											counties[c.key].neighborAllRaw  += counties[whichCounty.id].all;
											counties[c.key].neighborInj     += counties[whichCounty.id].inj;
											
											counties[c.key].neighborDeath   += counties[whichCounty.id].deaths;
											counties[c.key].neighborPropdmg += counties[whichCounty.id].prop_dmg;
											counties[c.key].neighborCropdmg += counties[whichCounty.id].crop_dmg;
										}
									}
									counties[c.key].neighborAll       = formatTenths(c.value.neighborAll   / (c.value.neighbors.length + 1));
									counties[c.key].neighborAllRaw    = c.value.neighborAllRaw   / (c.value.neighbors.length + 1)
									counties[c.key].pop10             = formatCommas(c.value.pop10)
									counties[c.key].neighborDeath     = formatTenths((c.value.neighborDeath/ c.value.neighbors.length + 1));
									counties[c.key].neighborPropdmg   = formatValue((c.value.neighborPropdmg/ (c.value.neighbors.length + 1)))
									counties[c.key].neighborCropdmg   = formatValue((c.value.neighborCropdmg/ (c.value.neighbors.length + 1)))
								} 
						});
						sortNeighbors(newCounties);
					}

					function sortNeighbors(c){
						
						var filtered = c.filter(compareRegions);
						filtered.sort(function(a, b) { return a.value.neighborAll - b.value.neighborAll; })
						filtered.forEach(function(c, i){
							delete counties[c.key].neighbors;
							counties[c.key].rank = i +1;
							counties[c.key].prop_dmg  = formatValue(counties[c.key].prop_dmg)
							counties[c.key].crop_dmg  = formatValue(counties[c.key].crop_dmg)
						});						
						writeFiles(filtered);
					}

					function writeFiles(c){

						fs.writeFileSync("processed/errors.json", JSON.stringify(errors, null, 2));
						fs.writeFileSync("processed/county-index.json", JSON.stringify(countyIndex, null, 2));
						fs.writeFileSync("processed/counties.json", JSON.stringify(counties, null, 2));
			    		
						// create file for each state
						for (i = 0; i < stateAbbrev.length; i++) { 
							fs.writeFileSync("processed/json/states/"+stateAbbrev[i]+".json", JSON.stringify(states[stateAbbrev[i]], null, 2));
						}
						console.log('Completed all types')
						console.log('regular:', reg_count)
						console.log('NWS:', nws_count)
						console.log('Error:', err_count, errors.length) // These should match 
					}
					formatValues();
				}
			}
		}
	}());	
}