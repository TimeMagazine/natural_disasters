## Most Dangerous U.S. County by Natural Disasters

The `getEvents.js` script downloads all natural disaster data from the National Oceanic and Atmospheric Administration and organizes it by state and county. The script produces a JSON file for each state in `processed/states/` folder. 

### Usage

To recreate the state files, download and install [node.js](https://nodejs.org/), then run `npm install` to get the dependencies. 

Then run `node getEvents.js` to start the script. The script may take up to two hours to download all NOAA events, but downcache will cache the files locally for future instances. 

### Data

The natural disaster events comes from two sources:

1. NOAA [storm events database](https://www.ncdc.noaa.gov/stormevents/choosedates.jsp?statefips=-999%2CALL) 
2. NOAA [significant earthquake archive](http://www.ngdc.noaa.gov/nndc/struts/form?t=101650&s=1&d=1) 

The first data source covers years 1950 to 2015, with 41 types of events, ranging from heavy fogs to rip tides. The second database only contains earthquakes. 

#### Converting geographies to counties

The NOAA events come in various geographies, e.g. hurricanes use National Weather Zones, and earthquakes are recorded in latitude and longitude. The following geographic data is used to convert geographies into U.S. counties for the final map. All of these files can be found in the folder `data/raw`.

- [U.S. Counties]

- The latitude and longitude from [National Weather Services Zones](http://www.aprs-is.net/WX/Default.aspx) is used to locate weather events in counties.

 - The FCC [Census Block Conversions API](https://www.fcc.gov/developers/census-block-conversions-api) converts lat and lon from earthquakes to counties. 
