## Natural Disaster data

These scripts will download and collate huge amounts of information on natural disasters.


The `getEvents.js` script, found in the data folder, downloads all natural disaster data from the National Oceanic and Atmospheric Administration and organizes it by state and county. The script produces a JSON file for each state in `processed/states/` folder. 

### Usage

	git clone https://github.com/TimeMagazine/natural_disasters && cd natural_disasters
	npm install

To download the raw files, run this:

	node lib/getEvents.js

**Warning**: The script may take up to two hours to download all NOAA events, but the [downcache module](https://github.com/wilson428/downcache) will cache the files locally for future references. Upon completion, the state files will be updated with the latest natural disasters from NOAA.

### Data

The natural disasters are downloaded from:

1. NOAA [storm events database](https://www.ncdc.noaa.gov/stormevents/choosedates.jsp?statefips=-999%2CALL) 
2. NOAA [significant earthquake archive](http://www.ngdc.noaa.gov/nndc/struts/form?t=101650&s=1&d=1) 

The first database contains 41 types of events, ranging from heavy fogs to rip tides. The second database only contains earthquakes. 

#### Converting geographies to U.S. counties

The NOAA events come in various geographies, e.g. hurricanes use National Weather Zones, and earthquakes are recorded in latitude and longitude. The following geographic data, contained in the `data/raw` folder, is used in the `getEvents.js` script to convert other geographies to U.S. counties for the final map. 

- The latitude and longitude from [National Weather Services Zones](http://www.aprs-is.net/WX/Default.aspx) is used to locate weather events in counties.

- The FCC [Census Block Conversions API](https://www.fcc.gov/developers/census-block-conversions-api) converts lat and lon from earthquakes to counties. 
