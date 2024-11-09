
# Search Google maps nearby API

In Google maps nearby API you can only get a maximum of 60 results per search.
This for searching block by block until you get everything.

The output is a .kml file which can be uploaded to [https://www.google.com/mymaps] for viewing.  An example is here [https://www.google.com/maps/d/embed?mid=1vEA2pfsaI8fXEvSObQI1gm_xwgELnLA&ehbc=2E312F]


### Instructions

Create a ".env" file with the line 
`GOOGLE_MAPS_API=xxx`

Where xxx is your Google maps places API.  This will do lots of nearby searches and cost you money if you go over the $200 monthly free limit.

### Examples...

```
# Each block is 100m x 100m, search a block 10x10
node places_100.js --block-size 0.1 --blocks 10x10 --location " -33.85441,151.2012" >mymap.kml


# Each block is 200m x 200m, search a block 10x10
# Display minimum rating of 3, and minimum number of ratings to 50
node places_100.js --min-rating 3 --min-user-ratings 50 --block-size 0.2 --blocks 10x10 --location " -33.85441,151.2012" >mymap.kml


# Don't search anything, just print the results `--blocks 0x0`
# Display minimum rating of 4.7, and minimum number of ratings to 200
node places_100.js --min-rating 4.7 --min-user-ratings 200 --blocks 0x0 >mymap.kml
```

For all the options `node places_100.js --help`

### Files

The previous results are stored in `places_100.json`
